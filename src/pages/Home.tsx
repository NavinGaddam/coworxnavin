import {Building2,ChevronRight,Check,Lock,MessageCircle,Mic2,Users,Monitor,Sparkles} from "lucide-react";
import {useEffect,useState} from "react";
import cubicles from "../assets/cubicles.webp";import conference from "../assets/conference-1.webp";import conference2 from "../assets/conference-2.webp";import lounge from "../assets/lounge.webp";import podcast from "../assets/podcast.webp";
import {Space,spaceLabel,today,liveBookingState,formatDuration} from "./types";import Pano360 from "./Pano360";import "./polish.css";import "./live-state.css";

const greetingWord=()=>{const h=new Date().getHours();return h<12?"Good morning":h<17?"Good afternoon":"Good evening"};

function NextBooking({b,nav}:{b:any;nav:(p:string)=>void}){
  const [tick,setTick]=useState(Date.now());
  useEffect(()=>{const i=setInterval(()=>setTick(Date.now()),30000);return()=>clearInterval(i)},[]);
  const live=liveBookingState(b,tick);
  return <button className="nextBookingCard" onClick={()=>nav("bookings")}>
    <div><span className="eyebrow">YOUR NEXT BOOKING</span><h3>{b.label||spaceLabel(b.space)}</h3><p>{b.date}{b.start?` · ${b.start}–${b.end}`:""}</p>{live.label&&<span className={`liveState ${live.tone}`}>{live.label}{live.ms!==undefined?` · ${formatDuration(live.ms)}`:""}</span>}</div>
    <span className="nextBookingCta">View booking <ChevronRight size={15}/></span>
  </button>;
}

function UsualWorkspace({pref,book}:{pref:any;book:(s:Space,deskId?:string)=>void}){
  return <button className="nextBookingCard" onClick={()=>book(pref.space,pref.deskId)}>
    <div><span className="eyebrow">YOUR USUAL WORKSPACE</span><h3>{pref.label}</h3><p>Booked {pref.count} time{pref.count===1?"":"s"} before</p></div>
    <span className="nextBookingCta">Book again <ChevronRight size={15}/></span>
  </button>;
}

export default function Home({book,prices,user,bookings=[],activeLocks=[],offers=[],nav}:{book:(s:Space,deskId?:string)=>void;prices:any;user?:any;bookings?:any[];activeLocks?:any[];offers?:any[];nav?:(p:string)=>void}){
  const firstName=(user?.displayName||"").split(" ")[0];
  const t=today();
  const nextBooking=[...bookings].filter(b=>(b.status==="Confirmed"||b.status==="Pending")&&b.date>=t).sort((a,b)=>(a.date+(a.start||"")).localeCompare(b.date+(b.start||"")))[0];
  const preferred=(()=>{
    const freq:Record<string,{count:number;space:Space;deskId?:string;label:string}>={};
    bookings.filter(b=>b.status==="Confirmed").forEach(b=>{
      const isDesk=b.space==="desk"||b.space==="cubicle";
      if(isDesk){(b.inventoryIds?.length?b.inventoryIds:[b.inventoryId]).forEach((inv:string)=>{const deskId=String(inv).replace(/^desk-/,"");const key=`desk:${deskId}`;freq[key]=freq[key]||{count:0,space:"desk",deskId,label:`Desk ${deskId}`};freq[key].count++;});}
      else{const key=`space:${b.space}`;freq[key]=freq[key]||{count:0,space:b.space,label:spaceLabel(b.space)};freq[key].count++;}
    });
    const top=Object.values(freq).sort((a,b)=>b.count-a.count)[0];
    return top&&top.count>=2?top:null;
  })();
  const deskLocks=activeLocks.filter((l:any)=>String(l.inventoryId||"").startsWith("desk-"));
  const deskHeld=deskLocks.filter((l:any)=>l.status==="Pending").length;
  const deskBooked=deskLocks.filter((l:any)=>l.status==="Confirmed").length;
  const deskAvailable=Math.max(0,22-deskLocks.length);
  const offer=offers[0];
  const quickPicks:[Space,string,any][]=[["desk","Desk",Monitor],["meeting","Meeting Room",Users],["conference","Conference Room",Building2],["podcast","Studio",Mic2]];

  return <main className="page">
    {user&&<section className="homeGreeting">
      <div className="homeGreetingHead">
        <div><span className="eyebrow">{greetingWord()}{firstName?`, ${firstName}`:""} 👋</span><h2>What do you need today?</h2></div>
      </div>
      <div className="quickPickRow">
        {quickPicks.map(([s,label,Icon])=><button key={s} className="quickPick" onClick={()=>book(s)}><Icon size={18}/><span>{label}</span></button>)}
      </div>
      <div className="homeGreetingGrid">
        {nextBooking?<NextBooking b={nextBooking} nav={nav||(()=>{})}/>:<div className="nextBookingEmpty"><Sparkles size={16}/><span>No upcoming bookings yet — pick a space above to get started.</span></div>}
        {preferred&&<UsualWorkspace pref={preferred} book={book}/>}
        <div className="liveStatusCard">
          <span className="eyebrow">AVAILABLE NOW</span>
          <div className="liveStatusRow"><strong>22</strong><span>desks</span><strong>{deskAvailable}</strong><span>available</span><strong>{deskHeld}</strong><span>held</span><strong>{deskBooked}</strong><span>occupied</span></div>
        </div>
      </div>
      {offer&&<button className="offerTeaser" onClick={()=>nav?.("offers")}><Sparkles size={16}/><div><b>{offer.type==="percent"?`${offer.value}% OFF`:`₹${offer.value} OFF`}</b><span>{offer.title||"Limited-time offer"} · Tap to view</span></div><ChevronRight size={16}/></button>}
    </section>}
    <section className="hero"><div><span className="eyebrow">WORK · CREATE · CONNECT</span><h1>Your space to do <em>better work.</em></h1><p>Flexible desks, an 8-seat meeting room, an 18-seat conference room and a creator studio in Solapur.</p><div className="heroButtons"><button className="primary" onClick={()=>book("desk")}>Book a Desk <ChevronRight/></button><button className="ghost" onClick={()=>book("meeting")}>Book Meeting Room</button></div><div className="trust"><span><Check/> Google sign-in</span><span><Lock/> 15-minute hold</span><span><MessageCircle/> WhatsApp assisted</span></div></div><img src={cubicles} alt="Coworx Central desks"/></section><Pano360/><div className="sectionHead"><span className="eyebrow">THE SPACE</span><h2>Real rooms. Real workspace.</h2><p className="muted">All booking hours: 9:00 AM–7:00 PM.</p></div><section className="cards"><Card img={cubicles} icon={<Monitor/>} title="22 Desks" price={`From ₹${prices.desk_basic}/day`} text={`22 focused desks · ₹${prices.desk_basic} regular · ₹${prices.desk_premium} premium with lockable drawer. Select multiple desks for one request.`} click={()=>book("desk")}/><Card img={conference} icon={<Users/>} title="Meeting Room" price={`₹${prices.meeting_hourly}/hour`} text="8-seater room · multiple hours · AC · Wi-Fi · power. Available 9:00 AM–7:00 PM." click={()=>book("meeting")}/><Card img={conference2} icon={<Building2/>} title="Conference Room" price={`₹${prices.conference_hourly}/hour`} text="18-seater U-shaped setup · multiple hours · AC · Wi-Fi · power modules." click={()=>book("conference")}/><Card img={podcast} icon={<Mic2/>} title="Creator Studio" price={`₹${prices.podcast_hourly}/hour`} text="Lights, microphones, stands and essentials included. Camera is not provided." click={()=>book("podcast")}/></section><div className="gallery"><img src={conference2} alt="Conference room"/><img src={lounge} alt="Lounge"/><img src={podcast} alt="Creator studio"/></div></main>;
}
function Card({img,icon,title,price,text,click}:any){return <article className="card" onClick={click}><img src={img} alt=""/><div className="cardIcon">{icon}</div><h3>{title}</h3><b>{price}</b><p>{text}</p><button>Explore <ChevronRight/></button></article>}
