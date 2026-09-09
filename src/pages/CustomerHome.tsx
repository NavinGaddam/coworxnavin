import { balance, money, officeHours, sessionHours } from "../lib/business";
import { lazy, Suspense, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  ArrowRight,
  Check,
  Clock3,
  Coffee,
  MapPin,
  Monitor,
  Play,
  Wifi,
  Users,
  Mic2,
  Building2,
  Gift,
  X,
} from "lucide-react";
import desksImage from "../assets/workspace-desks.jpg";
import conferenceImage from "../assets/workspace-conference.jpg";
import studioImage from "../assets/workspace-studio.jpg";
import teamImage from "../assets/workspace-team.jpg";
import meetingImage from "../assets/lounge.webp";
import Dialog from "../components/Dialog";
import { localToday, Space } from "./types";
const Pano360 = lazy(() => import("./Pano360"));
const greeting = () => {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};
export default function CustomerHome({
  book,
  prices,
  user,
  bookings = [],
  profile = {},
  policy = {},
  activeLocks = [],
  offers = [],
  nav,
  banners = [],
  availabilityLoaded = false,
  maintenance = [],
}: any) {
  const [tour, setTour] = useState<"video" | "360" | null>(null),
    [dismissed, setDismissed] = useState<string[]>([]);
  const today = localToday();
  const hours=officeHours(today,policy);
  const upcomingDate=(b:any)=>(b.dates||[b.date]).find((d:string)=>d>=today) || b.endDate || b.date;
  const reminders=bookings.filter((b:any)=>b.status==="Confirmed").flatMap((b:any)=>{
    const messages:string[]=[];const pref=profile?.reminderPreferences||{};
    if(pref.balance!==false&&balance(b)>0&&b.balanceDueDate)messages.push(`${money(balance(b))} pass balance ${b.balanceDueDate<today?"overdue since":"due"} ${b.balanceDueDate}`);
    if(pref.expiry!==false&&b.passDays&&b.endDate>=today&&new Date(b.endDate).getTime()-new Date(today).getTime()<=3*86400000)messages.push(`Your ${b.passDays}-day pass ends ${b.endDate}.`);
    if(pref.booking!==false&&upcomingDate(b)===today)messages.push(`You’re booked today · ${b.label} · until ${sessionHours(b,today).end}.`);
    return messages;
  });
  const next = [...bookings]
    .filter(
      (b) =>
        (b.status === "Confirmed" ||
          (b.status === "Pending" &&
            (b.expiresAt?.toMillis?.() || 0) > Date.now())) &&
        (b.endDate || b.date) >= today,
    )
    .sort((a, b) =>
      (upcomingDate(a) + (a.start || "")).localeCompare(upcomingDate(b) + (b.start || "")),
    )[0];
  const occupied = new Set([
    ...activeLocks
      .filter((l: any) => String(l.inventoryId).startsWith("desk-"))
      .map((l: any) => l.inventoryId),
    ...maintenance
      .filter((b: any) => b.active !== false)
      .map((b: any) =>
        /^D\d/.test(b.inventoryId) ? `desk-${b.inventoryId}` : b.inventoryId,
      )
      .filter((s: string) => s.startsWith("desk-")),
  ]);
  const spaces: [Space, string, string, any, string, string][] = [
    [
      "desk",
      "Your desk. Your focus.",
      "Regular & premium desks",
      Monitor,
      desksImage,
      `₹${prices.desk_basic}/day`,
    ],
    [
      "meeting",
      "Bring the ideas.",
      "Meeting room · up to 8 people",
      Users,
      meetingImage,
      `₹${prices.meeting_hourly}/hour`,
    ],
    [
      "conference",
      "Room for the whole team.",
      "Conference room · up to 18 people",
      Building2,
      conferenceImage,
      `₹${prices.conference_hourly}/hour`,
    ],
    [
      "podcast",
      "Make something worth sharing.",
      "Creator studio · lights & microphones",
      Mic2,
      studioImage,
      `₹${prices.podcast_hourly}/hour`,
    ],
  ];
  return (
    <main className="cxHome">
      {banners
        .filter((b: any) => !dismissed.includes(b.id))
        .map((b: any) => (
          <div className="homeNotice" key={b.id}>
            <Gift size={17} />
            <div>
              <b>{b.title}</b>
              <span>{b.message}</span>
            </div>
            <button
              className="iconButton"
              aria-label="Dismiss notice"
              onClick={() => setDismissed([...dismissed, b.id])}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      {user ? (
        <section className="memberWelcome">
          <div className="sectionHeading">
            <div>
              <span className="eyebrow">YOUR COWORX</span>
              <h1>
                {greeting()}, {(user.displayName || "there").split(" ")[0]}.
              </h1>
              <p>Make room for a productive day.</p>
            </div>
            <span className="locationTag">
              <MapPin size={15} /> Solapur
            </span>
          </div>
          <div className="memberGrid">
            <div>
              <div className="quickSpaces">
                {spaces.map(([s, , label, Icon]) => (
                  <button key={s} onClick={() => book(s)}>
                    <Icon size={23} />
                    <b>
                      {s === "desk"
                        ? "Desk"
                        : s === "meeting"
                          ? "Meeting room"
                          : s === "conference"
                            ? "Conference"
                            : "Studio"}
                    </b>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
              <div className="memberAvailability">
                <span className="liveDot" />{" "}
                {availabilityLoaded
                  ? hours.closed ? hours.reason : `${Math.max(0, 22 - occupied.size)} desks available today · ${hours.start}–${hours.end}`
                  : "Loading today’s availability…"}
                <button className="textButton" onClick={() => book("desk")}>
                  Find your spot <ArrowRight size={14} />
                </button>
              </div>
            </div>
            <button
              className="nextPassCard"
              onClick={() => nav(next ? "bookings" : "book")}
            >
              <span className="eyebrow">
                {next ? "YOUR NEXT BOOKING" : "YOUR NEXT GREAT WORKDAY"}
              </span>
              <h3>{next ? next.label : "Your workspace is waiting."}</h3>
              <p>
                {next
                  ? `${upcomingDate(next)} · ${sessionHours(next,upcomingDate(next)).start}–${sessionHours(next,upcomingDate(next)).end}${next.passDays ? ` · Pass ends ${next.endDate}` : ""}`
                  : "Choose a desk, meet your team, or record your next idea."}
              </p>
              <span>
                {next ? "View booking & pass" : "Explore workspaces"}{" "}
                <ArrowRight size={17} />
              </span>
            </button>
          </div>
          {reminders.length>0&&<div className="memberReminders">{reminders.slice(0,4).map((text,i)=><button className="noticeBox" key={i} onClick={()=>nav("bookings")}>{text} <ArrowRight size={17}/></button>)}</div>}
          {offers[0] && (
            <button className="memberOffer" onClick={() => nav("offers")}>
              <Gift size={18} />
              <b>{offers[0].title}</b>
              <span>
                View your offers <ArrowRight size={16} />
              </span>
            </button>
          )}
        </section>
      ) : (
        <section className="homeHero">
          <div className="homeHeroCopy">
            <span className="locationTag">
              <span className="liveDot" /> A SPACE FOR YOUR NEXT CHAPTER ·
              SOLAPUR
            </span>
            <h1>
              A good place
              <br /> to do <em>great work.</em>
            </h1>
            <p>
              Your focus desk. Your next big meeting. Your creative studio. A
              little more space for everything you’re building.
            </p>
            <div className="heroActions">
              <button className="primary" onClick={() => book("desk")}>
                Find your workspace <ArrowUpRight size={19} />
              </button>
              <button className="textButton" onClick={() => setTour("video")}>
                <span className="playCircle">
                  <Play size={13} />
                </span>
                Take a look around
              </button>
            </div>
            <div className="heroTrust">
              <span>
                <Check size={15} /> Flexible bookings
              </span>
              <span>
                <Check size={15} /> Ready to work
              </span>
              <span>
                <Check size={15} /> From ₹{prices.desk_basic}/day
              </span>
            </div>
            <a className="scrollLink" href="#spaces">
              <ArrowDown size={14} /> FIND YOUR HAPPY SPACE
            </a>
          </div>
          <div className="homeHeroVisual">
            <img
              className="heroWorkspace"
              src={desksImage}
              alt="Coworx Central desks with privacy partitions and ergonomic chairs"
              fetchPriority="high"
            />
            <div className="heroPhotoLabel">
              <span className="liveDot" />
              <span>YOUR FOCUS STARTS HERE</span>
              <b>01 / THE WORKSPACE</b>
            </div>
            <button className="heroMiniPhoto" onClick={() => book("podcast")}>
              <img src={studioImage} alt="Coworx creator studio" />
              <span>
                A space to create <ArrowUpRight size={16} />
              </span>
            </button>
            <span className="heroVerticalLabel">WORK. CONNECT. CREATE.</span>
          </div>
        </section>
      )}
      <div className="amenityRibbon">
        <span>
          <Wifi /> High-speed Wi-Fi
        </span>
        <span>
          <Coffee /> Tea & coffee
        </span>
        <span>
          <Monitor /> Comfortable workstations
        </span>
        <span>
          <Clock3 /> 9 AM–7 PM
        </span>
      </div>
      <section className="homeSpaces" id="spaces">
        <div className="sectionHeading">
          <div>
            <span className="eyebrow">SPACE TO DO YOUR THING</span>
            <h2>One place. So many possibilities.</h2>
          </div>
          <p>
            From solo focus to team breakthroughs,
            <br />
            choose the space that fits your day.
          </p>
        </div>
        <div className="workspaceCards">
          {spaces.map(([s, title, label, Icon, img, price], i) => (
            <article key={s}>
              <button
                className="workspaceImage"
                onClick={() => book(s)}
                aria-label={`Book ${label}`}
              >
                <img src={img} alt={label} loading="lazy" />
                <span className="spaceNumber">0{i + 1}</span>
                <span className="spaceArrow">
                  <ArrowUpRight size={19} />
                </span>
              </button>
              <div className="workspaceCardCopy">
                <span className="spaceType">
                  <Icon size={15} />
                  {label}
                </span>
                <h3>{title}</h3>
                <button className="spacePrice" onClick={() => book(s)}>
                  {price}
                  <ArrowRight size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="homeStory">
        <div className="storyImage">
          <img
            src={teamImage}
            alt="Coworx Central conference room ready for a team session"
            loading="lazy"
          />
          <button onClick={() => setTour("360")}>
            <span className="playCircle">
              <ArrowUpRight size={17} />
            </span>
            Explore the 360° tour
          </button>
        </div>
        <div className="storyCopy">
          <span className="eyebrow">MORE THAN A PLACE TO SIT</span>
          <h2>
            Bring your ambition.
            <br />
            We’ll make room.
          </h2>
          <p>
            Step out of the distractions and into a space built for your work.
            Meet clients with confidence, collaborate comfortably, and find your
            rhythm at Coworx Central.
          </p>
          <div className="storyBenefits">
            <div>
              <span>01</span>
              <section>
                <h4>Show up. Settle in.</h4>
                <p>
                  Wi-Fi, power, air conditioning, and a workspace that’s ready
                  when you are.
                </p>
              </section>
            </div>
            <div>
              <span>02</span>
              <section>
                <h4>A day, an hour, or a little longer.</h4>
                <p>
                  Flexible desk days and hourly rooms. Book what your work
                  needs.
                </p>
              </section>
            </div>
            <div>
              <span>03</span>
              <section>
                <h4>Keep your day moving.</h4>
                <p>
                  Book online, keep your digital pass handy, and let reception
                  take care of arrival.
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>
      <section className="visitBand">
        <div>
          <span className="eyebrow">MEET YOUR NEW WORKPLACE</span>
          <h2>
            Come for the space.
            <br />
            Stay for the possibilities.
          </h2>
          <p>
            <MapPin size={16} /> Vinkar Society, C-26, MIDC, Solapur
          </p>
        </div>
        <div>
          <a className="primary" href="tel:+917517517732">
            Talk to the team <ArrowUpRight size={18} />
          </a>
          <button className="textButton" onClick={() => book("desk")}>
            Or book your first day <ArrowRight size={16} />
          </button>
        </div>
      </section>
      {tour && (
        <Dialog
          title={
            tour === "video"
              ? "A look inside Coworx Central"
              : "Explore Coworx in 360°"
          }
          wide
          onClose={() => setTour(null)}
        >
          {tour === "video" ? (
            <video
              className="tourVideo"
              src="/workspace-tour.mp4"
              controls
              playsInline
              preload="metadata"
            />
          ) : (
            <Suspense
              fallback={<div className="skeleton" style={{ height: 400 }} />}
            >
              <Pano360 />
            </Suspense>
          )}
        </Dialog>
      )}
    </main>
  );
}
