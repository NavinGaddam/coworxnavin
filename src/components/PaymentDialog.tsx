import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import Dialog from "./Dialog";
import { collectPayment, emptyTender, tenderTotal } from "../lib/finance";
import { balance, money } from "../lib/business";
export default function PaymentDialog({booking:b,canDiscount=false,onClose,onSaved}:any) {
  const [tender,setTender]=useState({...emptyTender(),upi:balance(b)}),[discount,setDiscount]=useState(Number(b.staffDiscount || 0)),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const total=Math.max(0,Number(b.total)+Number(b.staffDiscount || 0)-discount), received=Number(b.paymentReceived || 0), amount=Number(tender.cash)+Number(tender.upi)+Number(tender.other), due=Math.round((total-received)*100)/100;
  const exact=Math.round(amount*100)===Math.round(due*100);
  const save=async()=>{setError("");setBusy(true);try{tenderTotal(tender);if(!verified)throw Error("Verify the money received before confirming.");if(!exact)throw Error(`Full advance is required. Enter exactly ${money(due)}.`);const receipt=await collectPayment(b.id,tender,discount,received);onSaved(receipt);}catch(e:any){setError(e.message);}finally{setBusy(false);}};
  const footer=<div className="formActions"><button className="ghost" disabled={busy} onClick={onClose}>{b.status==="Pending"?"Keep on hold":"Cancel"}</button><button className="primary" disabled={busy||!verified||!exact} onClick={save}><CheckCircle2 size={18}/>{busy?"Saving payment…":b.status==="Pending"?"Receive full payment & confirm":"Save full payment"}</button></div>;
  return <Dialog footer={footer} title={b.status==="Pending"?"Full payment & confirmation":"Collect full balance"} onClose={()=>!busy&&onClose()}>
    <p>{b.customerName || b.customerEmail} · {b.label}</p>
    <div className="paymentAmount"><span>Full amount due now</span><strong>{money(due)}</strong><small>{money(received)} received · {money(total)} total</small></div>
    <p className="noticeBox">All Coworx bookings, including consecutive passes, require 100% advance payment before confirmation and entry.</p>
    {canDiscount&&b.status==="Pending"&&<label>Agreed staff discount ₹<input type="number" min="0" step="0.01" value={discount} onChange={e=>{setDiscount(Number(e.target.value));setVerified(false);}}/></label>}
    <div className="fieldGrid paymentFields">{(["cash","upi","other"] as const).map(key=><label key={key}>{key==="upi"?"UPI":key==="cash"?"Cash":"Other"} received ₹<input inputMode="decimal" type="number" min="0" step="0.01" value={tender[key]} onChange={e=>{setTender({...tender,[key]:Number(e.target.value)});setVerified(false);}}/></label>)}
    <label>UPI / payment reference<input value={tender.reference} onChange={e=>setTender({...tender,reference:e.target.value})} placeholder="Transaction reference"/></label></div>
    <p><strong>Receiving now: {money(amount)}</strong> · {exact?"Full amount entered":`Enter ${money(Math.max(0,due-amount))} more`}</p>
    <label className="checkLabel"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/><span>I verified the complete amount received, including any cash / UPI / other split.</span></label>
    <small><ShieldCheck size={15}/> This creates an auditable receipt. Payment-mode corrections require admin permission.</small>
    {error&&<p role="alert" className="inlineError">{error}</p>}
  </Dialog>;
}
