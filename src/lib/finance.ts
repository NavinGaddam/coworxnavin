import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { localToday } from "../pages/types";
import { balance, money } from "./business";

export type Tender = { cash: number; upi: number; other: number; reference: string };
export const emptyTender = (): Tender => ({cash:0,upi:0,other:0,reference:""});
export function tenderTotal(t: Tender) {
  if ([t.cash,t.upi,t.other].some(n => !Number.isFinite(Number(n)) || Number(n)<0 || Math.abs(Number(n)*100-Math.round(Number(n)*100)) > 0.00001)) throw Error("Enter positive payment amounts with no more than two decimal places.");
  return Math.round((Number(t.cash)+Number(t.upi)+Number(t.other))*100)/100;
}
export async function collectPayment(id: string, tender: Tender, discount = 0, expectedReceived?: number) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw Error("Reconnect before recording a payment.");
  const uid = auth.currentUser?.uid;
  if (!uid) throw Error("Sign in to record payment.");
  const amount = tenderTotal(tender);
  if (tender.upi > 0 && !tender.reference.trim()) throw Error("Enter the UPI transaction reference after verifying receipt.");
  const receipt = doc(collection(db,"payments"));
  return runTransaction(db, async tx => {
    const ref = doc(db,"bookings",id), s = await tx.get(ref), company = await tx.get(doc(db,"settings","company"));
    if (!s.exists()) throw Error("Booking not found.");
    const b:any = s.data(), old = Number(b.paymentReceived || 0);
    if (expectedReceived !== undefined && old !== expectedReceived) throw Error("Another payment was recorded. Refresh and review the remaining balance.");
    if (!["Pending","Confirmed"].includes(b.status) || b.status === "Pending" && b.expiresAt.toMillis() <= Date.now()) throw Error("This hold has expired or was cancelled. Check availability and create a fresh booking.");
    if (!Number.isFinite(discount) || discount < 0) throw Error("Enter a valid discount.");
    if (b.status === "Confirmed" && discount !== Number(b.staffDiscount || 0)) throw Error("Discounts must be agreed before the first payment.");
    const total = Math.round((Number(b.total) + Number(b.staffDiscount || 0) - discount)*100)/100, received = Math.round((old + amount)*100)/100;
    if (total < 0 || received > total || (amount <= 0 && total > 0)) throw Error("Payment must be greater than zero and no more than the balance.");
    if (!b.passDays && received !== total) throw Error("Regular bookings require full advance payment.");
    if (b.passDays && received < Math.min(total,Number(b.minimumAdvance))) throw Error(`Collect at least ${money(Math.min(total,Number(b.minimumAdvance))-old)} to activate this pass.`);
    const lockRefs = b.lockIds.map((key:string) => doc(db,"bookingLocks",key));
    const locks = await Promise.all(lockRefs.map((r:any) => tx.get(r)));
    if (locks.some((l:any) => !l.exists() || l.data().bookingId !== id || !["Pending","Confirmed"].includes(l.data().status))) throw Error("The reserved space changed. Please review this booking before taking payment.");
    const receiptNumber = `RC-${localToday().replaceAll("-","")}-${receipt.id.slice(0,8).toUpperCase()}`;
    tx.set(receipt,{bookingId:id,userId:b.userId,customerEmail:b.customerEmail,customerName:b.customerName || b.customerEmail,kind:"Collection",amount,cashAmount:Number(tender.cash),upiAmount:Number(tender.upi),otherAmount:Number(tender.other),reference:tender.reference.trim(),actorUid:uid,date:localToday(),createdAt:serverTimestamp(),receiptNumber});
    tx.update(ref,{status:"Confirmed",expiresAt:null,total,staffDiscount:discount,paymentReceived:received,paymentStatus:received === total ? "Paid" : "Partially Paid",paymentMethod:[tender.cash>0&&"Cash",tender.upi>0&&"UPI",tender.other>0&&"Other"].filter(Boolean).join(" + ") || "No charge",paymentRef:tender.reference.trim(),lastPaymentId:receipt.id,confirmedBy:uid,confirmedAt:serverTimestamp(),invoiceNumber:b.invoiceNumber || `${company.data()?.invoicePrefix || "CC"}-${localToday().slice(0,4)}-${id.slice(0,8).toUpperCase()}`});
    lockRefs.forEach((r:any) => tx.update(r,{status:"Confirmed",expiresAt:null,updatedAt:serverTimestamp()}));
    return receiptNumber;
  });
}
export function watchPayments(cb:(rows:any[])=>void,onError:(e:any)=>void,customer?:{uid:string;email:string}) {
  const groups:any[][] = [[],[]];
  const queries = customer ? [query(collection(db,"payments"),where("userId","==",customer.uid)),query(collection(db,"payments"),where("customerEmail","==",customer.email.toLowerCase()))] : [query(collection(db,"payments"))];
  const stops = queries.map((q,i) => onSnapshot(q,s => {groups[i]=s.docs.map(d=>({id:d.id,...d.data()}));cb([...new Map(groups.flat().map(r=>[r.id,r])).values()].sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)));},onError));
  return () => stops.forEach(s=>s());
}
export async function reversePayment(paymentId:string,reason:string) {
  if (!reason.trim()) throw Error("Enter the reason for this correction.");
  const uid = auth.currentUser?.uid;
  if (!uid) throw Error("Sign in first.");
  const correction=doc(db,"payments",`reversal_${paymentId}`);
  await runTransaction(db,async tx=>{
    const s=await tx.get(doc(db,"payments",paymentId)), existing=await tx.get(correction);
    if (!s.exists() || existing.exists()) throw Error("This payment is missing or already reversed.");
    const p:any=s.data(), ref=doc(db,"bookings",p.bookingId), b=(await tx.get(ref)).data();
    if (p.kind!=="Collection" || !b || b.status!=="Confirmed" || Number(b.paymentReceived)<p.amount) throw Error("Only an active, unrefunded collection can be corrected.");
    const received=Math.round((Number(b.paymentReceived)-p.amount)*100)/100;
    tx.set(correction,{...p,kind:"Correction",originalPaymentId:paymentId,reason:reason.trim(),actorUid:uid,date:localToday(),createdAt:serverTimestamp(),receiptNumber:`VOID-${p.receiptNumber}`});
    tx.update(ref,{paymentReceived:received,paymentStatus:received>=b.total?"Paid":received>0?"Partially Paid":"Pending",lastPaymentId:correction.id});
  });
}
export async function processRefund(id:string,amount:number,reference:string,method="UPI") {
  const uid=auth.currentUser?.uid;
  if (!uid) throw Error("Sign in first.");
  if (!reference.trim()) throw Error("Enter the refund reference or cash acknowledgement.");
  const receipt=doc(db,"payments",`refund_${id}`);
  await runTransaction(db,async tx=>{
    const ref=doc(db,"bookings",id), s=await tx.get(ref), existing=await tx.get(receipt);
    const b:any=s.data();
    if (!b || b.status!=="Cancelled" || existing.exists()) throw Error("This refund is unavailable or already processed.");
    if (!Number.isFinite(amount) || amount<=0 || amount>Number(b.refundAmount) || amount>Number(b.paymentReceived)) throw Error("Refund exceeds the approved refundable amount.");
    tx.set(receipt,{bookingId:id,userId:b.userId,customerEmail:b.customerEmail,customerName:b.customerName || b.customerEmail,kind:"Refund",amount,cashAmount:method==="Cash"?amount:0,upiAmount:method==="UPI"?amount:0,otherAmount:!["Cash","UPI"].includes(method)?amount:0,reference:reference.trim(),actorUid:uid,date:localToday(),createdAt:serverTimestamp(),receiptNumber:`RF-${id.slice(0,8).toUpperCase()}`});
    tx.update(ref,{refundStatus:"Processed",refundAmount:amount,refundReference:reference.trim(),refundProcessedBy:uid,refundProcessedAt:serverTimestamp(),paymentStatus:"Refunded",lastPaymentId:receipt.id});
  });
}
export const collectionTotals = (rows:any[]) => rows.reduce((t,p)=>{const sign=p.kind==="Collection"?1:-1;return {cash:t.cash+sign*p.cashAmount,upi:t.upi+sign*p.upiAmount,other:t.other+sign*p.otherAmount,net:t.net+sign*p.amount};},{cash:0,upi:0,other:0,net:0});
export async function saveHandover(date:string,openingCash:number,countedCash:number,expectedCash:number,note:string) {
  const uid=auth.currentUser?.uid;
  if (!uid || [openingCash,countedCash,expectedCash].some(v=>!Number.isFinite(v)) || openingCash<0 || countedCash<0) throw Error("Enter valid cash amounts.");
  await setDoc(doc(collection(db,"handovers")),{date,actorUid:uid,openingCash,countedCash,expectedCash,difference:Math.round((countedCash-expectedCash)*100)/100,note:note.trim(),createdAt:serverTimestamp()});
}
export function watchHandovers(cb:(r:any[])=>void,onError:(e:any)=>void) { return onSnapshot(collection(db,"handovers"),s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))),onError); }
export async function downloadReceipt(p:any,company:any) {
  const {jsPDF}=await import("jspdf"), pdf=new jsPDF();
  pdf.setFontSize(20);pdf.text(company?.name || "Coworx Central",20,25);
  pdf.setFontSize(12);let y=43;
  const lines=[`${p.kind} receipt: ${p.receiptNumber}`,`Customer: ${p.customerName}`,`Email: ${p.customerEmail}`,`Date: ${p.date}`,`Amount: INR ${Number(p.amount).toFixed(2)}`,`Cash: INR ${Number(p.cashAmount).toFixed(2)}   UPI: INR ${Number(p.upiAmount).toFixed(2)}`,`Other: INR ${Number(p.otherAmount).toFixed(2)}`,`Reference: ${p.reference || "Cash / no reference"}`,`Booking: ${p.bookingId}`,p.reason?`Reason: ${p.reason}`:""];
  for(const line of lines){const wrapped=pdf.splitTextToSize(line,170);pdf.text(wrapped,20,y);y+=wrapped.length*7+3;}
  pdf.save(`${p.receiptNumber}.pdf`);
}
