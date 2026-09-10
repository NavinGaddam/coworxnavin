import { useMemo, useState } from "react";
import { Search, Users, Monitor, ArrowRight, CalendarDays, Settings2, WalletCards, ScanLine, Ticket, Inbox, Home, Gift } from "lucide-react";
import Dialog from "./Dialog";
import { customerMatches } from "../lib/customer";
import { desks } from "../pages/types";

export default function CommandSearch({
  onClose,
  openCustomer,
  users = [],
  bookings = [],
  nav,
  can,
  bookDesk,
  prices,
}: any) {
  const [q, setQ] = useState("");
  const query=q.trim().toLowerCase();
  const customers = can("customersView") && query ? users.filter((u: any) => customerMatches(u, q)).slice(0, 6) : [];
  const deskMatches = query ? desks.filter((d) => [`d${d.number}`,d.id,`desk ${d.number}`,d.premium?"premium":"regular"].some(x=>x.toLowerCase().includes(query))).slice(0, 6) : [];
  const bookingMatches = query ? bookings.filter((b:any)=>[
    b.id,b.invoiceNumber,b.customerName,b.customerEmail,b.customerPhone,b.label,b.space,b.date,...(b.inventoryIds||[])
  ].filter(Boolean).join(" ").toLowerCase().includes(query)).slice(0,8) : [];
  const destinations=useMemo(()=>[
    {id:"home",label:"Home",keywords:"homepage customer",icon:Home,show:true},
    {id:"book",label:"Book workspace",keywords:"booking desk meeting conference studio",icon:CalendarDays,show:true},
    {id:"bookings",label:"My bookings",keywords:"customer reservations pass receipt",icon:CalendarDays,show:true},
    {id:"offers",label:"Offers",keywords:"coupon promotion membership",icon:Gift,show:true},
    {id:"dashboard",label:"Staff overview",keywords:"staff dashboard today",icon:Settings2,show:can("bookingsView")},
    {id:"reception",label:"Front desk",keywords:"check in checkout qr scan reception",icon:ScanLine,show:can("checkIn")||can("checkOut")},
    {id:"staff-bookings",label:"All bookings",keywords:"reservations payments pending cancelled",icon:CalendarDays,show:can("bookingsView")},
    {id:"passes",label:"Passes",keywords:"membership consecutive days",icon:Ticket,show:can("passesView")},
    {id:"collections",label:"Collections",keywords:"cash upi receipt payment correction handover",icon:WalletCards,show:can("collectionsView")},
    {id:"ops:enquiries",label:"Enquiries",keywords:"leads follow up cold hot urgent",icon:Inbox,show:can("enquiriesManage")},
    {id:"ops:customers",label:"Customers",keywords:"customer directory crm",icon:Users,show:can("customersView")},
    {id:"ops:resources",label:"Maintenance & lockers",keywords:"locker desk maintenance resource",icon:Monitor,show:can("resourcesManage")},
    {id:"ops:holidays",label:"Holidays",keywords:"closed office sunday working day",icon:CalendarDays,show:can("resourcesManage")},
    {id:"ops:pricing",label:"Pricing",keywords:"rates premium regular bulk seasonal date",icon:WalletCards,show:can("pricingManage")},
    {id:"ops:catalog",label:"Plans & offers",keywords:"coupon offer pass membership",icon:Gift,show:can("catalogManage")},
    {id:"ops:banners",label:"Homepage notices",keywords:"banner notice homepage",icon:Settings2,show:can("noticesManage")},
    {id:"ops:comms",label:"Communication templates",keywords:"whatsapp message template",icon:Settings2,show:can("communicationsManage")},
    {id:"ops:revenue",label:"Revenue & reports",keywords:"invoice report export gst excel revenue",icon:WalletCards,show:can("revenueView")},
    {id:"ops:refunds",label:"Refunds",keywords:"refund cancellation money return",icon:WalletCards,show:can("refundsManage")},
    {id:"administration",label:"Administration",keywords:"settings company gst wifi permissions team hours policy",icon:Settings2,show:["companyManage","paymentsManage","wifiManage","policyManage","teamManage","auditView"].some(can)},
  ].filter(x=>x.show),[can]);
  const pageMatches=query?destinations.filter(x=>(x.label+" "+x.keywords).toLowerCase().includes(query)).slice(0,8):destinations.slice(0,6);
  const any=customers.length||deskMatches.length||bookingMatches.length||pageMatches.length;
  return (
    <Dialog title="Find anything" onClose={onClose}>
      <label className="commandInput">
        <Search size={20} />
        <input autoFocus aria-label="Universal app search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, booking, desk, setting or operation…" />
      </label>
      <div className="commandResults">
        {pageMatches.map(({id,label,icon:Icon}:any)=><button key={`page-${id}`} onClick={()=>{nav(id);onClose();}}><Icon size={18}/><span><b>{label}</b><small>Open app section</small></span><ArrowRight size={17}/></button>)}
        {customers.map((u:any)=><button key={`customer-${u.uid||u.id}`} onClick={()=>{openCustomer(u);onClose();}}><Users size={18}/><span><b>{u.name||u.email}</b><small>{u.email} · {u.phone||"No mobile"}</small></span><ArrowRight size={17}/></button>)}
        {bookingMatches.map((b:any)=><button key={`booking-${b.id}`} onClick={()=>{nav(can("bookingsView")?"staff-bookings":"bookings");onClose();}}><CalendarDays size={18}/><span><b>{b.label}</b><small>{b.customerName||b.customerEmail} · {b.date} · {b.invoiceNumber||b.id.slice(0,8)}</small></span><ArrowRight size={17}/></button>)}
        {deskMatches.map((d)=><button key={`desk-${d.id}`} onClick={()=>{bookDesk(d.id);onClose();}}><Monitor size={18}/><span><b>Desk {d.id}</b><small>{d.premium?"Premium":"Regular"} · ₹{d.premium?prices.desk_premium:prices.desk_basic}/day · Check availability</small></span><ArrowRight size={17}/></button>)}
        {!any&&<p className="muted">No result found. Try a customer name, booking ID, desk number, “refund”, “pricing”, “locker”, “holiday” or another feature.</p>}
      </div>
      <small className="muted">Press Esc to close · Ctrl / ⌘ K to search anywhere</small>
    </Dialog>
  );
}
