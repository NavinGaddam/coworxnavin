import { collection, doc, getDocs, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { addDays } from "../pages/types";
import { DEFAULT_POLICY, officeHours, rescheduleError } from "./business";

export async function reschedulePass(id:string,from:string,to:string,reason:string) {
  if (!reason.trim()) throw Error("Enter a reason for moving this day.");
  if (typeof navigator!=="undefined" && navigator.onLine === false) throw Error("Reconnect before rescheduling.");
  const uid=auth.currentUser?.uid;
  if (!uid) throw Error("Sign in first.");
  const holidays=(await getDocs(collection(db,"holidays"))).docs.map(d=>d.data());
  const event=doc(collection(db,"passChanges"));
  await runTransaction(db,async tx=>{
    const ref=doc(db,"bookings",id), s=await tx.get(ref), settings=await tx.get(doc(db,"settings","policy"));
    if(!s.exists()) throw Error("Pass not found.");
    const b:any=s.data(), policy={...DEFAULT_POLICY,...settings.data()};
    const error=rescheduleError(b,from,to,policy,holidays);
    if(error) throw Error(error);
    const oldRefs=b.inventoryIds.map((i:string)=>doc(db,"bookingLocks",`${from}_${i}_day`));
    const newRefs=b.inventoryIds.map((i:string)=>doc(db,"bookingLocks",`${to}_${i}_day`));
    const oldLocks=await Promise.all(oldRefs.map((r:any)=>tx.get(r))), next=await Promise.all(newRefs.map((r:any)=>tx.get(r)));
    const maintenance=await Promise.all(b.inventoryIds.map((i:string)=>tx.get(doc(db,"resourceBlocks",`${to}_${i}`))));
    if (maintenance.some((s:any)=>s.exists()&&s.data().active!==false)) throw Error("This desk is under maintenance on the replacement date.");
    if(oldLocks.some((s:any)=>!s.exists()||s.data().bookingId!==id)) throw Error("The original reservation changed. Reload this pass.");
    if(next.some((s:any)=>s.exists()&&(s.data().status==="Confirmed" || s.data().status==="Pending" && s.data().expiresAt?.toMillis()>Date.now()))) throw Error("The same desk is unavailable on the replacement date. Choose another open date.");
    const dates=b.dates.filter((d:string)=>d!==from).concat(to).sort(), endDate=dates[dates.length-1];
    const sessions={...b.sessions};delete sessions[from];const h=officeHours(to,policy,holidays);sessions[to]={start:h.start,end:h.end};
    tx.update(ref,{dates,date:dates[0],endDate,lockIds:b.lockIds.filter((x:string)=>!oldRefs.some((r:any)=>r.id===x)).concat(newRefs.map((r:any)=>r.id)),sessions,rescheduleUsed:Number(b.rescheduleUsed||0)+1,lastPassChangeId:event.id,passValidFrom:Timestamp.fromDate(new Date(`${dates[0]}T00:00:00+05:30`)),passValidUntil:Timestamp.fromDate(new Date(`${addDays(endDate,1)}T00:00:00+05:30`))});
    oldRefs.forEach((r:any)=>tx.update(r,{status:"Cancelled",expiresAt:null,updatedAt:serverTimestamp()}));
    newRefs.forEach((r:any,i:number)=>tx.set(r,{bookingId:id,userId:b.userId,inventoryId:b.inventoryIds[i],date:to,start:null,end:null,status:"Confirmed",expiresAt:null,updatedAt:serverTimestamp()}));
    tx.set(event,{bookingId:id,userId:b.userId,customerEmail:b.customerEmail,kind:"Reschedule",from,to,reason:reason.trim(),actorUid:uid,createdAt:serverTimestamp()});
  });
}
export async function grantReschedules(id:string,extra:number,reason:string) {
  if(!Number.isInteger(extra)||extra<1||extra>30||!reason.trim()) throw Error("Enter 1–30 extra days and an exception reason.");
  const uid=auth.currentUser?.uid;
  if(!uid) throw Error("Sign in first.");
  const event=doc(collection(db,"passChanges"));
  await runTransaction(db,async tx=>{
    const ref=doc(db,"bookings",id),s=await tx.get(ref),b:any=s.data();
    if(!b?.passDays||b.status!=="Confirmed") throw Error("Choose an active consecutive pass.");
    tx.update(ref,{rescheduleAllowance:Number(b.rescheduleAllowance)+extra,lastPassChangeId:event.id});
    tx.set(event,{bookingId:id,userId:b.userId,customerEmail:b.customerEmail,kind:"Exception",extra,reason:reason.trim(),actorUid:uid,createdAt:serverTimestamp()});
  });
}
