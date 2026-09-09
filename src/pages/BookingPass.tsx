import {useEffect,useState} from "react";
import QRCode from "qrcode";
import {CheckCircle2,X} from "lucide-react";
import coworxLogoFull from "../assets/coworx-logo-full.png";
import {spaceLabel} from "./types";
import "./booking-pass.css";

// Reuses the existing booking record as-is (id, invoiceNumber, customer, space, date, total,
// status). Nothing new is written to Firestore here — this is a read-only presentation of
// data that already exists on the booking.
export function BookingPassModal({booking,onClose,staffView=false}:{booking:any;onClose:()=>void;staffView?:boolean}){
 const [qr,setQr]=useState("");
 const reference=booking.invoiceNumber||String(booking.id||"").slice(0,10).toUpperCase();
 useEffect(()=>{
  let cancelled=false;
  const payload=JSON.stringify({app:"coworx-central",id:booking.id,ref:reference,name:booking.customerName||booking.customerEmail||booking.userEmail||"",space:booking.space,date:booking.date,total:booking.total,status:booking.status});
  QRCode.toDataURL(payload,{margin:1,width:280,color:{dark:"#151515",light:"#ffffff"}}).then(url=>{if(!cancelled)setQr(url)}).catch(()=>{});
  return()=>{cancelled=true};
 },[booking.id]);
 const isDesk=booking.space==="desk"||booking.space==="cubicle";
 return <div className="modalBackdrop passBackdrop" onClick={onClose}>
  <div className="passCard" onClick={e=>e.stopPropagation()}>
   <div className="passHead"><img src={coworxLogoFull} alt="Coworx Central"/><button className="ghost small" onClick={onClose} aria-label="Close pass"><X size={16}/></button></div>
   {staffView&&<div className="passStaffBadge"><CheckCircle2 size={13}/> STAFF VERIFICATION VIEW</div>}
   <div className="passStatusRow"><span className={`status ${String(booking.status||"").toLowerCase()}`}>{booking.status}</span><span className="passRef">#{reference}</span></div>
   <div className="passQrWrap">{qr?<img src={qr} alt="Booking QR code" className="passQr"/>:<div className="passQrLoading">Generating pass…</div>}</div>
   <div className="passDetails">
    <div><small>CUSTOMER</small><b>{booking.customerName||booking.customerEmail||booking.userEmail||"Coworx Member"}</b></div>
    <div><small>SERVICE</small><b>{booking.label||spaceLabel(booking.space)}</b></div>
    <div><small>DATE</small><b>{booking.date}{booking.endDate&&booking.endDate!==booking.date?` → ${booking.endDate}`:""}</b></div>
    {!isDesk&&booking.start&&<div><small>TIME</small><b>{booking.start}–{booking.end}</b></div>}
    <div><small>AMOUNT</small><b>₹{booking.total}</b></div>
   </div>
   <p className="passFooter">Show this pass at reception for check-in. Coworx Central · Solapur City · 9:00 AM–7:00 PM.</p>
  </div>
 </div>;
}
