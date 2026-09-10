import { watchPayments, downloadReceipt } from "../lib/finance";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  CheckCircle2,
  Download,
  MessageCircle,
  Plus,
  QrCode,
  Search,
  WalletCards,
  Wifi,
} from "lucide-react";
import { cancelBooking, confirmBooking, extendBooking } from "../lib/firestore";
import PaymentDialog from "../components/PaymentDialog";
import PassActions from "../components/PassActions";
import { balance, bookingOn, cancellationQuote, money, paymentAccessError, sessionHours } from "../lib/business";
import BookingPass from "../components/BookingPass";
import Dialog from "../components/Dialog";
import { localToday } from "./types";
import { DatePicker } from "./DatePicker";

const createdMillis=(b:any)=>b.createdAt?.toMillis?.()||b.createdAt?.toDate?.()?.getTime?.()||0;
const bookedAt=(b:any)=>{const date=b.createdAt?.toDate?.();return date?date.toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}):"Time unavailable";};
export default function BookingsPage({
  bookings = [],
  staff = false,
  passesOnly = false,
  can = () => false,
  user,
  company,
  wifi,
  loading = false,
  onFlash,
  book,
}: any) {
  const [filter, setFilter] = useState(staff ? "today" : "upcoming"),
    [search, setSearch] = useState(""),
    [fromDate, setFromDate] = useState(""),
    [toDate, setToDate] = useState("");
  const [pass, setPass] = useState<any>(null),
    [payment, setPayment] = useState<any>(null),
    [cancelling, setCancelling] = useState<any>(null),
    [wifiOpen, setWifiOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [receipts,setReceipts]=useState<any[]>([]);
  useEffect(()=>{if(staff&&!can("collectionsView"))return;return watchPayments(setReceipts,e=>onFlash(e.message),staff?undefined:{uid:user.uid,email:user.email});},[staff,user.uid]);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const status = (b: any) =>
    b.status === "Pending" && (b.expiresAt?.toMillis?.() || 0) <= tick
      ? "Expired"
      : b.status;
  const rows = useMemo(
    () =>
      bookings
        .filter((b: any) => {
          const state = status(b);
          return (
            (!passesOnly || !!b.passDays) &&
            (!search ||
              [
                b.customerName,
                b.customerEmail,
                b.label,
                ...(b.inventoryIds || []),
              ]
                .join(" ")
                .toLowerCase()
                .includes(search.toLowerCase())) &&
            (!fromDate || (b.endDate||b.date)>=fromDate) &&
            (!toDate || b.date<=toDate) &&
            (filter === "all" ||
              (filter === "today" && bookingOn(b,localToday()) && ["Pending","Confirmed"].includes(state)) ||
              (filter === "pending" && state === "Pending") ||
              (filter === "upcoming" &&
                ["Pending", "Confirmed"].includes(state) &&
                (staff ? b.date>localToday() : (b.endDate || b.date) >= localToday())) ||
              (filter === "past" &&
                state === "Confirmed" &&
                (b.endDate || b.date) < localToday()) ||
              (filter === "cancelled" &&
                ["Cancelled", "Expired"].includes(state)))
          );
        })
        .sort((a: any, b: any) => createdMillis(b)-createdMillis(a) || (b.date + (b.start || "")).localeCompare(a.date + (a.start || ""))),
    [bookings, search, filter, fromDate, toDate, tick, passesOnly, staff],
  );
  const run = async (fn: () => Promise<any>, success: string) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onFlash(success);
      setPayment(null);
      setCancelling(null);
    } catch (e: any) {
      setError(e.message);
      onFlash(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="workspacePage bookingsListPage">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">
            {staff ? "OPERATIONS" : "YOUR COWORX"}
          </span>
          <h1>{passesOnly ? "Consecutive passes" : staff ? "Bookings" : "My bookings"}</h1>
          <p>
            {staff
              ? "Manage reservations, payments and customer requests."
              : "Your plans, passes and receipts, all in one place."}
          </p>
        </div>
        {(!staff || can("bookingsCreate")) && (
          <button className="primary" onClick={book}>
            <Plus size={18} /> New booking
          </button>
        )}
      </div>
      <div className="listToolbar">
        <div className="segmented">
          {(staff
            ? ["today", "upcoming", "past", "pending", "all", "cancelled"]
            : ["upcoming", "past", "cancelled"]
          ).map((id) => (
            <button
              key={id}
              className={filter === id ? "active" : ""}
              onClick={() => setFilter(id)}
            >
              {id === "pending"
                ? "Needs payment"
                : id[0].toUpperCase() + id.slice(1)}
            </button>
          ))}
        </div>
        <label className="searchInput">
          <Search size={16} />
          <input
            aria-label="Search bookings"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Customer, desk or space"
          />
        </label>
        <div className="bookingDateRange" aria-label="Booking date range">
          <DatePicker value={fromDate} onChange={value=>{setFromDate(value);if(toDate&&toDate<value)setToDate(value);}} placeholder="From date"/>
          <span>to</span>
          <DatePicker value={toDate} onChange={setToDate} min={fromDate||undefined} placeholder="To date"/>
        </div>
        {(fromDate||toDate) && (
          <button className="textButton" onClick={() => {setFromDate("");setToDate("");}}>
            Clear range
          </button>
        )}
      </div>
      {loading ? (
        <div className="skeletonStack">
          {[1, 2, 3].map((i) => (
            <div className="skeleton" style={{ height: 160 }} key={i} />
          ))}
        </div>
      ) : (
        <div className="reservationList">
          {rows.map((b: any) => (
            <article className="reservationCard surface" key={b.id}>
              <div className="sectionHeading">
                <div>
                  <span className="eyebrow">
                    {(b.inventoryIds || [])
                      .map((x: string) => x.replace("desk-", ""))
                      .join(" · ") || b.space}
                  </span>
                  <h3>{b.label}</h3>
                  <p>
                    {staff
                      ? b.customerName || b.customerEmail
                      : "Coworx Central · Solapur"}
                  </p>
                  <span className="bookingCreated"><Clock3 size={14}/>Booked {bookedAt(b)} · {b.walkIn?"Front desk":b.checkoutChannel==="whatsapp"?"WhatsApp request":"Online"}</span>
                </div>
                <span
                  className={`statePill ${status(b) === "Confirmed" ? "good" : status(b) === "Pending" ? "warn" : ""}`}
                >
                  {status(b)}
                </span>
              </div>
              <div className="reservationFacts">
                <span>
                  <CalendarDays size={16} />
                  {b.date}
                  {b.endDate && b.endDate !== b.date ? ` → ${b.endDate}` : ""}
                </span>
                <span>
                  {sessionHours(b,b.date).start}–{sessionHours(b,b.date).end}
                </span>
                <strong>₹{Number(b.total || 0).toLocaleString("en-IN")}</strong>
                <span>
                  Payment: {b.paymentStatus || "Pending"}
                  {b.paymentReceived ? ` · ₹${b.paymentReceived} received` : ""}
                </span>
              </div>
              {status(b) === "Pending" && (
                <p className="holdNote">
                  Slot held for{" "}
                  {Math.max(
                    0,
                    Math.ceil(
                      ((b.expiresAt?.toMillis?.() || 0) - tick) / 60000,
                    ),
                  )}{" "}
                  more minutes while payment is completed.
                </p>
              )}
              {receipts.some(r=>r.bookingId===b.id)&&<details><summary>Payment receipts</summary>{receipts.filter(r=>r.bookingId===b.id).map(r=><div className="historyReceipt" key={r.id}><span>{r.date} · {r.kind} · {money(r.amount)}</span><button className="ghost" onClick={()=>downloadReceipt(r,company).catch(e=>onFlash(e.message))}>Download receipt</button></div>)}</details>}
              {b.passDays>0&&<PassActions booking={b} staff={staff} can={can} onFlash={onFlash}/>}
              {balance(b)>0&&b.status==="Confirmed"&&<p className="noticeBox">Balance: {money(balance(b))}{b.balanceDueDate?` · Due ${b.balanceDueDate}`:" · Collect full payment before entry"}</p>}
              <div className="reservationActions">
                {status(b) === "Confirmed" && (
                  <>
                    <button
                      className="primary small"
                      disabled={!!paymentAccessError(b)}
                      title={paymentAccessError(b)}
                      onClick={() => setPass(b)}
                    >
                      <QrCode size={16} /> Booking pass
                    </button>
                    <button
                      className="ghost small"
                      onClick={() =>
                        import("../lib/invoice")
                          .then((m) => m.downloadInvoice(b, company))
                          .catch(() =>
                            onFlash(
                              "Could not generate the receipt. Please try again.",
                            ),
                          )
                      }
                    >
                      <Download size={16} />{" "}
                      {company?.gstNumber ? "Invoice" : "Receipt"}
                    </button>
                    {!staff && (
                      <button
                        className="ghost small"
                        onClick={() => setWifiOpen(true)}
                      >
                        <Wifi size={16} /> Wi-Fi
                      </button>
                    )}
                    {!b.passDays && (!staff || can("bookingsExtend")) && (
                      <button
                        className="ghost small"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              extendBooking(b.id, {
                                extraDays: b.start ? undefined : 1,
                                extraHours: b.start ? 1 : undefined,
                                uid: user.uid,
                              }),
                            "Extension requested. Complete payment to confirm it.",
                          )
                        }
                      >
                        <Plus size={16} /> Request extension
                      </button>
                    )}
                  </>
                )}
                {staff &&
                  can("paymentsCollect") && (status(b)==="Pending" || balance(b)>0) &&
                  ["Pending", "Confirmed"].includes(status(b)) && (
                    <button
                      className="ghost small"
                      onClick={() => {
                        setPayment({
                          b,
                          discount: 0,
                          received: Number(b.paymentReceived || 0),
                          method: "UPI",
                          ref: "",
                        });
                        setError("");
                      }}
                    >
                      <WalletCards size={16} />
                      {status(b) === "Pending"
                        ? "Review & confirm"
                        : "Record payment"}
                    </button>
                  )}
                {(!staff || can("bookingsCancel")) &&
                  ["Pending", "Confirmed"].includes(status(b)) && (
                    <button
                      className="textButton dangerText"
                      onClick={() => {
                        setCancelling(b);
                        setError("");
                      }}
                    >
                      Cancel booking
                    </button>
                  )}
                {status(b) === "Pending" && !staff && (
                  <a
                    className="ghost small"
                    href={`https://wa.me/919970836509?text=${encodeURIComponent("Please confirm my Coworx booking " + b.id + " · " + b.label + " · " + b.date + " · ₹" + b.total)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={16} /> Complete on WhatsApp
                  </a>
                )}
                {b.customerPhone && staff && (
                  <a
                    className="textButton"
                    href={`https://wa.me/${String(b.customerPhone).replace(/\D/g, "").length === 10 ? "91" : ""}${String(b.customerPhone).replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={16} /> Contact
                  </a>
                )}
              </div>
            </article>
          ))}
          {!rows.length && (
            <div className="emptyState surface">
              <CalendarDays />
              <h3>No bookings here yet</h3>
              <p>
                {search || fromDate || toDate
                  ? "Try a different search or date range."
                  : "Your next workday is just a booking away."}
              </p>
              <button className="primary" onClick={book}>
                Find a workspace
              </button>
            </div>
          )}
        </div>
      )}
      {pass && <BookingPass booking={pass} onClose={() => setPass(null)} />}{" "}
      {wifiOpen && (
        <Dialog title="Workspace Wi-Fi" onClose={() => setWifiOpen(false)}>
          <div className="fieldGrid">
            <label>
              Network
              <strong>{wifi?.ssid || "Ask reception for the network."}</strong>
            </label>
            <label>
              Password
              <strong>{wifi?.password || "Available at reception"}</strong>
            </label>
          </div>
          <p>{wifi?.note}</p>
        </Dialog>
      )}
      {cancelling && (
        <Dialog
          title="Cancel this booking?"
          onClose={() => !busy && setCancelling(null)}
        >
          <p>
            {cancelling.label} · {cancelling.date}. The reserved space will be
            released. Refund eligible for review: {money(cancellationQuote(cancelling).refund)}.
            {cancellationQuote(cancelling).beforeCutoff ? " This is before the cancellation cutoff." : " The cancellation cutoff has passed."}
          </p>
          {error && <p className="inlineError">{error}</p>}
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              run(
                () => cancelBooking(cancelling.id, user.uid),
                "Booking cancelled.",
              )
            }
          >
            {busy ? "Cancelling…" : "Confirm cancellation"}
          </button>
        </Dialog>
      )}
      {payment && <PaymentDialog booking={payment.b} canDiscount={can("bookingsDiscount")} onClose={()=>setPayment(null)} onSaved={(receipt:string)=>{setPayment(null);onFlash(`Payment saved. Receipt ${receipt}.`);}}/>}
    </section>
  );
}
