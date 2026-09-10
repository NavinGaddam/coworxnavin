import { addDoc, collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { localToday } from "../pages/types";
import { bookingOn, sessionHours, timeAt } from "./business";

export type ServicePricing = { tea:number; coffee:number; printing:number };
export const DEFAULT_SERVICE_PRICING:ServicePricing={tea:25,coffee:30,printing:5};

export function watchServicePricing(cb:(p:ServicePricing)=>void,onError?:(e:any)=>void){
  return onSnapshot(doc(db,"settings","servicePricing"),s=>cb({...DEFAULT_SERVICE_PRICING,...(s.exists()?s.data():{})} as ServicePricing),onError);
}
export async function saveServicePricing(pricing:ServicePricing){
  const values={tea:Number(pricing.tea),coffee:Number(pricing.coffee),printing:Number(pricing.printing)};
  if(Object.values(values).some(v=>!Number.isFinite(v)||v<0))throw Error("Enter valid non-negative service rates.");
  await setDoc(doc(db,"settings","servicePricing"),{...values,updatedAt:serverTimestamp()},{merge:true});
}

export function watchMyServiceOrders(uid:string,cb:(rows:any[])=>void,onError?:(e:any)=>void){
  return onSnapshot(query(collection(db,"serviceOrders"),where("userId","==",uid)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0))),onError);
}
export function watchAllServiceOrders(cb:(rows:any[])=>void,onError?:(e:any)=>void){
  return onSnapshot(collection(db,"serviceOrders"),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0))),onError);
}

export async function createServiceOrder(bookingId:string,item:"Tea"|"Coffee"|"Printing",qty=1){
  const user=auth.currentUser;
  if(!user)throw Error("Sign in to order a service.");
  if(typeof navigator!=="undefined"&&navigator.onLine===false)throw Error("Reconnect before placing an order.");
  qty=Math.floor(Number(qty));
  if(!Number.isInteger(qty)||qty<1||qty>200)throw Error("Choose a valid quantity.");
  if(item!=="Printing")qty=1;
  const orderRef=doc(collection(db,"serviceOrders"));
  await runTransaction(db,async tx=>{
    const bookingSnap=await tx.get(doc(db,"bookings",bookingId)), pricingSnap=await tx.get(doc(db,"settings","servicePricing"));
    if(!bookingSnap.exists())throw Error("Booking not found.");
    const b:any=bookingSnap.data(), today=localToday();
    if(b.userId!==user.uid&&String(b.customerEmail||"").toLowerCase()!==String(user.email||"").toLowerCase())throw Error("This booking does not belong to your account.");
    if(b.status!=="Confirmed"||!bookingOn(b,today))throw Error("Services can only be ordered during a confirmed booking day.");
    if(b.attendanceDate!==today||!b.checkedInAt||b.checkedOutAt)throw Error("Please check in at reception before ordering services.");
    if(Date.now()>=timeAt(today,sessionHours(b,today).end))throw Error("This booking session has ended.");
    const pricing={...DEFAULT_SERVICE_PRICING,...(pricingSnap.exists()?pricingSnap.data():{})};
    let complimentary=false,unitPrice=0;
    if(item==="Tea"||item==="Coffee"){
      const previous=await tx.get(query(collection(db,"serviceOrders"),where("bookingId","==",bookingId),where("category","==","Beverage")) as any).catch(()=>null as any);
      // Firestore transactions cannot reliably use arbitrary query reads in every SDK/runtime;
      // use a deterministic entitlement document as the atomic free-drink guard instead.
      const entitlementRef=doc(db,"serviceEntitlements",`${bookingId}_drink`),entitlement=await tx.get(entitlementRef);
      complimentary=!entitlement.exists();
      unitPrice=complimentary?0:Number(item==="Tea"?pricing.tea:pricing.coffee);
      if(complimentary)tx.set(entitlementRef,{bookingId,userId:b.userId,usedByOrderId:orderRef.id,usedAt:serverTimestamp()});
    }else unitPrice=Number(pricing.printing);
    const total=Math.round(unitPrice*qty*100)/100;
    tx.set(orderRef,{bookingId,userId:b.userId,customerEmail:b.customerEmail,customerName:b.customerName||b.customerEmail,item,category:item==="Printing"?"Printing":"Beverage",qty,unitPrice,total,complimentary,status:"Requested",paymentStatus:total===0?"No charge":"Pending",createdAt:serverTimestamp(),date:today});
  });
  return orderRef.id;
}

export async function updateServiceOrder(id:string,status:"Accepted"|"Fulfilled"|"Paid"|"Cancelled",paymentReference=""){
  const uid=auth.currentUser?.uid;if(!uid)throw Error("Sign in first.");
  const ref=doc(db,"serviceOrders",id),snapshot=await getDoc(ref);if(!snapshot.exists())throw Error("Order not found.");
  const o:any=snapshot.data();
  if(status==="Paid"&&Number(o.total)>0&&!paymentReference.trim())throw Error("Enter the payment reference or cash acknowledgement.");
  await updateDoc(ref,{status,paymentStatus:status==="Paid"?"Paid":o.paymentStatus,paymentReference:status==="Paid"?paymentReference.trim():o.paymentReference||"",updatedBy:uid,updatedAt:serverTimestamp()});
}
