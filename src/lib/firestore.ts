import {addDoc,arrayRemove,arrayUnion,collection,doc,getDoc,getDocs,limit,onSnapshot,query,serverTimestamp,setDoc,Timestamp,updateDoc,where,runTransaction} from "firebase/firestore";
import {db} from "../firebase";
import {ADMIN_EMAILS,DEFAULT_PRICING,Offer,Booking,Space,emailKey,addDays,addHours} from "../pages/types";
const clean=(obj:any)=>Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined));
const sortNewest=(a:any,b:any)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0);
const lower=(v:any)=>String(v||"").trim().toLowerCase();
export function watchUser(uid:string,_email:string,cb:(b:Booking[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"bookings"),where("userId","==",uid),limit(500)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()} as Booking)).sort(sortNewest)),e=>onError?.(e));}
export async function backfillUserBookings(_uid:string){return;}
export function watchAllBookings(cb:(b:Booking[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"bookings"),limit(500)),s=>{cb(s.docs.map(d=>({id:d.id,...d.data()} as Booking)).sort(sortNewest));void cleanupExpiredHolds().catch(()=>{});},e=>onError?.(e));}
export function watchPendingBookings(cb:(b:Booking[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"bookings"),where("status","==","Pending"),limit(500)),s=>{cb(s.docs.map(d=>({id:d.id,...d.data()} as Booking)).sort(sortNewest));void cleanupExpiredHolds().catch(()=>{});},e=>onError?.(e));}
export function watchBookingLocks(date:string,cb:(locks:any[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"bookingLocks"),where("date","==",date),limit(500)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))),e=>onError?.(e));}
export function watchOffers(email:string,cb:(o:Offer[])=>void){return onSnapshot(query(collection(db,"offers"),where("active","==",true),limit(100)),s=>{const e=lower(email);cb(s.docs.map(d=>({id:d.id,...d.data()} as Offer)).filter(o=>o.targetType==="all"||lower(o.targetEmail)===e));});}
export function watchRoleAssignment(email:string,cb:(a:any)=>void){return onSnapshot(doc(db,"roleAssignments",emailKey(email)),s=>cb(s.exists()?{id:s.id,...s.data()}:null));}
export function watchUsers(cb:(u:any[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"users"),limit(500)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})).sort((a:any,b:any)=>(a.name||a.email||"").localeCompare(b.name||b.email||""))),e=>onError?.(e));}
export function watchAdmins(cb:(emails:string[])=>void,onError?:(e:any)=>void){return onSnapshot(doc(db,"settings","admins"),s=>{const stored=s.exists()&&Array.isArray(s.data().emails)?s.data().emails:[];cb([...new Set([...ADMIN_EMAILS,...stored].map(lower))]);},e=>onError?.(e));}
export function watchAdminLogs(cb:(logs:any[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"adminLogs"),limit(500)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})).sort(sortNewest)),e=>onError?.(e));}
export function watchNotifications(uid:string,cb:(items:any[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"notifications"),where("recipientUid","==",uid),limit(100)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})).sort(sortNewest)),e=>onError?.(e));}
export function watchResourceBlocks(date:string,cb:(items:any[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"resourceBlocks"),where("date","==",date),limit(200)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))),e=>onError?.(e));}
export function watchResourceBlocksRange(dates:string[],cb:(items:any[])=>void,onError?:(e:any)=>void){
  const uniq=[...new Set(dates)].filter(Boolean);
  if(uniq.length<=1)return watchResourceBlocks(uniq[0]||"",cb,onError);
  const chunks:string[][]=[];for(let i=0;i<uniq.length;i+=10)chunks.push(uniq.slice(i,i+10));
  const results:Record<number,any[]>={};
  const unsubs=chunks.map((chunk,idx)=>onSnapshot(query(collection(db,"resourceBlocks"),where("date","in",chunk),limit(500)),s=>{results[idx]=s.docs.map(d=>({id:d.id,...d.data()}));cb(Object.values(results).flat());},e=>onError?.(e)));
  return()=>unsubs.forEach(u=>u());
}
export function watchCoupons(cb:(items:any[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"coupons"),limit(200)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})).sort(sortNewest)),e=>onError?.(e));}
export function watchMembershipPlans(cb:(items:any[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"membershipPlans"),limit(100)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))),e=>onError?.(e));}
export function watchAddons(cb:(items:any[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"addons"),limit(100)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))),e=>onError?.(e));}
export async function getUserByEmail(email:string):Promise<any|null>{const e=lower(email),q=await getDocs(query(collection(db,"users"),where("email","==",e),limit(1)));return q.empty?null:{id:q.docs[0].id,...q.docs[0].data()};}
export async function createCustomerProfile(data:any,actorUid:string,actorEmail:string=""){const email=lower(data.email);if(!email.includes("@"))throw Error("Enter a valid customer email.");const existing=await getUserByEmail(email);const customerData={name:String(data.name||existing?.name||email.split("@")[0]).trim(),phone:String(data.phone||existing?.phone||"").trim(),gender:String(data.gender||existing?.gender||"").trim(),dob:String(data.dob||existing?.dob||"").trim(),profession:String(data.profession||existing?.profession||"").trim()};if(existing?.id){await updateDoc(doc(db,"users",existing.id),clean({...customerData,updatedAt:serverTimestamp()}));const verified=await getDoc(doc(db,"users",existing.id));if(!verified.exists())throw Error("Customer profile could not be verified after saving.");return {...existing,...customerData};}const ref=doc(db,"users",emailKey(email));const payload=clean({uid:ref.id,email,...customerData,role:"User",createdFrom:"staff_walk_in",createdByUid:actorUid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await setDoc(ref,payload,{merge:true});const verified=await getDoc(ref);if(!verified.exists())throw Error("Customer profile could not be verified after saving.");await writeOperationLog("CREATE_CUSTOMER",actorUid,actorEmail||actorUid,ref.id,`${email} · ${payload.name}`);return {id:ref.id,...(verified.data()||{})};}
export async function loadUserProfile(uid:string):Promise<any|null>{if(!uid)return null;const s=await getDoc(doc(db,"users",uid));return s.exists()?{id:s.id,...s.data()}:null;}
async function adminEmails(){try{const s=await getDoc(doc(db,"settings","admins"));const stored=s.exists()&&Array.isArray(s.data().emails)?s.data().emails:[];return [...new Set([...ADMIN_EMAILS,...stored].map(lower))];}catch{return ADMIN_EMAILS.map(lower);}}
async function writeAdminLog(action:string,targetEmail:string,targetRole:string,actorUid:string,actorEmail:string,details?:string){await addDoc(collection(db,"adminLogs"),clean({action,targetEmail:lower(targetEmail),targetRole,performedByUid:actorUid,performedByEmail:lower(actorEmail),details:details||"",createdAt:serverTimestamp()}));}
export async function writeOperationLog(action:string,actorUid:string,actorEmail:string,target:string,details:string){await addDoc(collection(db,"adminLogs"),clean({action,target,performedByUid:actorUid,performedByEmail:lower(actorEmail),details,createdAt:serverTimestamp()}));}
export async function ensureUser(u:any){const email=lower(u.email),admins=await adminEmails(),ref=doc(db,"users",u.uid),s=await getDoc(ref),d=s.exists()?s.data():{},role=admins.includes(email)?"Admin":(d.role||"User");await setDoc(ref,{uid:u.uid,email,name:u.displayName||d.name||email.split("@")[0],photoURL:u.photoURL||d.photoURL||"",role,updatedAt:serverTimestamp()},{merge:true});return role;}
export async function saveUserProfile(uid:string,data:any){await updateDoc(doc(db,"users",uid),clean({...data,updatedAt:serverTimestamp()}));}
export async function updateCustomer(uid:string,data:any,actorUid:string,actorEmail:string){await updateDoc(doc(db,"users",uid),clean({...data,updatedAt:serverTimestamp()}));await writeOperationLog("UPDATE_CUSTOMER",actorUid,actorEmail,uid,Object.entries(data).map(([k,v])=>`${k}=${v}`).join("; "));}
export async function setCustomerBlock(uid:string,blocked:boolean,reason:string,actorUid:string,actorEmail:string){await updateDoc(doc(db,"users",uid),{blocked,blockedReason:blocked?reason:"",updatedAt:serverTimestamp()});await writeOperationLog(blocked?"BLOCK_CUSTOMER":"UNBLOCK_CUSTOMER",actorUid,actorEmail,uid,blocked?reason:"Customer unblocked");}
export async function saveCustomerPreference(uid:string,preferredDesk:string,actorUid:string,actorEmail:string){await updateDoc(doc(db,"users",uid),{preferredDesk,updatedAt:serverTimestamp()});await writeOperationLog("SAVE_DESK_PREFERENCE",actorUid,actorEmail,uid,preferredDesk);}
export async function loadPricing(){const s=await getDoc(doc(db,"settings","pricing"));if(!s.exists())return DEFAULT_PRICING;const raw:any=s.data();return {...DEFAULT_PRICING,...raw,conference_hourly:Number(raw.conference_hourly??raw.conference_slot??DEFAULT_PRICING.conference_hourly)};}
export async function savePricing(p:any){const next:any={...p};delete next.conference_slot;delete next.cubicle_basic;delete next.cubicle_premium;await setDoc(doc(db,"settings","pricing"),next,{merge:true});}
export async function loadDeskPricing(date:string,defaults:any){const s=await getDoc(doc(db,"settings","deskPricing"));const data:any=s.exists()?s.data():{};const base:any={};for(let n=1;n<=22;n++){const id=`D${String(n).padStart(2,"0")}`;base[id]=[2,3,9,15,22].includes(n)?Number(defaults[id]??DEFAULT_PRICING.desk_premium):Number(defaults[id]??DEFAULT_PRICING.desk_basic);}return {...base,...(data[date]||{})};}
export async function saveDeskPricing(date:string,prices:any){await setDoc(doc(db,"settings","deskPricing"),{[date]:prices},{merge:true});}
export async function loadWifi(){const s=await getDoc(doc(db,"settings","wifi"));return s.exists()?s.data():{ssid:"",password:"",note:""};}
export async function saveWifi(data:any){await setDoc(doc(db,"settings","wifi"),data,{merge:true});}
export async function loadUpi(){const s=await getDoc(doc(db,"settings","upi"));return s.exists()?s.data():{upiId:"",merchantName:"Coworx Central"};}
export async function saveUpi(data:any){await setDoc(doc(db,"settings","upi"),data,{merge:true});}
export async function loadCompanySettings(){const s=await getDoc(doc(db,"settings","company"));return s.exists()?{name:"Coworx Central",address:"Solapur City, Maharashtra",gstNumber:"",gstRate:18,invoicePrefix:"CC",phone:"",email:"",...s.data()}:{name:"Coworx Central",address:"Solapur City, Maharashtra",gstNumber:"",gstRate:18,invoicePrefix:"CC",phone:"",email:""};}
export async function saveCompanySettings(data:any){await setDoc(doc(db,"settings","company"),clean(data),{merge:true});}
export function watchHolidays(cb:(items:any[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"holidays"),limit(365)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})).filter((h:any)=>h.active!==false).sort((a:any,b:any)=>String(a.date).localeCompare(b.date))),e=>onError?.(e));}
export async function setHoliday(date:string,reason:string,uid:string){await setDoc(doc(db,"holidays",date),{date,reason,active:true,createdBy:uid,createdAt:serverTimestamp()},{merge:true});}
export async function removeHoliday(date:string,uid:string){await updateDoc(doc(db,"holidays",date),{active:false,updatedBy:uid,updatedAt:serverTimestamp()});}
export function watchBanners(cb:(items:any[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"banners"),limit(50)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})).sort(sortNewest)),e=>onError?.(e));}
export async function createBanner(data:any,uid:string){await addDoc(collection(db,"banners"),clean({...data,active:data.active!==false,createdBy:uid,createdAt:serverTimestamp()}));}
export async function updateBanner(id:string,data:any,uid:string){await updateDoc(doc(db,"banners",id),clean({...data,updatedBy:uid,updatedAt:serverTimestamp()}));}
export async function deleteBanner(id:string,uid:string){await updateDoc(doc(db,"banners",id),{active:false,updatedBy:uid,updatedAt:serverTimestamp()});}
export function watchEnquiries(cb:(items:any[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"enquiries"),limit(300)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})).sort(sortNewest)),e=>onError?.(e));}
export async function createEnquiry(data:any,uid:string){await addDoc(collection(db,"enquiries"),clean({...data,status:data.status||"New",source:data.source||"Staff",createdBy:uid,createdAt:serverTimestamp()}));}
export async function updateEnquiry(id:string,data:any,uid:string){await updateDoc(doc(db,"enquiries",id),clean({...data,updatedBy:uid,updatedAt:serverTimestamp()}));}
export function watchPricingRules(cb:(items:any[])=>void,onError?:(e:any)=>void){return onSnapshot(query(collection(db,"pricingRules"),limit(200)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})).filter((r:any)=>r.active!==false).sort(sortNewest)),e=>onError?.(e));}
export async function savePricingRule(data:any,uid:string){await addDoc(collection(db,"pricingRules"),clean({...data,createdBy:uid,active:true,createdAt:serverTimestamp()}));}
export async function deletePricingRule(id:string,uid:string){await updateDoc(doc(db,"pricingRules",id),{active:false,updatedBy:uid,updatedAt:serverTimestamp()});}
export async function loadPolicy(){const s=await getDoc(doc(db,"settings","policy"));return s.exists()?{maxAdvanceDays:60,businessStart:"09:00",businessEnd:"19:00",...s.data()}:{maxAdvanceDays:60,businessStart:"09:00",businessEnd:"19:00"};}
export async function savePolicy(data:any){await setDoc(doc(db,"settings","policy"),data,{merge:true});}
export async function loadOperationsSettings(){const s=await getDoc(doc(db,"settings","operations"));return s.exists()?s.data():{referralEnabled:true,referralRewardPercent:5,weekendMultiplier:1,peakMultiplier:1,notificationTemplates:{bookingConfirmation:"",paymentReminder:"",cancellation:"",checkIn:""}};}
export async function saveOperationsSettings(data:any){await setDoc(doc(db,"settings","operations"),data,{merge:true});}
export async function loadNotificationTemplates(){const s=await getDoc(doc(db,"settings","notificationTemplates"));return s.exists()?s.data():{bookingConfirmation:"Hello {name}, your Coworx Central booking is confirmed for {date}.",paymentReminder:"Hello {name}, your Coworx Central slot is held for 15 minutes. Please complete payment.",cancellation:"Hello {name}, your Coworx Central booking has been cancelled.",checkIn:"Hello {name}, your Coworx Central booking is ready for check-in."};}
export async function saveNotificationTemplates(data:any){await setDoc(doc(db,"settings","notificationTemplates"),data,{merge:true});}
export async function markNotificationRead(id:string){await updateDoc(doc(db,"notifications",id),{read:true});}
export async function assignManager(email:string,uid:string,actorEmail:string=""){const e=lower(email);await setDoc(doc(db,"roleAssignments",emailKey(e)),{email:e,role:"Manager",status:"pending",assignedBy:uid,assignedAt:serverTimestamp()});const q=await getDocs(query(collection(db,"users"),where("email","==",e),limit(1)));if(!q.empty)await addDoc(collection(db,"notifications"),{recipientUid:q.docs[0].id,title:"Manager invitation",message:"An admin has invited you to become a Coworx Central Manager. Sign in and accept the invitation.",read:false,createdAt:serverTimestamp()});if(actorEmail)await writeAdminLog("ADD_MANAGER",e,"Manager",uid,actorEmail,"Manager invitation created");}
export async function removeManager(email:string,uid:string,actorEmail:string=""){const e=lower(email);await updateDoc(doc(db,"roleAssignments",emailKey(e)),{status:"revoked",revokedBy:uid,revokedAt:serverTimestamp()}).catch(()=>{});const existing=await getUserByEmail(e);if(existing?.id)await updateDoc(doc(db,"users",existing.id),{role:"User",updatedAt:serverTimestamp()});if(actorEmail)await writeAdminLog("REMOVE_MANAGER",e,"Manager",uid,actorEmail,"Manager access removed");}
export async function acceptManager(a:any,uid:string){await updateDoc(doc(db,"roleAssignments",a.id),{status:"accepted",acceptedAt:serverTimestamp()});await updateDoc(doc(db,"users",uid),{role:"Manager"});}
export async function addAdmin(email:string,uid:string,actorEmail:string){const e=lower(email);if(!e.includes("@"))throw Error("Enter a valid admin email.");const current=await adminEmails();await setDoc(doc(db,"settings","admins"),{emails:[...new Set([...current,e])],updatedAt:serverTimestamp()},{merge:true});const existing=await getUserByEmail(e);if(existing?.id)await updateDoc(doc(db,"users",existing.id),{role:"Admin",updatedAt:serverTimestamp()});await writeAdminLog("ADD_ADMIN",e,"Admin",uid,actorEmail,"Admin access granted");}
export async function removeAdmin(email:string,uid:string,actorEmail:string){const e=lower(email);if(ADMIN_EMAILS.map(lower).includes(e))throw Error("The two owner admins are protected and cannot be removed.");const current=await adminEmails();await setDoc(doc(db,"settings","admins"),{emails:current.filter(x=>x!==e),updatedAt:serverTimestamp()},{merge:true});const existing=await getUserByEmail(e);if(existing?.id)await updateDoc(doc(db,"users",existing.id),{role:"User",updatedAt:serverTimestamp()});await writeAdminLog("REMOVE_ADMIN",e,"Admin",uid,actorEmail,"Admin access removed");}
export async function createOffer(data:any,uid:string){await addDoc(collection(db,"offers"),{...data,value:Number(data.value),targetEmail:data.targetType==="email"?lower(data.targetEmail):"",active:true,createdBy:uid,createdAt:serverTimestamp()});}
export async function createCoupon(data:any,uid:string){const code=String(data.code||"").trim().toUpperCase();if(!code)throw Error("Coupon code is required.");await setDoc(doc(db,"coupons",code),{code,...data,value:Number(data.value||0),active:data.active!==false,createdBy:uid,createdAt:serverTimestamp()},{merge:true});}
export async function toggleCoupon(id:string,active:boolean,uid:string){await updateDoc(doc(db,"coupons",id),{active,updatedBy:uid,updatedAt:serverTimestamp()});}
export async function createMembershipPlan(data:any,uid:string){await addDoc(collection(db,"membershipPlans"),clean({...data,price:Number(data.price||0),days:Number(data.days||0),deskDays:Number(data.deskDays||0),createdBy:uid,active:true,createdAt:serverTimestamp()}));}
export async function assignMembership(uid:string,plan:any,actorUid:string,actorEmail:string){await updateDoc(doc(db,"users",uid),{membershipId:plan.id,membershipName:plan.name,membershipRemaining:Number(plan.deskDays||plan.days||0),updatedAt:serverTimestamp()});await writeOperationLog("ASSIGN_MEMBERSHIP",actorUid,actorEmail,uid,`${plan.name} · remaining=${plan.deskDays||plan.days||0}`);}
export async function createAddon(data:any,uid:string){await addDoc(collection(db,"addons"),clean({...data,unitPrice:Number(data.unitPrice||0),active:data.active!==false,createdBy:uid,createdAt:serverTimestamp()}));}
export async function toggleAddon(id:string,active:boolean,uid:string){await updateDoc(doc(db,"addons",id),{active,updatedBy:uid,updatedAt:serverTimestamp()});}
export async function setResourceBlock(data:any,uid:string){const id=`${data.date}_${data.inventoryId}`.replace(/[^a-zA-Z0-9_-]/g,"-");await setDoc(doc(db,"resourceBlocks",id),clean({...data,active:data.active!==false,updatedBy:uid,updatedAt:serverTimestamp()}),{merge:true});}
export async function removeResourceBlock(id:string,uid:string){await updateDoc(doc(db,"resourceBlocks",id),{active:false,updatedBy:uid,updatedAt:serverTimestamp()});}
export async function saveShift(data:any,uid:string){await setDoc(doc(db,"settings","shifts"),{...data,updatedBy:uid,updatedAt:serverTimestamp()},{merge:true});}
export async function savePermissions(data:any,uid:string){await setDoc(doc(db,"settings","permissions"),{...data,updatedByuid,updatedAt:serverTimestamp()},{merge:true});}
export async function loadSetting(id:string,defaults:any={}){const s=await getDoc(doc(db,"settings",id));return s.exists()?{...defaults,...s.data()}:defaults;}
export async function confirmBooking(id:string,uid:string,staffDiscount=0,paymentReceived?:number,paymentMethod?:string,paymentRef?:string){const ref=doc(db,"bookings",id),snap=await getDoc(ref);if(!snap.exists())throw Error("Booking not found.");const d:any=snap.data(),sd=Math.max(0,Number(staffDiscount)||0),total=Math.max(0,Number(d.base||0)-Number(d.discount||0)-sd),received=paymentReceived===undefined?total:Number(paymentReceived);const paymentStatus=received>=total?"Paid":received>0?"Partially Paid":"Pending",invoiceNumber=d.invoiceNumber||`CC-${new Date().getFullYear()}-${id.slice(0,8).toUpperCase()}`;await updateDoc(ref,clean({status:"Confirmed",staffDiscount:sd,total,confirmedBy:uid,confirmedAt:serverTimestamp(),expiresAt:null,paymentReceived:received,paymentMethod:paymentMethod||"Other",paymentRef:paymentRef||"",paymentStatus,invoiceNumber,refundStatus:"Not Requested"}));for(const lockId of (d.lockIds||[id])){const lock=doc(db,"bookingLocks",lockId),ls=await getDoc(lock);if(ls.exists())await updateDoc(lock,{status:"Confirmed",staffDiscount:sd,total,confirmedBy:uid,confirmedAt:serverTimestamp(),expiresAt:null});}}
export async function cancelBooking(id:string,uid:string,reason="Customer requested cancellation"){const ref=doc(db,"bookings",id),snap=await getDoc(ref);if(!snap.exists())throw Error("Booking not found.");const d:any=snap.data(),refundAmount=Number(d.paymentReceived||0)>0?Number(d.paymentReceived):0;await updateDoc(ref,{status:"Cancelled",revokedBy:uid,revokedAt:serverTimestamp(),expiresAt:null,cancellationReason:reason,refundStatus:refundAmount>0?"Pending":"Not Requested",refundAmount});for(const lockId of (d.lockIds||[id])){const lock=doc(db,"bookingLocks",lockId),ls=await getDoc(lock);if(ls.exists())await updateDoc(lock,{status:"Cancelled",revokedBy:uid,revokedAt:serverTimestamp(),expiresAt:null});}}
export async function revokeBooking(id:string,uid:string){const ref=doc(db,"bookings",id),snap=await getDoc(ref);if(!snap.exists())throw Error("Booking not found.");const d:any=snap.data();await updateDoc(ref,{status:"Cancelled",revokedBy:uid,revokedAt:serverTimestamp(),expiresAt:null,cancellationReason:"Request revoked before payment",refundStatus:"Not Requested"});for(const lockId of (d.lockIds||[id])){const lock=doc(db,"bookingLocks",lockId),ls=await getDoc(lock);if(ls.exists())await updateDoc(lock,{status:"Cancelled",revokedBy:uid,revokedAt:serverTimestamp(),expiresAt:null});}}
export async function updateRefund(id:string,uid:string,status:string,amount?:number,reference?:string){await updateDoc(doc(db,"bookings",id),clean({refundStatus:status,refundAmount:amount===undefined?undefined:Number(amount),refundReference:reference||"",refundProcessedBy:uid,refundProcessedAt:serverTimestamp(),paymentStatus:status==="Processed"?"Refunded":"Refund Pending"}));}
export async function markCheckIn(id:string){await updateDoc(doc(db,"bookings",id),{checkedInAt:serverTimestamp()});}
export async function markCheckOut(id:string){await updateDoc(doc(db,"bookings",id),{checkedOutAt:serverTimestamp()});}
export async function extendBooking(id:string,opts:{extraHours?:number;extraDays?:number;uid:string}){
  const ref=doc(db,"bookings",id);
  const snap=await getDoc(ref);
  if(!snap.exists()) throw Error("Booking not found.");
  const d:any=snap.data();
  if(d.status!=="Confirmed") throw Error("Only confirmed bookings can be extended.");
  const extraHours=Math.max(0,Math.floor(opts.extraHours||0));
  const extraDays=Math.max(0,Math.floor(opts.extraDays||0));
  if(!extraHours&&!extraDays) throw Error("Choose an extension.");
  const isDesk=d.space==="desk"||d.space==="cubicle";
  const inv=d.inventoryIds?.length?d.inventoryIds:[d.inventoryId];
  const dates=d.dates?.length?d.dates:[d.date];
  const lockRefs:any[]=[];
  const lockData:any[]=[];
  let baseAdd=0;
  if(isDesk){
    for(let day=1;day<=extraDays;day++){
      const newDay=addDays(d.endDate||d.date,day);
      for(const inventoryId of inv){
        const lockId=`${newDay}_${inventoryId}_day`;
        lockRefs.push(doc(db,"bookingLocks",lockId));
        lockData.push({bookingId:id,userId:d.userId,inventoryId,date:newDay,start:null,end:null,status:"Confirmed",expiresAt:null,updatedAt:serverTimestamp()});
      }
    }
    baseAdd=extraDays>0?Math.round(Number(d.base||0)/Math.max(1,Number(d.days||dates.length)))*extraDays:0;
  }else{
    if(extraDays>0) throw Error("Timed rooms can be extended by hours only.");
    const end=d.end||d.start||"09:00";
    const day=d.endDate||d.date;
    for(let i=0;i<extraHours;i++){
      const slot=addHours(end,i);
      if(slot>="19:00") throw Error("Extension cannot go past 7:00 PM.");
      const lockId=`${day}_${d.space}_${slot}`;
      lockRefs.push(doc(db,"bookingLocks",lockId));
      lockData.push({bookingId:id,userId:d.userId,inventoryId:d.space,date:day,start:slot,end:addHours(slot,1),status:"Confirmed",expiresAt:null,updatedAt:serverTimestamp()});
    }
    baseAdd=Math.round((Number(d.base||0)/Math.max(1,Number(d.durationHours||1)))*extraHours);
  }
  await runTransaction(db,async tx=>{
    const locks=await Promise.all(lockRefs.map(r=>tx.get(r)));
    for(const lock of locks){
      if(lock.exists()){
        const x:any=lock.data();
        const active=x.status==="Confirmed"||(x.status==="Pending"&&(x.expiresAt?.toMillis?.()||0)>Date.now());
        if(active) throw Error("The extension slot is already booked.");
      }
    }
    for(let i=0;i<lockRefs.length;i++) tx.set(lockRefs[i],lockData[i]);
    const nextDates=isDesk?[...(d.dates||dates),...Array.from({length:extraDays},(_,i)=>addDays(d.endDate||d.date,i+1))]:dates;
    let finalEndDate=d.endDate||d.date;
    let finalEnd=d.end;
    let finalDays=d.days;
    let finalDuration=d.durationHours;
    if(isDesk){
      finalEndDate=addDays(d.endDate||d.date,extraDays);
      finalDays=Number(d.days||dates.length)+extraDays;
    }else{
      finalEnd=addHours(d.end||d.start||"09:00",Number(d.durationHours||1)+extraHours);
      finalDuration=Number(d.durationHours||0)+extraHours;
    }
    const updateData:any={dates:nextDates,endDate:finalEndDate,days:finalDays,durationHours:isDesk?d.durationHours:finalDuration,base:Number(d.base||0)+baseAdd,total:Number(d.total||0)+baseAdd,extensionTotal:Number(d.extensionTotal||0)+baseAdd,updatedAt:serverTimestamp(),lastExtendedBy:opts.uid};
    if(!isDesk) updateData.end=finalEnd;
    tx.update(ref,updateData);
  });
}
export async function cleanupExpiredHolds(){const now=Date.now(),q=await getDocs(query(collection(db,"bookingLocks"),where("status","==","Pending"),limit(500))),expired=q.docs.filter(d=>{const t=d.data().expiresAt?.toMillis?.()||0;return t>0&&t<=now});await Promise.all(expired.map(d=>updateDoc(d.ref,{status:"Expired",expiresAt:null,updatedAt:serverTimestamp()})));const bq=await getDocs(query(collection(db,"bookings"),where("status","==","Pending"),limit(500))),expiredBookings=bq.docs.filter(d=>{const t=d.data().expiresAt?.toMillis?.()||0;return t>0&&t<=now});await Promise.all(expiredBookings.map(d=>updateDoc(d.ref,{status:"Expired",expiresAt:null,paymentStatus:"Pending",updatedAt:serverTimestamp()})));return expired.length+expiredBookings.length;}
export async function createBooking(input:{date:string;endDate?:string;days?:number;dates?:string[];space:Space;inventoryId:string;inventoryIds?:string[];lockKeys?:string[];label:string;userId:string;userEmail:string;customerName?:string;customerEmail?:string;customerPhone?:string;createdByRole?:string;walkIn?:boolean;start?:string;end?:string;durationHours?:number;base:number;discount:number;total:number;offerId?:string|null;couponCode?:string;membershipId?:string;referralCode?:string;status?:"Pending"|"Confirmed";addons?:any[];amenities?:string[];notes?:string}){const dates=input.dates?.length?input.dates:[input.date],ids=input.inventoryIds?.length?input.inventoryIds:[input.inventoryId],timed=!!input.start,hoursPerDay=timed?Math.max(1,Math.round((input.durationHours||1)/Math.max(1,dates.length))):1,generatedLockKeys:string[]=[],lockInventories:string[]=[];if(timed){for(const day of dates){for(let i=0;i<hoursPerDay;i++){const [hh,mm]=(input.start||"09:00").split(":").map(Number),n=hh*60+mm+i*60,slot=`${String(Math.floor(n/60)%24).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;generatedLockKeys.push(`${day}_${input.space}_${slot}`);lockInventories.push(ids[0]);}}}else{for(const day of dates)for(const id of ids){generatedLockKeys.push(`${day}_${id}_day`);lockInventories.push(id);}}const finalLockKeys=input.lockKeys?.length?input.lockKeys:generatedLockKeys,bookingRef=doc(collection(db,"bookings")),expiresAt=Timestamp.fromMillis(Date.now()+15*60*1000),finalStatus=input.status||"Pending";if(lockInventories.length!==finalLockKeys.length)throw Error("Booking configuration is invalid.");await runTransaction(db,async tx=>{const lockRefs=finalLockKeys.map(k=>doc(db,"bookingLocks",k.replace(/[^a-zA-Z0-9_-]/g,"-"))),locks=await Promise.all(lockRefs.map(r=>tx.get(r)));const conflicts:{inventoryId:string;date:string}[]=[];for(let i=0;i<locks.length;i++){const lock=locks[i];if(lock.exists()){const ld:any=lock.data(),active=ld.status==="Confirmed"||(ld.status==="Pending"&&(ld.expiresAt?.toMillis?.()||0)>Date.now());if(active)conflicts.push({inventoryId:lockInventories[i],date:(finalLockKeys[i].split("_")[0])||input.date});}}if(conflicts.length){const names=[...new Set(conflicts.map(c=>c.inventoryId.replace(/^desk-/,"")))];const err:any=new Error(`${names.join(", ")} ${names.length===1?"is":"are"} already booked for ${[...new Set(conflicts.map(c=>c.date))].join(", ")}. It has been removed from your selection — please review and try again.`);err.conflicts=conflicts;throw err;}const payload=clean({...input,dates,endDate:input.endDate||dates[dates.length-1],days:input.days||dates.length,inventoryIds:ids,lockIds:lockRefs.map(r=>r.id),status:finalStatus,expiresAt:finalStatus==="Confirmed"?null:expiresAt,paymentStatus:finalStatus==="Confirmed"?"Paid":"Pending",refundStatus:"Not Requested",createdAt:serverTimestamp()});tx.set(bookingRef,payload);for(let i=0;i<lockRefs.length;i++){const k=finalLockKeys[i],parts=k.split("_"),day=parts.shift()||input.date,rest=parts.join("_"),slot=timed?rest:null;tx.set(lockRefs[i],clean({bookingId:bookingRef.id,inventoryId:lockInventories[i],date:day,start:slot,end:timed?input.end||addHours(slot||"09:00",1):null,userId:input.userId,status:finalStatus,expiresAt:finalStatus==="Confirmed"?null:expiresAt,updatedAt:serverTimestamp()}));}});return{id:bookingRef.id,expiresAt};}
