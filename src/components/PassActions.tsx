import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import Dialog from "./Dialog";
import { grantReschedules, reschedulePass } from "../lib/passes";
import { DEFAULT_POLICY, officeHours, rescheduleError } from "../lib/business";
import { addDays, localToday } from "../pages/types";
import { watchHolidays } from "../lib/firestore";
import { watchSetting } from "../lib/platform";
export default function PassActions({booking:b,can,staff,onFlash}:any) {
  const [open,setOpen]=useState(false),[extraOpen,setExtraOpen]=useState(false),[extra,setExtra]=useState(1),[reason,setReason]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[policy,setPolicy]=useState<any>(DEFAULT_POLICY),[holidays,setHolidays]=useState<any[]>([]),[history,setHistory]=useState<any[]>([]);
  useEffect(()=>{const a=watchSetting("policy",p=>setPolicy({...DEFAULT_POLICY,...p}),e=>setError(e.message)),c=watchHolidays(setHolidays,e=>setError(e.message)),d=onSnapshot(query(collection(db,"passChanges"),where("bookingId","==",b.id),...(!staff?[where("customerEmail","==",auth.currentUser?.email?.toLowerCase()||"")]:[])),s=>setHistory(s.docs.map(d=>d.data())),e=>setError(e.message));return()=>{a();c();d();};},[b.id]);
  const remaining=Math.max(0,Number(b.rescheduleAllowance)-Number(b.rescheduleUsed||0));
  const run=async()=>{setBusy(true);setError("");try{if(extraOpen)await grantReschedules(b.id,extra,reason);else await reschedulePass(b.id,from,to,reason);onFlash(extraOpen?"Extra reschedule allowance granted.":"Pass day moved. The same desk is reserved on the new date.");setOpen(false);setExtraOpen(false);setReason("");}catch(e:any){setError(e.message);}finally{setBusy(false);}};
  const openMove=()=>{const f=b.dates.find((d:string)=>d>=localToday())||"";let t=addDays(b.endDate,1);for(let i=0;i<90&&officeHours(t,policy,holidays).closed;i++)t=addDays(t,1);setFrom(f);setTo(t);setError("");setOpen(true);};
  const issue=from&&to?rescheduleError(b,from,to,policy,holidays):"Choose both dates.";
  return <div className="passActions"><p><b>{b.passDays} working days</b> · Sundays excluded · {remaining} of {b.rescheduleAllowance} reschedules remaining</p>
    <details><summary>View scheduled days & changes</summary><div className="dateChips">{b.dates.map((d:string)=><span key={d}>{d}</span>)}</div>{history.map((h,i)=><p key={i}>{h.kind==="Exception"?`Admin added ${h.extra} reschedules`:`${h.from} → ${h.to}`} · {h.reason}</p>)}</details>
    <div className="buttonRow">{(!staff||can("passesReschedule"))&&<button className="ghost" onClick={openMove} disabled={remaining===0||b.status!=="Confirmed"}>Reschedule a day</button>}{can("passExceptions")&&b.status==="Confirmed"&&<button className="ghost" onClick={()=>{setExtraOpen(true);setError("");}}>Grant extra reschedules</button>}</div>
    {(open||extraOpen)&&<Dialog title={extraOpen?"Admin exception":"Move one pass day"} onClose={()=>{if(!busy){setOpen(false);setExtraOpen(false);}}}>
      {extraOpen?<label>Additional days<input type="number" min="1" max="30" value={extra} onChange={e=>setExtra(Number(e.target.value))}/></label>:<><p>This uses one allowance. The same desk must be available on the replacement date.</p><div className="fieldGrid"><label>Original day<select value={from} onChange={e=>setFrom(e.target.value)}>{b.dates.filter((d:string)=>d>=localToday()).map((d:string)=><option key={d}>{d}</option>)}</select></label><label>Replacement day<input type="date" value={to} min={localToday()} max={addDays(b.originalEndDate||b.endDate,Number(policy.rescheduleWindowDays))} onChange={e=>setTo(e.target.value)}/></label></div>{issue&&<p className="noticeBox">{issue}</p>}</>}
      <label>Reason<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder={extraOpen?"Festival or approved exception":"Reason for moving this day"}/></label>{error&&<p className="inlineError" role="alert">{error}</p>}<div className="formActions"><button className="primary" disabled={busy||!reason.trim()||!extraOpen&&!!issue} onClick={run}>{busy?"Saving…":extraOpen?"Grant allowance":"Confirm reschedule"}</button></div>
    </Dialog>}
  </div>;
}
