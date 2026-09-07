import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import cubiclesImg from "./assets/cubicles.webp";
import conference1Img from "./assets/conference-1.webp";
import conference2Img from "./assets/conference-2.webp";
import podcastImg from "./assets/podcast.webp";
import { CalendarDays, CheckCircle2, Clock3, Crown, Users, Building2, Mic2, MessageCircle, MapPin, Wifi, AirVent, Camera, MonitorCog, Lock, UserRound } from "lucide-react";
import "./styles.css";

type Space = "cubicle" | "conference" | "podcast";
type Role = "User" | "Manager" | "Admin";
type Seat = { id: string; premium: boolean };

const seats: Seat[] = Array.from({ length: 25 }, (_, i) => {
  const row = "ABCDE"[Math.floor(i / 5)];
  const n = (i % 5) + 1;
  return { id: `${row}${n}`, premium: n === 5 };
});
const pricing = { cubicle_basic: 150, cubicle_premium: 200, conference_slot: 500, podcast_hourly: 200 };
const wa = "919970836509";
const DEFAULT_ADMIN_EMAIL = "vsshegur@gmail.com";

function App() {
  const [theme, setTheme] = useState<"light"|"dark">("light");
  const [page, setPage] = useState("home");
  const [role, setRole] = useState<Role>("User");
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [managerEmail, setManagerEmail] = useState("");
  const [loginError, setLoginError] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [space, setSpace] = useState<Space>("cubicle");
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [conferenceSlot, setConferenceSlot] = useState("09:00 AM–02:00 PM");
  const [podcastHour, setPodcastHour] = useState("10:00 AM–11:00 AM");
  const [booked, setBooked] = useState<string[]>(["A2","C3","D1"]);
  const [pending, setPending] = useState<any[]>([]);
  const [prices, setPrices] = useState(pricing);

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser?.email) { setRole("User"); return; }
      const email = currentUser.email.toLowerCase();
      if (email === DEFAULT_ADMIN_EMAIL) {
        setRole("Admin");
        await setDoc(doc(db, "users", currentUser.uid), { uid: currentUser.uid, name: currentUser.displayName || "Admin", email, role: "Admin", updatedAt: serverTimestamp() }, { merge: true });
      } else {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : {};
        if (!snap.exists()) await setDoc(userRef, { uid: currentUser.uid, name: currentUser.displayName || "", email, role: "User", activePass: null, createdAt: serverTimestamp() }, { merge: true });
        let effectiveRole = (data.role as Role | undefined) || "User";
        const assignmentRef = doc(db, "roleAssignments", encodeURIComponent(email).replace(/%/g, "_"));
        const assignmentSnap = await getDoc(assignmentRef);
        if (assignmentSnap.exists() && assignmentSnap.data().assignedRole === "Manager" && effectiveRole === "User") {
          await updateDoc(userRef, { requestedRole: "Manager", roleUpgradePending: true, roleAssignedAt: serverTimestamp() });
          const existingUpgrade = await getDocs(query(collection(db, "notifications"), where("recipientUid", "==", currentUser.uid), where("type", "==", "role-upgrade"), where("read", "==", false)));
          if (existingUpgrade.empty) await addDoc(collection(db, "notifications"), { recipientUid: currentUser.uid, type: "role-upgrade", assignedRole: "Manager", title: "Manager access is ready", message: "An administrator assigned the Manager role to your Coworx Central account.", read: false, createdAt: serverTimestamp() });
        }
        setRole(effectiveRole);
        const nq = query(collection(db, "notifications"), where("recipientUid", "==", currentUser.uid), where("read", "==", false));
        const ns = await getDocs(nq);
        setNotifications(ns.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    });
  }, []);

  async function loginWithGoogle() {
    setLoginError("");
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e:any) { setLoginError(e?.message || "Google sign-in failed."); }
  }
  async function acceptRoleUpgrade(n: any) {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), { role: n.assignedRole, roleAcceptedAt: serverTimestamp(), roleUpgradePending: false });
    await updateDoc(doc(db, "notifications", n.id), { read: true, accepted: true, acceptedAt: serverTimestamp() });
    setRole(n.assignedRole);
    setNotifications(prev => prev.filter(x => x.id !== n.id));
  }
  async function assignManagerByEmail() {
    if (role !== "Admin") return;
    const email = managerEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return alert("Enter a valid Google account email.");
    const assignmentId = encodeURIComponent(email).replace(/%/g, "_");
    await setDoc(doc(db, "roleAssignments", assignmentId), { email, assignedRole: "Manager", assignedBy: user?.email, createdAt: serverTimestamp() }, { merge: true });
    const matches = await getDocs(query(collection(db, "users"), where("email", "==", email)));
    if (!matches.empty) {
      const target = matches.docs[0];
      await updateDoc(doc(db, "users", target.id), { requestedRole: "Manager", roleUpgradePending: true, roleAssignedBy: user?.email, roleAssignedAt: serverTimestamp() });
      const existing = await getDocs(query(collection(db, "notifications"), where("recipientUid", "==", target.id), where("type", "==", "role-upgrade"), where("read", "==", false)));
      if (existing.empty) await addDoc(collection(db, "notifications"), { recipientUid: target.id, type: "role-upgrade", assignedRole: "Manager", title: "Manager access is ready", message: "An administrator assigned the Manager role to your Coworx Central account.", read: false, createdAt: serverTimestamp() });
      alert("Manager assigned. The existing user has been notified.");
    } else alert("Manager email saved. When this Google account first signs in, the Manager role will be applied.");
    setManagerEmail("");
  }
  if (authLoading) return <div className="app"><main className="authScreen"><div className="authCard"><div className="brand"><span className="brandMark">C</span><div><b>coworx</b> central<small>Solapur City</small></div></div><p>Loading Coworx Central…</p></div></main></div>;
  if (!user) return <div className="app"><main className="authScreen"><div className="authCard"><span className="eyebrow">COWORX CENTRAL • SOLAPUR CITY</span><h1>Work. Create. Connect.</h1><p>Sign in securely with your Google account to book cubicles, rooms and passes.</p><button className="primary googleBtn" onClick={loginWithGoogle}>Continue with Google</button>{loginError && <p className="error">{loginError}</p>}<small className="authNote">Only Google sign-in is supported. Admin access is reserved for {DEFAULT_ADMIN_EMAIL}.</small></div></main></div>;

  const total = useMemo(() => {
    if (space === "cubicle" && selectedSeat) return seats.find(s => s.id === selectedSeat)?.premium ? prices.cubicle_premium : prices.cubicle_basic;
    if (space === "conference") return prices.conference_slot;
    return prices.podcast_hourly;
  }, [space, selectedSeat, prices]);
  const selectionLabel = space === "cubicle" ? selectedSeat ? `Row ${selectedSeat[0]}, Seat ${selectedSeat[1]}` : "Select a seat" : space === "conference" ? `Conference Room, ${conferenceSlot}` : `Podcast Room, ${podcastHour}`;
  function requestBooking() {
    if (space === "cubicle" && !selectedSeat) return alert("Please select a seat.");
    const booking = { id: crypto.randomUUID(), space, date, selectedSeat, conferenceSlot, podcastHour, total, status: "Pending", expiresAt: Date.now() + 15 * 60 * 1000 };
    if (space === "cubicle" && selectedSeat) setBooked([...booked, selectedSeat]);
    setPending([booking, ...pending]);
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(`Need ${selectionLabel}, ${date}. Total Price: ₹${total}. What will be the best offer?`)}`, "_blank");
    alert("Your selection is temporarily locked for 15 minutes. WhatsApp has been opened.");
  }
  function nav(label:string) { setPage(label); }

  return <div className={theme === "dark" ? "app dark" : "app"}>
    <header><div className="brand" onClick={() => nav("home")}><span className="brandMark">C</span><div><b>coworx</b> central<small>Solapur City</small></div></div><nav><button onClick={() => nav("book")}>Book Space</button><button onClick={() => nav("passes")}>My Passes</button><button onClick={() => nav("amenities")}>Amenities</button>{role !== "User" && <button onClick={() => nav("manager")}>Operations</button>}{role === "Admin" && <button onClick={() => nav("admin")}>Admin</button>}</nav><div className="headerActions"><span className="userBadge">{user.photoURL ? <img src={user.photoURL} alt="" /> : <UserRound size={16}/>} {user.displayName || user.email}</span><span className="roleBadge">{role}</span><button className="themeBtn" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? "🌙" : "☀️"}</button><button className="ghost smallBtn" onClick={() => signOut(auth)}>Sign out</button></div></header>
    {notifications.length > 0 && <div className="notificationBar"><div><b>{notifications[0].title}</b><span>{notifications[0].message}</span></div><button onClick={() => acceptRoleUpgrade(notifications[0])}>Accept Manager Role</button></div>}
    {page === "home" && <main><section className="hero"><div><span className="eyebrow">WORK • CREATE • CONNECT</span><h1>Your space to do <em>better work.</em></h1><p>Flexible cubicles, a modern conference room and a fully equipped podcast studio — all in the heart of Solapur.</p><div className="heroButtons"><button className="primary" onClick={() => nav("book")}>Book a Space</button><button className="ghost" onClick={() => nav("amenities")}>Explore Amenities</button></div></div><img src={cubiclesImg} alt="Coworx Central cubicles" /></section><section className="cards"><SpaceCard icon={<Users/>} title="Cubicles" price={`From ₹${prices.cubicle_basic}/day`} image={cubiclesImg} text="25 focused workstations with premium window/locker seats." onClick={() => {setSpace("cubicle");nav("book")}} /><SpaceCard icon={<Building2/>} title="Conference" price={`₹${prices.conference_slot}/5 hrs`} image={conference1Img} text="Professional U-shaped meeting setup for productive collaboration." onClick={() => {setSpace("conference");nav("book")}} /><SpaceCard icon={<Mic2/>} title="Podcast Studio" price={`₹${prices.podcast_hourly}/hour`} image={podcastImg} text="Lights, camera, mics and stands included. No extra equipment cost." onClick={() => {setSpace("podcast");nav("book")}} /></section></main>}
    {page === "book" && <main className="booking"><div className="bookingHead"><span className="eyebrow">MAKE A RESERVATION</span><h2>Choose your perfect workspace</h2></div><div className="bookingLayout"><section className="bookingPanel"><label>Date <input type="date" value={date} min={new Date().toISOString().slice(0,10)} onChange={e=>setDate(e.target.value)} /></label><div className="tabs"><button className={space==="cubicle"?"active":""} onClick={()=>setSpace("cubicle")}>Cubicles</button><button className={space==="conference"?"active":""} onClick={()=>setSpace("conference")}>Conference</button><button className={space==="podcast"?"active":""} onClick={()=>setSpace("podcast")}>Podcast</button></div>{space === "cubicle" && <Cubicles seats={seats} booked={booked} selected={selectedSeat} onSelect={setSelectedSeat} />}{space === "conference" && <RoomPicker image={conference2Img} title="Conference Room" description="Modern U-shaped table, ergonomic seating, AC, Wi-Fi and power modules." slots={["09:00 AM–02:00 PM","02:00 PM–07:00 PM"]} value={conferenceSlot} onChange={setConferenceSlot} />}{space === "podcast" && <RoomPicker image={podcastImg} title="Podcast Studio" description="Camera, lights, microphones, mic stands and all podcast equipment included at no extra cost." slots={["09:00 AM–10:00 AM","10:00 AM–11:00 AM","11:00 AM–12:00 PM","02:00 PM–03:00 PM","03:00 PM–04:00 PM","04:00 PM–05:00 PM"]} value={podcastHour} onChange={setPodcastHour} />}</section><aside className="summary"><Lock size={22}/><span className="eyebrow">BOOKING SUMMARY</span><h3>{space === "cubicle" ? "Workspace" : space === "conference" ? "Conference" : "Podcast Studio"}</h3><div className="summaryRow"><CalendarDays/> {date}</div><div className="summaryRow"><MapPin/> {selectionLabel}</div><div className="total"><span>Total</span><strong>₹{total}</strong></div><p className="lockText">Selection will be held for 15 minutes while your booking request is pending.</p><button className="whatsapp" onClick={requestBooking}><MessageCircle/> Request via WhatsApp</button></aside></div></main>}
    {page === "passes" && <main className="simple"><h2>Your Coworx Passes</h2><div className="cards"><Info title="Daily Pass" icon={<CalendarDays/>} text="Book one day at a time with flexible workspace selection." /><Info title="Flexi Pass" icon={<CheckCircle2/>} text="One cubicle booking per use. Ideal for flexible schedules." /><Info title="Monthly Pass" icon={<Crown/>} text="Consistent, multi-day access for regular Coworx members." /></div></main>}
    {page === "amenities" && <main className="simple"><h2>Everything you need to get to work</h2><div className="amenityGrid"><Info title="Cubicles" icon={<MonitorCog/>} text="Private workstations, frosted partitions, spacious desks and ergonomic chairs. Premium seats include special window/locker access." /><Info title="Conference Room" icon={<Building2/>} text="U-shaped meeting table, ergonomic seating, AC, Wi-Fi, power modules and a professional environment." /><Info title="Podcast Studio" icon={<Mic2/>} text="Professional microphones, mic stands, camera, camera stands, lighting and all podcast equipment included at no extra cost." /><Info title="Comfort" icon={<AirVent/>} text="Air conditioning, comfortable seating and a modern startup-inspired environment." /><Info title="Connectivity" icon={<Wifi/>} text="Reliable Wi-Fi throughout the workspace." /><Info title="Production" icon={<Camera/>} text="Camera and recording setup available in the podcast studio." /></div></main>}
    {page === "manager" && role !== "User" && <main className="dashboard"><h2>Operations Dashboard</h2><div className="stats"><Stat n={`${25-booked.length}/25`} label="Available Seats"/><Stat n={String(booked.length)} label="Occupied / Locked"/><Stat n={String(pending.filter(p=>p.status==="Pending").length)} label="Pending Requests"/></div><section className="tableCard"><h3>Pending WhatsApp Bookings</h3>{pending.length===0?<p>No pending requests yet.</p>:pending.map(p=><div className="bookingItem" key={p.id}><span>{p.space} • {p.selectedSeat || p.conferenceSlot || p.podcastHour} • {p.date}</span><b>₹{p.total}</b><button onClick={()=>setPending(pending.map(x=>x.id===p.id?{...x,status:"Confirmed"}:x))}>Confirm Payment</button></div>)}</section><section className="tableCard"><h3>User Directory</h3><div className="bookingItem"><span><UserRound/> Demo User</span><select><option>User</option><option>Manager</option></select></div><p>Managers can edit users and assign Manager/User roles, but cannot assign Admin.</p></section></main>}
    {page === "admin" && role === "Admin" && <main className="dashboard admin"><span className="eyebrow">ADMIN ONLY</span><h2>Pricing, Roles & Settings</h2><section className="tableCard rolePanel"><h3>Assign Manager by Google email</h3><p>Existing Coworx users receive an in-app notification and must accept the Manager role. New users receive the assignment on their first Google sign-in.</p><div className="roleAssign"><input type="email" placeholder="manager@gmail.com" value={managerEmail} onChange={e=>setManagerEmail(e.target.value)} /><button className="primary" onClick={assignManagerByEmail}>ADD MANAGER</button></div></section><div className="priceGrid">{Object.entries(prices).map(([key,value])=><label key={key}>{key.replace(/_/g," ")}<div>₹<input type="number" value={value} onChange={e=>setPrices({...prices,[key]:Number(e.target.value)})}/></div></label>)}</div><button className="primary" onClick={()=>alert("Pricing changes saved. Connect this button to Firestore setDoc(settings/pricing).")}>SAVE CHANGES</button></main>}
    <footer>© 2026 Coworx Central • Solapur City</footer>
  </div>;
}
function SpaceCard({icon,title,price,image,text,onClick}:any){return <article className="spaceCard" onClick={onClick}><img src={image} alt={title}/><div className="cardIcon">{icon}</div><h3>{title}</h3><b>{price}</b><p>{text}</p><button>Explore →</button></article>}
function Info({icon,title,text}:any){return <article className="info"><div className="cardIcon">{icon}</div><h3>{title}</h3><p>{text}</p></article>}
function Stat({n,label}:any){return <div className="stat"><strong>{n}</strong><span>{label}</span></div>}
function Cubicles({seats,booked,selected,onSelect}:any){return <div><div className="legend"><span>🟢 Available</span><span>⚪ Booked</span><span>🔵 Selected</span><span>⭐ Premium</span></div><div className="seatGrid">{seats.map((s:Seat)=>{const b=booked.includes(s.id);return <button disabled={b} onClick={()=>onSelect(s.id)} className={`seat ${b?"booked":selected===s.id?"selected":""} ${s.premium?"premium":""}`} key={s.id}>{s.id}{s.premium&&<small>★</small>}</button>})}</div><p className="hint">Premium seats are highlighted and priced separately.</p></div>}
function RoomPicker({image,title,description,slots,value,onChange}:any){return <div className="room"><img src={image} alt={title}/><h3>{title}</h3><p>{description}</p><div className="slotGrid">{slots.map((s:string)=><button key={s} className={value===s?"slot active": "slot"} onClick={()=>onChange(s)}><Clock3/> {s}</button>)}</div></div>}
createRoot(document.getElementById("root")!).render(<App/>);
