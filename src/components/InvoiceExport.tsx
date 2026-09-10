import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { DateRangePicker } from "../pages/DatePicker";
import { localToday } from "../pages/types";

const esc=(v:unknown)=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const dt=(b:any)=>b.confirmedAt?.toDate?.()||b.createdAt?.toDate?.()||null;
const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const firstOfMonth=()=>localToday().slice(0,7)+"-01";

export default function InvoiceExport({bookings,company,onFlash}:any){
  const [mode,setMode]=useState<"month"|"range">("month"),[month,setMonth]=useState(localToday().slice(0,7)),[start,setStart]=useState(firstOfMonth()),[end,setEnd]=useState(localToday());
  const effective=mode==="month"?{start:`${month}-01`,end:`${month}-31`}:{start,end};
  const rows=useMemo(()=>bookings.filter((b:any)=>b.status==="Confirmed"&&b.invoiceNumber).filter((b:any)=>{const d=dt(b);const key=d?iso(d):b.date;return key>=effective.start&&key<=effective.end;}),[bookings,effective.start,effective.end]);
  const exportExcel=()=>{
    if(!rows.length)return onFlash("No confirmed invoices found in this period.");
    const gstRate=String(company?.gstNumber||"").trim()?Number(company?.gstRate||0):0;
    const columns=["Invoice Number","Invoice Date","Invoice Time","Payment Mode","Total Amount","Taxable Amount","Discount","CGST","SGST","Email","Phone"];
    const values=rows.map((b:any)=>{const date=dt(b),total=Number(b.total||0),taxable=gstRate>0?total/(1+gstRate/100):total,gst=total-taxable;return [b.invoiceNumber,date?date.toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"}):b.date,date?date.toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit"}):"",b.paymentMethod||"",total,taxable,Number(b.discount||0)+Number(b.staffDiscount||0),gst/2,gst/2,b.customerEmail||b.userEmail||"",b.customerPhone||""];});
    const worksheet=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Invoices"><Table>${[columns,...values].map((r,i)=>`<Row>${r.map((v,j)=>`<Cell><Data ss:Type="${i>0&&j>=4&&j<=8?"Number":"String"}">${esc(i>0&&j>=4&&j<=8?Number(v).toFixed(2):v)}</Data></Cell>`).join("")}</Row>`).join("")}</Table></Worksheet></Workbook>`;
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([worksheet],{type:"application/vnd.ms-excel"}));a.download=`coworx-invoices-${effective.start}-to-${effective.end}.xls`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);onFlash(`Exported ${rows.length} invoice${rows.length===1?"":"s"} to Excel.`);
  };
  return <section className="surface invoiceExport"><div className="sectionHeading"><div><span className="eyebrow">INVOICE EXPORT</span><h3>Excel invoice summary</h3><p>Download accounting fields month-wise or for a custom date range.</p></div><FileSpreadsheet/></div><div className="fieldGrid"><label>Period<select value={mode} onChange={e=>setMode(e.target.value as any)}><option value="month">Month</option><option value="range">Custom date range</option></select></label>{mode==="month"?<label>Month<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>:<div className="full"><DateRangePicker start={start} end={end} max={localToday()} onChange={(s,e)=>{setStart(s);setEnd(e);}}/></div>}</div><p className="muted">{rows.length} confirmed invoice{rows.length===1?"":"s"} in selected period.</p><button className="primary" onClick={exportExcel}><FileSpreadsheet size={17}/>Export Excel</button></section>;
}
