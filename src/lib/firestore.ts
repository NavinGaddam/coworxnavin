import {addDoc,collection,doc,getDoc,getDocs,limit,onSnapshot,query,serverTimestamp,setDoc,Timestamp,updateDoc,where,runTransaction} from "firebase/firestore";
import {db} from "../firebase";
import {ADMIN_EMAIL,DEFAULT_PRICING,Offer,Booking,Space,emailKey} from "../pages/types";

const clean=(obj:any)=>Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined));

export function watchUser(uid:string,email:string,cb:(b:Booking[])=>void){
  let byUid:Booking[]=[];let byEmail:Booking[]=[];
  const emit=()=>{const m=new Map<string,Booking>();[...byUid,...byEmail].forEach(b=>m.set(b.id,b));cb([...m.values()].sort((a:any,b:any)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0))) };
  const a=onSnapshot(query(collection(db,"bookings"),where("userId","==",uid)),s=>{byUid=s.docs.map(d=>({id:d.id,...d.data()} as Booking));emit()});
  const b=onSnapshot(query(collection(db,"bookings"),where("customerEmail","==",email.toLowerCase())),s=>{byEmail=s.docs.map(d=>({id:d.id,...d.data()} as Booking));emit()});
  return ()=>{a();b()};
}
export function watchAllBookings(cb:(b:Booking[])=>void){return onSnapshot(query(collection(db,"bookings"),limit(300)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()} as Booking))));}
export function watchOffers(email:string,cb:(o:Offer[])=>void){return onSnapshot(query(collection(db,"offers"),where("active","==",true),limit(100)),s=>{const e=email.toLowerCase();cb(s.docs.map(d=>({id:d.id,...d.data()} as Offer)).filter(o=>o.targetType==="all"||(o.targetEmail||"").toLowerCase()===e));});}
export function watchRoleAssignment(email:string,cb:(a:any)=>void){return onSnapshot(doc(db,"roleAssignments",emailKey(email)),s=>cb(s.exists()?{id:s.id,...s.data()}:null));}
export async function ensureUser(u:any){const admin=(u.email||"").toLowerCase()===ADMIN_EMAIL,ref=doc(db,"users",u.uid),s=await getDoc(ref),d=s.exists()?s.data():{},role=admin?"Admin":(d.role||"User");await setDoc(ref,{uid:u.uid,email:(u.email||"").toLowerCase(),name:u.displayName||d.name||"Coworx Member",photoURL:u.photoURL||d.photoURL||"",role,updatedAt:serverTimestamp()},{merge:true});return role;}
export async function loadPricing(){const s=await getDoc(doc(db,"settings","pricing"));return s.exists()?{...DEFAULT_PRICING,...s.data()} as typeof DEFAULT_PRICING:DEFAULT_PRICING;}
export async function savePricing(p:any){await setDoc(doc(db,"settings","pricing"),p,{merge:true});}
export async function assignManager(email:string,uid:string){const e=email.trim().toLowerCase();await setDoc(doc(db,"roleAssignments",emailKey(e)),{email:e,role:"Manager",status:"pending",assignedBy:uid,assignedAt:serverTimestamp()});const q=await getDocs(query(collection(db,"users"),where("email","==",e),limit(1)));if(!q.empty)await addDoc(collection(db,"notifications"),{recipientUid:q.docs[0].id,title:"Manager invitation",message:"An admin has invited you to become a Coworx Central Manager. Sign in and accept the invitation.",read:false,createdAt:serverTimestamp()});}
export async function acceptManager(a:any,uid:string){await updateDoc(doc(db,"roleAssignments",a.id),{status:"accepted",acceptedAt:serverTimestamp()});await updateDoc(doc(db,"users",uid),{role:"Manager"});}
export async function createOffer(data:any,uid:string){await addDoc(collection(db,"offers"),{...data,value:Number(data.value),targetEmail:data.targetType==="email"?data.targetEmail.trim().toLowerCase():"",active:true,createdBy:uid,createdAt:serverTimestamp()});}
export async function confirmBooking(id:string,uid:string){await updateDoc(doc(db,"bookings",id),{status:"Confirmed",confirmedBy:uid,confirmedAt:serverTimestamp(),expiresAt:null});await updateDoc(doc(db,"bookingLocks",id),{status:"Confirmed",confirmedBy:uid,confirmedAt:serverTimestamp(),expiresAt:null});}

export async function createBooking(input:{date:string;space:Space;inventoryId:string;label:string;userId:string;userEmail:string;customerEmail?:string;createdByRole?:string;walkIn?:boolean;start?:string;end?:string;base:number;discount:number;total:number;offerId?:string|null;status?:"Pending"|"Confirmed"}){
  const startKey=input.start||"day";
  const key=`${input.date}_${input.inventoryId}_${startKey}`.replace(/[^a-zA-Z0-9_-]/g,"-");
  const bookingRef=doc(db,"bookings",key);
  const lockRef=doc(db,"bookingLocks",key);
  const expiresAt=Timestamp.fromMillis(Date.now()+15*60*1000);
  const finalStatus=input.status||"Pending";
  await runTransaction(db,async tx=>{
    const lock=await tx.get(lockRef);
    if(lock.exists()){
      const ld:any=lock.data();
      const lockActive=ld.status==="Confirmed" || (ld.status==="Pending" && (ld.expiresAt?.toMillis?.()||0)>Date.now());
      if(lockActive) throw Error("That seat or time slot is already booked.");
    }
    const payload=clean({...input,status:finalStatus,expiresAt:finalStatus==="Confirmed"?null:expiresAt,createdAt:serverTimestamp()});
    const lockPayload=clean({bookingId:key,inventoryId:input.inventoryId,date:input.date,start:input.start||null,end:input.end||null,userId:input.userId,status:finalStatus,expiresAt:finalStatus==="Confirmed"?null:expiresAt,updatedAt:serverTimestamp()});
    tx.set(lockRef,lockPayload);
    tx.set(bookingRef,payload);
  });
  return {id:key,expiresAt};
}
