import { useEffect, useMemo, useState } from "react";
import {
  loadDeskPricing,
  loadPricing,
  saveDeskPricing,
} from "../lib/firestore";
import { desks, localToday } from "../pages/types";
import { DateRangePicker } from "../pages/DatePicker";
import {
  DeskFeatureMap,
  emptyDeskFeatures,
  moveLocker,
  saveBulkDeskRates,
  saveDeskFeatures,
  watchDeskFeatures,
} from "../lib/deskAdmin";

export default function DeskRates({ onFlash }: any) {
  const [date, setDate] = useState(localToday()),
    [rates, setRates] = useState<any>({}),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [features,setFeatures]=useState<DeskFeatureMap>(emptyDeskFeatures()),[featureBusy,setFeatureBusy]=useState(false);
  const [fromLocker,setFromLocker]=useState(""),[toLocker,setToLocker]=useState("");
  const [bulk,setBulk]=useState<any>({mode:"permanent",regular:200,premium:250,startDate:localToday(),endDate:localToday(),label:"Desk bulk rate"});
  useEffect(() => {
    let current = true;
    setLoading(true);
    loadPricing()
      .then((p) => {
        setBulk((x:any)=>({...x,regular:Number(p.desk_basic||0),premium:Number(p.desk_premium||0)}));
        return loadDeskPricing(date, p);
      })
      .then((r) => {
        if (current) {
          setRates(r);
          setLoading(false);
        }
      })
      .catch((e) => onFlash(e.message));
    return () => { current = false; };
  }, [date]);
  useEffect(()=>watchDeskFeatures(setFeatures,e=>onFlash(e.message)),[]);
  const lockerDesks=useMemo(()=>desks.filter(d=>features[d.id]?.locker),[features]);
  const saveFeatures=async(next:DeskFeatureMap)=>{setFeatureBusy(true);try{await saveDeskFeatures(next);setFeatures(next);onFlash("Desk locker setup saved.");}catch(e:any){onFlash(e.message);}finally{setFeatureBusy(false);}};
  return (
    <>
      <section className="opsPanel">
        <h3>Bulk desk pricing</h3>
        <p className="opsNote">Update all regular desks and all premium desks together. Permanent pricing becomes the standing default; temporary pricing applies only to the selected date range.</p>
        <div className="fieldGrid">
          <label>Regular desk rate ₹<input type="number" min="0" value={bulk.regular} onChange={e=>setBulk({...bulk,regular:Number(e.target.value)})}/></label>
          <label>Premium desk rate ₹<input type="number" min="0" value={bulk.premium} onChange={e=>setBulk({...bulk,premium:Number(e.target.value)})}/></label>
          <label>Apply for<select value={bulk.mode} onChange={e=>setBulk({...bulk,mode:e.target.value})}><option value="permanent">Permanent / all future days</option><option value="range">Specific date range</option></select></label>
        </div>
        {bulk.mode==="range"&&<><DateRangePicker start={bulk.startDate} end={bulk.endDate} min={localToday()} onChange={(s,e)=>setBulk({...bulk,startDate:s,endDate:e})}/><label className="fieldLabel">Rule label<input value={bulk.label} onChange={e=>setBulk({...bulk,label:e.target.value})} placeholder="Festival week"/></label></>}
        <div className="deskRatesGrid premiumAwareGrid">
          {desks.map(d=><span key={d.id} className={d.premium?"premiumDeskTag":"regularDeskTag"}><b>{d.id}</b><small>{d.premium?"Premium":"Regular"}</small></span>)}
        </div>
        <button className="primary" disabled={busy} onClick={async()=>{setBusy(true);try{await saveBulkDeskRates(bulk);onFlash(bulk.mode==="permanent"?"Regular and premium standing rates updated.":"Temporary bulk desk rate saved for the selected date range.");}catch(e:any){onFlash(e.message);}finally{setBusy(false);}}}>{busy?"Saving…":"Apply bulk desk rates"}</button>
      </section>

      <section className="opsPanel">
        <h3>Locker assignment</h3>
        <p className="opsNote">Lockers are movable. Mark exactly which desks currently have a locker, or move one from a desk to another.</p>
        <div className="deskRatesGrid premiumAwareGrid">
          {desks.map(d=><label key={d.id} className={d.premium?"premiumDeskTag":"regularDeskTag"}><span><b>{d.id}</b> <small>{d.premium?"Premium":"Regular"}</small></span><input type="checkbox" checked={!!features[d.id]?.locker} disabled={featureBusy} onChange={e=>saveFeatures({...features,[d.id]:{locker:e.target.checked}})}/><small>{features[d.id]?.locker?"Locker attached":"No locker"}</small></label>)}
        </div>
        <div className="fieldGrid">
          <label>Move locker from<select value={fromLocker} onChange={e=>setFromLocker(e.target.value)}><option value="">Choose desk</option>{lockerDesks.map(d=><option key={d.id} value={d.id}>{d.id} · {d.premium?"Premium":"Regular"}</option>)}</select></label>
          <label>Move locker to<select value={toLocker} onChange={e=>setToLocker(e.target.value)}><option value="">Choose desk</option>{desks.filter(d=>!features[d.id]?.locker).map(d=><option key={d.id} value={d.id}>{d.id} · {d.premium?"Premium":"Regular"}</option>)}</select></label>
        </div>
        <button className="ghost" disabled={featureBusy||!fromLocker||!toLocker} onClick={async()=>{setFeatureBusy(true);try{const next=await moveLocker(fromLocker,toLocker,features);setFeatures(next);setFromLocker("");setToLocker("");onFlash(`Locker moved from ${fromLocker} to ${toLocker}.`);}catch(e:any){onFlash(e.message);}finally{setFeatureBusy(false);}}}>Move locker</button>
      </section>

      <section className="opsPanel">
        <h3>Desk rates for a specific date</h3>
        <p className="opsNote">Override individual desk rates for one date. Seasonal pricing rules take priority when a rule is active.</p>
        <label className="fieldLabel">Date<input type="date" min={localToday()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)}/></label>
        {loading ? <div className="skeleton" style={{ height: 120 }} /> : <div className="deskRatesGrid">{desks.map(d=><label key={d.id} className={d.premium?"premiumDeskTag":"regularDeskTag"}><span>{d.id} <small>{d.premium?"Premium":"Regular"}</small></span><input type="number" min="0" value={Number(rates[d.id]??0)} onChange={(e)=>setRates({...rates,[d.id]:Number(e.target.value)})}/></label>)}</div>}
        <div className="formActions"><button className="primary" disabled={busy || loading} onClick={async()=>{if(Object.values(rates).some((n)=>!Number.isFinite(n)||Number(n)<0))return onFlash("Enter valid non-negative desk rates.");setBusy(true);try{await saveDeskPricing(date,rates);onFlash(`Desk rates saved for ${date}.`);}catch(e:any){onFlash(e.message);}finally{setBusy(false);}}}>{busy?"Saving…":"Save specific-date desk rates"}</button></div>
      </section>
    </>
  );
}
