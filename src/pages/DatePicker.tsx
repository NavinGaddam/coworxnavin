import {useEffect,useMemo,useRef,useState} from "react";
import {ChevronLeft,ChevronRight,Calendar as CalIcon} from "lucide-react";
import "./datepicker.css";

const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW=["Su","Mo","Tu","We","Th","Fr","Sa"];
const fmt=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const parse=(s:string)=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,(m||1)-1,d||1);};
const niceDate=(s:string)=>{if(!s)return "";const d=parse(s);return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;};

function Month({view,min,max,onPick,selected,rangeStart,rangeEnd,highlight}:{view:Date;min?:string;max?:string;onPick:(s:string)=>void;selected?:string;rangeStart?:string;rangeEnd?:string;highlight?:(s:string)=>string|undefined}){
  const year=view.getFullYear(),month=view.getMonth();
  const first=new Date(year,month,1),startDow=first.getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const cells:(number|null)[]=[...Array(startDow).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while(cells.length%7!==0)cells.push(null);
  return <div className="dpMonth">
    <div className="dpMonthLabel">{MONTHS[month]} {year}</div>
    <div className="dpDow">{DOW.map(d=><span key={d}>{d}</span>)}</div>
    <div className="dpGrid">
      {cells.map((day,i)=>{
        if(!day)return <span key={i} className="dpEmpty"/>;
        const s=fmt(new Date(year,month,day));
        const disabled=(min&&s<min)||(max&&s>max);
        const isSel=s===selected||s===rangeStart||s===rangeEnd;
        const inRange=rangeStart&&rangeEnd&&s>rangeStart&&s<rangeEnd;
        const mark=highlight?.(s);
        return <button key={i} type="button" disabled={!!disabled} className={`dpDay ${isSel?"sel":""} ${inRange?"inRange":""} ${mark||""}`} onClick={()=>onPick(s)}>{day}</button>;
      })}
    </div>
  </div>;
}

export function DatePicker({value,onChange,min,max,label,placeholder="Select date"}:{value:string;onChange:(v:string)=>void;min?:string;max?:string;label?:string;placeholder?:string}){
  const [open,setOpen]=useState(false);
  const [view,setView]=useState(()=>parse(value||min||fmt(new Date())));
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const onDoc=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",onDoc);return()=>document.removeEventListener("mousedown",onDoc)},[]);
  useEffect(()=>{if(open)setView(parse(value||min||fmt(new Date())))},[open]);
  return <div className="dpWrap" ref={ref}>
    {label&&<span className="dpLabel">{label}</span>}
    <button type="button" className="dpTrigger" onClick={()=>setOpen(v=>!v)}><CalIcon size={15}/><span>{value?niceDate(value):placeholder}</span></button>
    {open&&<div className="dpPopover">
      <div className="dpNav"><button type="button" onClick={()=>setView(new Date(view.getFullYear(),view.getMonth()-1,1))}><ChevronLeft size={16}/></button><span>{MONTHS[view.getMonth()]} {view.getFullYear()}</span><button type="button" onClick={()=>setView(new Date(view.getFullYear(),view.getMonth()+1,1))}><ChevronRight size={16}/></button></div>
      <Month view={view} min={min} max={max} selected={value} onPick={s=>{onChange(s);setOpen(false)}}/>
    </div>}
  </div>;
}

export function DateRangePicker({start,end,onChange,min,max,highlight}:{start:string;end:string;onChange:(start:string,end:string)=>void;min?:string;max?:string;highlight?:(s:string)=>string|undefined}){
  const [open,setOpen]=useState(false);
  const [view,setView]=useState(()=>parse(start||min||fmt(new Date())));
  const [picking,setPicking]=useState<"start"|"end">("start");
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const onDoc=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",onDoc);return()=>document.removeEventListener("mousedown",onDoc)},[]);
  const nextView=useMemo(()=>new Date(view.getFullYear(),view.getMonth()+1,1),[view]);
  const pick=(s:string)=>{
    if(picking==="start"){onChange(s,s<end?end:s);setPicking("end");}
    else{if(s<start){onChange(s,start);}else{onChange(start,s);}setOpen(false);setPicking("start");}
  };
  return <div className="dpWrap dpRangeWrap" ref={ref}>
    <div className="dpRangeTrigger">
      <button type="button" className="dpTrigger" onClick={()=>{setPicking("start");setOpen(true);setView(parse(start||min||fmt(new Date())))}}><CalIcon size={15}/><span>{niceDate(start)}</span></button>
      <span className="dpArrow">→</span>
      <button type="button" className="dpTrigger" onClick={()=>{setPicking("end");setOpen(true);setView(parse(end||start||min||fmt(new Date())))}}><CalIcon size={15}/><span>{niceDate(end)}</span></button>
    </div>
    {open&&<div className="dpPopover dpPopoverRange">
      <div className="dpNav"><button type="button" onClick={()=>setView(new Date(view.getFullYear(),view.getMonth()-1,1))}><ChevronLeft size={16}/></button><span>{picking==="start"?"Pick start date":"Pick end date"}</span><button type="button" onClick={()=>setView(new Date(view.getFullYear(),view.getMonth()+1,1))}><ChevronRight size={16}/></button></div>
      <div className="dpTwoMonths">
        <Month view={view} min={min} max={max} rangeStart={start} rangeEnd={end} highlight={highlight} onPick={pick}/>
        <Month view={nextView} min={min} max={max} rangeStart={start} rangeEnd={end} highlight={highlight} onPick={pick}/>
      </div>
    </div>}
  </div>;
}
