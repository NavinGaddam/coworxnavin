import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays, CheckCircle2, Clock3, Crown, Users, Building2,
  Mic2, MessageCircle, MapPin, Wifi, AirVent, Camera, MonitorCog, Lock, UserRound,
  LogIn, Tag, Bell, LogOut
} from "lucide-react";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { auth } from "./firebase";
import "./styles.css";

type Space = "cubicle" | "conference" | "podcast";
type Role = "User" | "Manager" | "Admin";
type Seat = { id: string; premium: boolean };
type Offer = { id: string; title: string; description: string; value: string; code?: string };

type Booking = { id: string; space: Space; date: string; selectedSeat?: string | null; startTime?: string; endTime?: string; total: number; status: "Pending" | "Confirmed"; offer?: Offer | null; };

const seats: Seat[] = Array.from({ length: 25 }, (_, i) => {
  const row = "ABCDE"[Math.floor(i / 5)];
  const n = (i % 5) + 1;
  return { id: `${row}${n}`, premium: n === 5 };
});

const pricing = { cubicle_basic: 150, cubicle_premium: 200, conference_slot: 500, podcast_hourly: 200 };
const wa = "919970836509";
const DEFAULT_ADMIN_EMAIL = "vsshegur@gmail.com";

const conferenceSlots = [
  { start: "09:00", end: "14:00", label: "09:00 AM–02:00 PM" },
  { start: "14:00", end: "19:00", label: "02:00 PM–07:00 PM" }
];
const podcastHours = [
  "09:00–10:00", "10:00–11:00", "11:00–12:00", "12:00–13:00", "13:00–14:00",
  "14:00–15:00", "15:00–16:00", "16:00–17:00", "17:00–18:00", "18:00–19:00"
];

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [page, setPage] = useState("home");
  const [role, setRole] = useState<Role>("User");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [space, setSpace] = useState<Space>("cubicle");
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [conferenceStart, setConferenceStart] = useState("09:00");
  const [podcastStart, setPodcastStart] = useState("10:00");
  const [booked, setBooked] = useState<string[]>(["A2", "C3", "D1"]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [prices, setPrices] = useState(pricing);
  const [notification, setNotification] = useState<string | null>(null);
  const [offerTitle, setOfferTitle] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [offerValue, setOfferValue] = useState("");

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setAuthLoading(false);
      if (u?.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL) {
        setRole("Admin");
      } else {
        setRole("User");
      }
    });
    return unsub;
  }, []);

  const total = useMemo(() => {
    if (space === "cubicle" && selectedSeat) {
      return seats.find(s => s.id === selectedSeat)?.premium ? prices.cubicle_premium : prices.cubicle_basic;
    }
    if (space === "conference") return prices.conference_slot;
    return prices.podcast_hourly;
  }, [space, selectedSeat, prices]);

  const selectedConference = conferenceSlots.find(s => s.start === conferenceStart) ?? conferenceSlots[0];
  const selectedPodcast = podcastHours.find(s => s.startsWith(podcastStart)) ?? podcastHours[1];
  const selectionLabel = space === "cubicle"
    ? selectedSeat ? `Row ${selectedSeat[0]}, Seat ${selectedSeat[1]}` : "Select a seat"
    : space === "conference" ? `Conference Room, ${selectedConference.label}` : `Podcast Room, ${selectedPodcast.replace("–", "–")}`;

  async function login() {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      console.error(e);
      alert("Google sign-in could not be completed. Check Firebase Authentication settings.");
    }
  }

  function requestBooking() {
    if (!user) return alert("Please sign in with Google before booking.");
    if (space === "cubicle" && !selectedSeat) return alert("Please select a seat.");
    const booking: Booking = {
      id: crypto.randomUUID(), space, date, selectedSeat,
      startTime: space === "conference" ? selectedConference.start : space === "podcast" ? podcastStart : undefined,
      endTime: space === "conference" ? selectedConference.end : space === "podcast" ? selectedPodcast.split("–")[1] : undefined,
      total, status: "Pending", offer: offers[0] ?? null
    };
    if (space === "cubicle" && selectedSeat) setBooked(prev => [...new Set([...prev, selectedSeat])]);
    setBookings(prev => [booking, ...prev]);
    const offerLine = booking.offer ? ` Offer shown: ${booking.offer.title} (${booking.offer.value}).` : "";
    const timeLine = space === "cubicle" ? "" : ` Time: ${space === "conference" ? selectedConference.label : selectedPodcast}.`;
    const message = `Need ${selectionLabel}, ${date}.${timeLine} Total Price: ₹${total}.${offerLine} What will be the best offer?`;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`, "_blank");
    setPage("bookings");
    setNotification("Booking request created. Your selection is held for 15 minutes while payment is verified on WhatsApp.");
  }

  function nav(target: string) {
    if (target === "book" && !user) {
      setNotification("Google sign-in is required before booking.");
      setPage("login");
      return;
    }
    setPage(target);
  }

  function createOffer() {
    if (!offerTitle || !offerValue) return alert("Enter an offer title and value.");
    setOffers(prev => [{ id: crypto.randomUUID(), title: offerTitle, description: offerDescription, value: offerValue }, ...prev]);
    setOfferTitle(""); setOfferDescription(""); setOfferValue("");
    setNotification("Offer created and ready to show to eligible users. In production, save it in Firestore for all/specific users.");
  }

  return (
    <div className={theme === "dark" ? "app dark" : "app"}>
      <header>
        <div className="brand" onClick={() => nav("home")}><span className="brandMark">C</span><div><b>coworx</b> central<small>Solapur City</small></div></div>
        <nav>
          <button onClick={() => nav("book")}>Book Space</button>
          {user && <button onClick={() => setPage("bookings")}>My Bookings</button>}
          {user && <button onClick={() => setPage("offers")}>My Offers</button>}
          <button onClick={() => nav("amenities")}>Amenities</button>
          {role !== "User" && user && <button onClick={() => nav("manager")}>Operations</button>}
          {role === "Admin" && user && <button onClick={() => nav("admin")}>Admin</button>}
        </nav>
        <div className="headerActions">
          {user ? <button className="loginChip" onClick={() => signOut(auth)} title="Sign out"><UserRound size={16}/> {user.email}</button> : <button className="loginChip" onClick={login}><LogIn size={16}/> Google Login</button>}
          <button className="themeBtn" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? "🌙" : "☀️"}</button>
        </div>
      </header>

      {notification && <div className="notification"><Bell size={18}/><span>{notification}</span><button onClick={() => setNotification(null)}>×</button></div>}

      {page === "login" && <main className="simple loginPage"><div className="loginCard"><LogIn size={34}/><span className="eyebrow">COWORX CENTRAL</span><h2>Sign in to book</h2><p>Booking is available only to signed-in users. Use your Google account to see your bookings, offers and reservation status.</p><button className="primary" onClick={login}><LogIn/> Continue with Google</button></div></main>}

      {page === "home" && <main>
        <section className="hero">
          <div>
            <span className="eyebrow">WORK • CREATE • CONNECT</span>
            <h1>Your space to do <em>better work.</em></h1>
            <p>Flexible cubicles, a modern conference room and a fully equipped podcast studio — all in the heart of Solapur.</p>
            <div className="heroButtons"><button className="primary" onClick={() => nav("book")}>Book a Space</button><button className="ghost" onClick={() => nav("amenities")}>Explore Amenities</button></div>
          </div>
          <img src="/assets/cubicles.webp" alt="Coworx Central cubicles" />
        </section>
        <section className="cards">
          <SpaceCard icon={<Users/>} title="Cubicles" price={`From ₹${prices.cubicle_basic}/day`} image="/assets/cubicles.webp" text="25 focused workstations with premium window/locker seats." onClick={() => {setSpace("cubicle");nav("book")}} />
          <SpaceCard icon={<Building2/>} title="Conference" price={`₹${prices.conference_slot}/5 hrs`} image="/assets/conference-1.webp" text="Professional U-shaped meeting setup for productive collaboration." onClick={() => {setSpace("conference");nav("book")}} />
          <SpaceCard icon={<Mic2/>} title="Podcast Studio" price={`₹${prices.podcast_hourly}/hour`} image="/assets/podcast.webp" text="Lights, camera, mics and stands included. No extra equipment cost." onClick={() => {setSpace("podcast");nav("book")}} />
        </section>
      </main>}

      {page === "book" && user && <main className="booking">
        <div className="bookingHead"><span className="eyebrow">MAKE A RESERVATION</span><h2>Choose your perfect workspace</h2><p className="muted">Signed in as {user.email}. Your booking, offers and status are tied to your account.</p></div>
        <div className="bookingLayout">
          <section className="bookingPanel">
            <label>Date <input type="date" value={date} min={new Date().toISOString().slice(0,10)} onChange={e=>setDate(e.target.value)} /></label>
            <div className="tabs"><button className={space==="cubicle"?"active":""} onClick={()=>setSpace("cubicle")}>Cubicles</button><button className={space==="conference"?"active":""} onClick={()=>setSpace("conference")}>Conference</button><button className={space==="podcast"?"active":""} onClick={()=>setSpace("podcast")}>Podcast</button></div>
            {space === "cubicle" && <Cubicles seats={seats} booked={booked} selected={selectedSeat} onSelect={setSelectedSeat} />}
            {space === "conference" && <RoomPicker image="/assets/conference-2.webp" title="Conference Room" description="Book a full 5-hour block. Price updates from the conference slot rate." slots={conferenceSlots.map(s=>s.label)} value={selectedConference.label} onChange={(label:string)=>setConferenceStart(conferenceSlots.find(s=>s.label===label)?.start ?? "09:00")} />}
            {space === "podcast" && <RoomPicker image="/assets/podcast.webp" title="Podcast Studio" description="Choose the exact hour. Camera, lights, microphones, mic stands and all podcast equipment are included at no extra cost." slots={podcastHours} value={selectedPodcast} onChange={(label:string)=>setPodcastStart(label.split("–")[0])} />}
          </section>
          <aside className="summary"><Lock size={22}/><span className="eyebrow">BOOKING SUMMARY</span><h3>{space === "cubicle" ? "Workspace" : space === "conference" ? "Conference" : "Podcast Studio"}</h3><div className="summaryRow"><CalendarDays/> {date}</div><div className="summaryRow"><MapPin/> {selectionLabel}</div><div className="total"><span>Total</span><strong>₹{total}</strong></div>{offers.length>0 && <div className="offerPreview"><Tag size={17}/><div><b>{offers[0].title}</b><small>{offers[0].value} • {offers[0].description}</small></div></div>}<p className="lockText">Selection will be held for 15 minutes while your booking request is pending.</p><button className="whatsapp" onClick={requestBooking}><MessageCircle/> Request via WhatsApp</button></aside>
        </div>
      </main>}

      {page === "bookings" && user && <main className="simple"><span className="eyebrow">MY ACCOUNT</span><h2>My Bookings</h2><div className="tableCard">{bookings.filter(b => user).length===0 ? <p>No bookings yet. Book a space to see reservations here.</p> : bookings.map(b=><div className="bookingItem" key={b.id}><div><b>{b.space}</b><small>{b.date} • {b.selectedSeat || `${b.startTime}–${b.endTime}`}</small></div><span className={b.status === "Confirmed" ? "status confirmed" : "status pending"}>{b.status}</span><strong>₹{b.total}</strong></div>)}</div></main>}

      {page === "offers" && user && <main className="simple"><span className="eyebrow">PERSONAL OFFERS</span><h2>Offers for you</h2><div className="cards">{offers.length===0?<Info title="No offers yet" icon={<Tag/>} text="The Coworx team can send offers to everyone or target specific users by email."/>:offers.map(o=><Info key={o.id} title={o.title} icon={<Tag/>} text={`${o.value}. ${o.description}`}/>)}</div></main>}

      {page === "amenities" && <main className="simple"><h2>Everything you need to get to work</h2><div className="amenityGrid"><Info title="Cubicles" icon={<MonitorCog/>} text="Private workstations, frosted partitions, spacious desks and ergonomic chairs. Premium seats include special window/locker access."/><Info title="Conference Room" icon={<Building2/>} text="U-shaped meeting table, ergonomic seating, AC, Wi-Fi, power modules and a professional environment."/><Info title="Podcast Studio" icon={<Mic2/>} text="Professional microphones, mic stands, camera, camera stands, lighting and all podcast equipment included at no extra cost."/><Info title="Comfort" icon={<AirVent/>} text="Air conditioning, comfortable seating and a modern startup-inspired environment."/><Info title="Connectivity" icon={<Wifi/>} text="Reliable Wi-Fi throughout the workspace."/><Info title="Production" icon={<Camera/>} text="Camera and recording setup available in the podcast studio."/></div></main>}

      {page === "manager" && role !== "User" && user && <main className="dashboard"><h2>Operations Dashboard</h2><div className="stats"><Stat n={`${25-booked.length}/25`} label="Available Seats"/><Stat n={String(booked.length)} label="Occupied / Locked"/><Stat n={String(bookings.filter(b=>b.status==="Pending").length)} label="Pending Requests"/></div><section className="tableCard"><h3>Offers</h3><div className="priceGrid"><label>Offer title<input value={offerTitle} onChange={e=>setOfferTitle(e.target.value)}/></label><label>Value<input value={offerValue} onChange={e=>setOfferValue(e.target.value)} placeholder="e.g. 15% off"/></label><label>Message<input value={offerDescription} onChange={e=>setOfferDescription(e.target.value)} placeholder="Attract users with a clear offer"/></label></div><button className="primary" onClick={createOffer}>Create Offer</button><p className="hint">Production version should store an audience mode: Everyone or Specific Emails, then deliver the offer as an in-app notification.</p></section><section className="tableCard"><h3>Pending WhatsApp Bookings</h3>{bookings.length===0?<p>No pending requests yet.</p>:bookings.map(b=><div className="bookingItem" key={b.id}><span>{b.space} • {b.selectedSeat || `${b.startTime}–${b.endTime}`} • {b.date}</span><b>₹{b.total}</b><button onClick={()=>setBookings(bookings.map(x=>x.id===b.id?{...x,status:"Confirmed"}:x))}>Confirm Payment</button></div>)}</section></main>}

      {page === "admin" && role === "Admin" && user && <main className="dashboard admin"><span className="eyebrow">ADMIN ONLY</span><h2>Pricing & User Offers</h2><p className="muted">Signed in as the default administrator: {DEFAULT_ADMIN_EMAIL}</p><div className="priceGrid">{Object.entries(prices).map(([key,value])=><label key={key}>{key.replace(/_/g," ")}<div>₹<input type="number" value={value} onChange={e=>setPrices({...prices,[key]:Number(e.target.value)})}/></div></label>)}</div><button className="primary" onClick={()=>setNotification("Pricing saved in this session. Connect the button to Firestore settings/pricing for production persistence.")}>SAVE CHANGES</button><section className="tableCard"><h3>Offer targeting</h3><p>Create offers for all signed-in users or a specific user email. Existing users with an assigned Manager role can be notified in-app to accept the role.</p><div className="bookingItem"><span>Audience</span><select><option>Everyone</option><option>Specific email</option></select></div></section></main>}

      <footer>© 2026 Coworx Central • Solapur City</footer>
    </div>
  );
}

function SpaceCard({icon,title,price,image,text,onClick}:any){return <article className="spaceCard" onClick={onClick}><img src={image}/><div className="cardIcon">{icon}</div><h3>{title}</h3><b>{price}</b><p>{text}</p><button>Explore →</button></article>}
function Info({icon,title,text}:any){return <article className="info"><div className="cardIcon">{icon}</div><h3>{title}</h3><p>{text}</p></article>}
function Stat({n,label}:any){return <div className="stat"><strong>{n}</strong><span>{label}</span></div>}
function Cubicles({seats,booked,selected,onSelect}:any){return <div><div className="legend"><span>🟢 Available</span><span>⚪ Booked</span><span>🔵 Selected</span><span>⭐ Premium</span></div><div className="seatGrid">{seats.map((s:Seat)=>{const b=booked.includes(s.id);return <button disabled={b} onClick={()=>onSelect(s.id)} className={`seat ${b?"booked":selected===s.id?"selected":""} ${s.premium?"premium":""}`} key={s.id}>{s.id}{s.premium&&<small>★</small>}</button>})}</div><p className="hint">Premium seats are highlighted and priced separately.</p></div>}
function RoomPicker({image,title,description,slots,value,onChange}:any){return <div className="room"><img src={image}/><h3>{title}</h3><p>{description}</p><div className="slotGrid">{slots.map((s:string)=><button key={s} className={value===s?"slot active":"slot"} onClick={()=>onChange(s)}><Clock3/> {s}</button>)}</div></div>}
createRoot(document.getElementById("root")!).render(<App/>);
