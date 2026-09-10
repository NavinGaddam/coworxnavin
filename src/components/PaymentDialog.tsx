import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import Dialog from "./Dialog";
import { collectPayment, emptyTender, tenderTotal } from "../lib/finance";
import { balance, money } from "../lib/business";
export default function PaymentDialog({booking:b,canDiscount=false,onClose,onSaved}:any) {
  const [tender,setTender]=useState({...emptyTender(),upi:balance(b)}),[discount,setDiscount]=useState(Number(b.staffDiscount || 0)),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const total=Math.max(0,Number(b.total)+Number(b.staffDiscount || 0)-discount), received=Number(b.paymentReceived || 0), amount=Number(tender.cash)+Number(tender.upi)+Number(tender.other), due=Math.round((total-received)*100)/100;
  const save=async()=>{setError("");setBusy(true);try{tenderTotal(tender);if(!verified)throw Error("Verify the money received before confirming.");const receipt=await collectPayment(b.id,tender,discount,received);onSaved(receipt);}catch(e:any){setError(e.message);}finally{setBusy(false);}};
  const footer=<div className="formActions"><button className="ghost" disabled={busy} onClick={onClose}>{b.status==="Pending"?"Keep on hold":"Cancel"}</button><button className="primary" disabled={busy||!verified||amount>due||amount<0} onClick={save}><CheckCircle2 size={18}/>{busy?"Saving payment…":b.status==="Pending"?"Receive & confirm":"Save payment"}</button></div>;
  return <Dialog footer={footer} title={b.status==="Pending"?"Payment & confirmation":"Collect pass balance"} onClose={()=>!busy&&onClose()}>
    <p>{b.customerName || b.customerEmail} · {b.label}</p>
    <div className="paymentAmount"><span>Amount due</span><strong>{money(due)}</strong><small>{money(received)} received · {money(total)} total</small></div>
    <p className="noticeBox">{b.passDays?`Consecutive pass · minimum advance ${money(Math.min(total,Number(b.minimumAdvance)))}. Balance due ${b.balanceDueDate}.`:"Full advance payment is required. The QR pass activates after payment is saved."}</p>
    {canDiscount&&b.status==="Pending"&&<label>Agreed staff discount ₹<input type="number" min="0" step="0.01" value={discount} onChange={e=>{setDiscount(Number(e.target.value));setVerified(false);}}/></label>}
    <div className="fieldGrid paymentFields">{(["cash","upi","other"] as const).map(key=><label key={key}>{key==="upi"?"UPI":key==="cash"?"Cash":"Other"} received ₹<input inputMode="decimal" type="number" min="0" step="0.01" value={tender[key]} onChange={e=>{setTender({...tender,[key]:Number(e.target.value)});setVerified(false);}}/></label>)}
    <label>UPI / payment reference<input value={tender.reference} onChange={e=>setTender({...tender,reference:e.target.value})} placeholder="Transaction reference"/></label></div>
    <p><strong>Receiving now: {money(amount)}</strong> · Remaining: {money(Math.max(0,due-amount))}</p>
    <label className="checkLabel"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/><span>I verified the money received, including any cash and UPI split.</span></label>
    <small><ShieldCheck size={15}/> This creates a receipt. Payment entries cannot be silently edited.</small>
    {error&&<p role="alert" className="inlineError">{error}</p>}

  </Dialog>;
}
