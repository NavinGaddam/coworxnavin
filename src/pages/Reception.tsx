import { bookingOn, paymentAccessError, sessionHours, sessionState } from "../lib/business";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  LogIn,
  LogOut,
  ScanLine,
  Search,
  Users,
} from "lucide-react";
import QRScanner from "../components/QRScanner";
import Dialog from "../components/Dialog";
import { lookupPass, recordAttendance } from "../lib/platform";
import { attendanceError } from "../lib/booking-pass";
import { localToday } from "./types";
export default function Reception({
  bookings = [],
  scanRequest = 0,
  can,
  onFlash,
  bookCustomer,
}: any) {
  const [query, setQuery] = useState(""),
    [scanner, setScanner] = useState(false),
    [selected, setSelected] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(()=>{if(scanRequest)setScanner(true);},[scanRequest]);
  const today = localToday(),
    todayRows = bookings.filter(
      (b: any) =>
        b.status === "Confirmed" &&
        bookingOn(b,today),
    );
  const inside = todayRows.filter(
    (b: any) => sessionState(b)==="Inside",
  );
  const rows = useMemo(
    () =>
      todayRows.filter((b: any) =>
        [
          b.customerName,
          b.customerEmail,
          b.customerPhone,
          b.label,
          ...(b.inventoryIds || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [todayRows, query],
  );
  const scan = async (raw: string) => {
    setBusy(true);
    setError("");
    try {
      const b = await lookupPass(raw);
      setSelected(b);
      setScanner(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const mark = async (action: "in" | "out") => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const message = await recordAttendance(
        selected.id,
        action,
        selected.passToken,
      );
      setSelected(null);
      onFlash(message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="workspacePage receptionPage">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">DAILY OPERATIONS</span>
          <h1>Front desk</h1>
          <p>
            Welcome customers, validate their pass, and keep arrivals moving.
          </p>
        </div>
        <div className="buttonRow">
          {can("bookingsCreate") && (
            <button className="ghost" onClick={bookCustomer}>
              Walk-in booking <ArrowRight size={16} />
            </button>
          )}
          {(can("checkIn") || can("checkOut")) && (
            <button
              className="primary"
              onClick={() => {
                setError("");
                setScanner(true);
              }}
            >
              <ScanLine size={18} /> Scan booking pass
            </button>
          )}
        </div>
      </div>
      <div className="statStrip">
        <div>
          <Users />
          <strong>{todayRows.length}</strong>
          <span>Expected today</span>
        </div>
        <div>
          <LogIn />
          <strong>{inside.length}</strong>
          <span>Checked in</span>
        </div>
        <div>
          <CheckCircle2 />
          <strong>
            {
              todayRows.filter(
                (b: any) => b.attendanceDate === today && b.checkedOutAt,
              ).length
            }
          </strong>
          <span>Checked out</span>
        </div>
      </div>
      <div className="surface">
        <div className="sectionHeading">
          <div>
            <h3>Today’s guest list</h3>
            <p>{today} · Confirmed bookings</p>
          </div>
          <label className="searchInput">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find customer or desk"
              aria-label="Find customer or desk"
            />
          </label>
        </div>
        <div className="guestList">
          {rows.map((b: any) => {
            const state = sessionState(b);
            return (
              <button
                className="guestRow"
                key={b.id}
                onClick={() => {
                  setSelected(b);
                  setError("");
                }}
              >
                <span className="avatar">{(b.customerName || "?")[0]}</span>
                <span>
                  <b>{b.customerName || b.customerEmail}</b>
                  <small>
                    {b.label} ·{" "}
                    {(b.inventoryIds || [])
                      .map((x: string) => x.replace("desk-", ""))
                      .join(", ")}{" "}
                    · {sessionHours(b,today).start}–{sessionHours(b,today).end}
                  </small>
                </span>
                <span
                  className={`statePill ${state === "Inside" ? "good" : ""}`}
                >
                  {state}
                </span>
                <ArrowRight size={17} />
              </button>
            );
          })}
          {!rows.length && (
            <div className="emptyState">
              <Users />
              <h3>No guests found</h3>
              <p>Confirmed bookings for today will appear here.</p>
            </div>
          )}
        </div>
      </div>
      {scanner && (
        <Dialog title="Scan booking pass" onClose={() => setScanner(false)}>
          <QRScanner onScan={scan} />
          {busy && <p role="status">Verifying pass…</p>}
          {error && (
            <p className="inlineError" role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {selected && (
        <Dialog title="Guest arrival" onClose={() => setSelected(null)}>
          <div className="arrivalCard">
            <span className="avatar">{(selected.customerName || "?")[0]}</span>
            <h2>{selected.customerName || selected.customerEmail}</h2>
            <p>{selected.customerEmail}</p>
            <p>
              {selected.label} · {selected.date} · {sessionHours(selected,today).start}–
              {sessionHours(selected,today).end}
            </p>
            <div className="buttonRow">
              {can("checkIn") && (
                <button
                  className="primary"
                  title={attendanceError(selected, today, "in")}
                  disabled={
                    busy || Boolean(attendanceError(selected, today, "in"))
                  }
                  onClick={() => mark("in")}
                >
                  <LogIn size={17} /> {selected.checkedOutAt&&selected.attendanceDate===today?"Record re-entry":"Check in"}
                </button>
              )}
              {can("checkOut") && (
                <button
                  className="ghost"
                  title={attendanceError(selected, today, "out")}
                  disabled={
                    busy || Boolean(attendanceError(selected, today, "out"))
                  }
                  onClick={() => mark("out")}
                >
                  <LogOut size={17} /> Check out
                </button>
              )}
            </div>
            <p className="muted">
              {selected.attendanceDate === today && selected.checkedInAt
                ? selected.checkedOutAt
                  ? "Departure recorded. Re-entry is allowed until the session ends."
                  : "Currently checked in."
                : "Confirm the customer’s identity before checking them in."}
            </p>
            {error && (
              <p className="inlineError" role="alert">
                {error}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </section>
  );
}
