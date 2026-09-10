import { useEffect, useMemo, useState } from "react";
import { Coffee, FileText, CheckCircle2, WalletCards } from "lucide-react";
import { money } from "../lib/business";
import {
  createServiceOrder,
  DEFAULT_SERVICE_PRICING,
  saveServicePricing,
  ServicePricing,
  updateServiceOrder,
  watchAllServiceOrders,
  watchMyServiceOrders,
  watchServicePricing,
} from "../lib/serviceOrders";
import { localToday } from "../pages/types";

export function CustomerServiceOrders({user,bookings,onFlash}:any){
  const [orders,setOrders]=useState<any[]>([]),[pricing,setPricing]=useState<ServicePricing>(DEFAULT_SERVICE_PRICING),[printing,setPrinting]=useState(1),[busy,setBusy]=useState(false);
  useEffect(()=>{const a=watchMyServiceOrders(user.uid,setOrders,e=>onFlash(e.message)),b=watchServicePricing(setPricing,e=>onFlash(e.message));return()=>{a();b();};},[user.uid]);
  const today=localToday();
  const eligible=useMemo(()=>bookings.filter((b:any)=>b.status==="Confirmed"&&(b.dates||[b.date]).includes(today)&&b.attendanceDate===today&&b.checkedInAt&&!b.checkedOutAt),[bookings,today]);
  const booking=eligible[0];
  const usedFree=booking?orders.some(o=>o.bookingId===booking.id&&o.category==="Beverage"&&o.complimentary):false;
  const place=async(item:"Tea"|"Coffee"|"Printing",qty=1)=>{if(!booking)return;setBusy(true);try{await createServiceOrder(booking.id,item,qty);onFlash(`${item} order sent to the front desk.`);}catch(e:any){onFlash(e.message);}finally{setBusy(false);}};
  return <section className="surface serviceOrderPanel"><div className="sectionHeading"><div><span className="eyebrow">ORDER SERVICES</span><h3>Tea, coffee & printing</h3><p>Available after you check in. Your first tea or coffee for each booking is complimentary; later drinks use the current rates.</p></div><Coffee/></div>
    {!booking?<p className="noticeBox">Check in at reception during today’s active booking to order services.</p>:<><p className="noticeBox">Ordering for <b>{booking.label}</b>. {usedFree?`Tea ${money(pricing.tea)} · Coffee ${money(pricing.coffee)}.`:"Your next tea or coffee is complimentary."}</p><div className="buttonRow"><button className="ghost" disabled={busy} onClick={()=>place("Tea")}><Coffee size={17}/>Tea {usedFree?money(pricing.tea):"Free"}</button><button className="ghost" disabled={busy} onClick={()=>place("Coffee")}><Coffee size={17}/>Coffee {usedFree?money(pricing.coffee):"Free"}</button><label className="servicePrinting"><FileText size={17}/>Printing pages<input type="number" min="1" max="200" value={printing} onChange={e=>setPrinting(Math.max(1,Math.min(200,Math.floor(Number(e.target.value)||1))))}/><button className="ghost small" disabled={busy} onClick={()=>place("Printing",printing)}>Order · {money(printing*pricing.printing)}</button></label></div></>}
    {orders.length>0&&<details><summary>My recent service orders</summary><div className="catalogList">{orders.slice(0,10).map(o=><div className="catalogItem" key={o.id}><span><b>{o.item}{o.qty>1?` × ${o.qty}`:""}</b><small>{o.date} · {o.status}</small></span><strong>{o.complimentary?"Complimentary":money(o.total)}</strong></div>)}</div></details>}
  </section>;
}

export function StaffServiceOrders({can,onFlash}:any){
  const [orders,setOrders]=useState<any[]>([]),[pricing,setPricing]=useState<ServicePricing>(DEFAULT_SERVICE_PRICING),[draft,setDraft]=useState<ServicePricing>(DEFAULT_SERVICE_PRICING),[refs,setRefs]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false);
  useEffect(()=>{const a=watchAllServiceOrders(setOrders,e=>onFlash(e.message)),b=watchServicePricing(p=>{setPricing(p);setDraft(p);},e=>onFlash(e.message));return()=>{a();b();};},[]);
  const active=orders.filter(o=>!["Paid","Cancelled"].includes(o.status));
  const change=async(o:any,status:any)=>{setBusy(true);try{await updateServiceOrder(o.id,status,refs[o.id]||"");onFlash(status==="Fulfilled"&&o.total>0?`Order fulfilled. Collect ${money(o.total)} and then mark paid.`:`Order marked ${String(status).toLowerCase()}.`);}catch(e:any){onFlash(e.message);}finally{setBusy(false);}};
  return <section className="surface staffServiceOrders"><div className="sectionHeading"><div><span className="eyebrow">SERVICE ORDERS</span><h3>Front-desk fulfilment queue</h3><p>Accept, fulfil and close tea, coffee and printing requests.</p></div><Coffee/></div>
    {can("paymentsManage")&&<details><summary>Admin service pricing</summary><div className="fieldGrid"><label>Tea ₹<input type="number" min="0" value={draft.tea} onChange={e=>setDraft({...draft,tea:Number(e.target.value)})}/></label><label>Coffee ₹<input type="number" min="0" value={draft.coffee} onChange={e=>setDraft({...draft,coffee:Number(e.target.value)})}/></label><label>Printing / page ₹<input type="number" min="0" value={draft.printing} onChange={e=>setDraft({...draft,printing:Number(e.target.value)})}/></label></div><button className="primary small" disabled={busy} onClick={async()=>{setBusy(true);try{await saveServicePricing(draft);onFlash("Service prices saved.");}catch(e:any){onFlash(e.message);}finally{setBusy(false);}}}>Save service prices</button></details>}
    <div className="catalogList">{active.map(o=><div className="catalogItem serviceOrderRow" key={o.id}><div><b>{o.customerName} · {o.item}{o.qty>1?` × ${o.qty}`:""}</b><small>{o.date} · Booking {String(o.bookingId).slice(0,8).toUpperCase()} · {o.status}</small><span>{o.complimentary?"Complimentary":money(o.total)}</span></div><div className="crmButtons">{o.status==="Requested"&&<button className="ghost small" disabled={busy} onClick={()=>change(o,"Accepted")}>Accept</button>}{["Requested","Accepted"].includes(o.status)&&<button className="primary small" disabled={busy} onClick={()=>change(o,"Fulfilled")}><CheckCircle2 size={15}/>Fulfilled</button>}{o.status==="Fulfilled"&&Number(o.total)>0&&<><input value={refs[o.id]||""} onChange={e=>setRefs({...refs,[o.id]:e.target.value})} placeholder="Payment ref / cash"/><button className="primary small" disabled={busy||!refs[o.id]?.trim()} onClick={()=>change(o,"Paid")}><WalletCards size={15}/>Mark paid</button></>}{o.status==="Fulfilled"&&Number(o.total)===0&&<button className="primary small" disabled={busy} onClick={()=>change(o,"Paid")}>Close complimentary order</button>}</div></div>)}{!active.length&&<p className="muted">No service orders waiting.</p>}</div>
  </section>;
}
