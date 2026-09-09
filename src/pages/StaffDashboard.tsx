import { bookingOn, sessionHours, sessionState } from "../lib/business";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ScanLine,
  Users,
  WalletCards,
} from "lucide-react";
import { localToday } from "./types";
export default function StaffDashboard({
  user,
  bookings = [],
  locks = [],
  blocks = [],
  can,
  nav,
  bookCustomer,
  loading = false,
}: any) {
  const today = localToday(),
    active = (b: any) =>
      b.status === "Confirmed" ||
      (b.status === "Pending" && (b.expiresAt?.toMillis?.() || 0) > Date.now());
  const todays = bookings.filter(
    (b: any) => bookingOn(b,today) && active(b),
  );
  const occupied = new Set(
    locks
      .filter(
        (l: any) =>
          l.status === "Confirmed" && String(l.inventoryId).startsWith("desk-"),
      )
      .map((l: any) => l.inventoryId),
  );
  const held = new Set(
    locks
      .filter(
        (l: any) =>
          l.status === "Pending" &&
          active(l) &&
          String(l.inventoryId).startsWith("desk-"),
      )
      .map((l: any) => l.inventoryId),
  );
  const maintenance = new Set(
    blocks
      .filter(
        (b: any) => b.active !== false && /^(desk-)?D\d/.test(b.inventoryId),
      )
      .map((b: any) =>
        b.inventoryId.startsWith("desk-")
          ? b.inventoryId
          : `desk-${b.inventoryId}`,
      ),
  );
  const unavailable = new Set([...occupied, ...held, ...maintenance]);
  const pending = bookings.filter(
    (b: any) => b.status === "Pending" && active(b),
  );
  const arrivals = todays.filter(
    (b: any) =>
      b.status === "Confirmed" &&
      !(b.attendanceDate === today && b.checkedInAt),
  );
  const inside = todays.filter(
    (b: any) => sessionState(b)==="Inside",
  );
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const overdue = todays.filter((b:any)=>sessionState(b)==="Ended" && b.attendanceDate===today && b.checkedInAt && !b.checkedOutAt);
  return (
    <section className="workspacePage staffOverview">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">
            {new Intl.DateTimeFormat("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "Asia/Kolkata",
            }).format(new Date())}
          </span>
          <h1>Your workspace, at a glance.</h1>
          <p>
            Hello, {(user.displayName || "team").split(" ")[0]}. Here’s what
            needs your attention.
          </p>
        </div>
        {can("bookingsCreate") && (
          <button className="primary" onClick={bookCustomer}>
            New walk-in booking <ArrowRight size={17} />
          </button>
        )}
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : (
        <div className="dashboardLive surface">
          <div className="sectionHeading">
            <span className="eyebrow">
              <span className="liveDot" /> LIVE DESK AVAILABILITY
            </span>
            <small>22 desks · Today</small>
          </div>
          <div className="occupancyNumbers">
            {[
              [occupied.size, "Reserved", "orange"],
              [Math.max(0, 22 - unavailable.size), "Available", "green"],
              [held.size, "Held", "amber"],
              [maintenance.size, "Maintenance", "grey"],
            ].map(([value, label, tone]) => (
              <div key={String(label)} className={String(tone)}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="occupancyTrack">
            <i style={{ width: `${(occupied.size / 22) * 100}%` }} />
            <i
              className="held"
              style={{ width: `${(held.size / 22) * 100}%` }}
            />
            <i
              className="maintenance"
              style={{ width: `${(maintenance.size / 22) * 100}%` }}
            />
          </div>
        </div>
      )}
      <div className="dashboardGrid">
        <section className="surface">
          <div className="sectionHeading">
            <div>
              <span className="eyebrow">ATTENTION NEEDED</span>
              <h3>Keep the day moving</h3>
            </div>
            <Clock3 />
          </div>
          <div className="attentionList">
            {can("paymentsCollect") &&
              pending.slice(0, 3).map((b: any) => (
                <button key={b.id} onClick={() => nav("staff-bookings")}>
                  <span className="attentionDot amber" />
                  <div>
                    <b>Payment pending</b>
                    <span>
                      {b.customerName || b.customerEmail} · {b.label}
                    </span>
                  </div>
                  <ArrowRight size={17} />
                </button>
              ))}
            {overdue.slice(0, 2).map((b: any) => (
              <button key={b.id} onClick={() => nav("reception")}>
                <span className="attentionDot orange" />
                <div>
                  <b>Session ended · departure unrecorded</b>
                  <span>
                    {b.customerName} · {b.label}
                  </span>
                </div>
                <ArrowRight size={17} />
              </button>
            ))}
            {arrivals.slice(0, 3).map((b: any) => (
              <button key={b.id} onClick={() => nav("reception")}>
                <span className="attentionDot green" />
                <div>
                  <b>Expected today</b>
                  <span>
                    {b.customerName || b.customerEmail} · {sessionHours(b,today).start}
                  </span>
                </div>
                <ArrowRight size={17} />
              </button>
            ))}
            {!pending.length && !arrivals.length && !overdue.length && (
              <div className="emptyState compact">
                <CheckCircle2 />
                <h3>You’re all caught up.</h3>
                <p>New requests and arrivals will appear here.</p>
              </div>
            )}
          </div>
        </section>
        <div className="dashboardSide">
          <section className="surface">
            <span className="eyebrow">TODAY</span>
            <div className="todayRow">
              <CalendarDays />
              <b>{todays.length}</b>
              <span>Active bookings</span>
            </div>
            <div className="todayRow">
              <Users />
              <b>{inside.length}</b>
              <span>Customers checked in</span>
            </div>
            <div className="todayRow">
              <WalletCards />
              <b>{Math.round((occupied.size / 22) * 100)}%</b>
              <span>Desks reserved</span>
            </div>
          </section>
          {(can("checkIn") || can("checkOut")) && (
            <button
              className="frontDeskShortcut"
              onClick={() => nav("reception")}
            >
              <ScanLine size={30} />
              <h3>Ready for the next arrival?</h3>
              <span>
                Open front desk <ArrowRight size={16} />
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
