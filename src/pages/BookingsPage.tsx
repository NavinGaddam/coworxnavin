import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
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
import BookingPass from "../components/BookingPass";
import Dialog from "../components/Dialog";
import { localToday } from "./types";
export default function BookingsPage({
  bookings = [],
  staff = false,
  can = () => false,
  user,
  company,
  wifi,
  loading = false,
  onFlash,
  book,
}: any) {
  const [filter, setFilter] = useState(staff ? "all" : "upcoming"),
    [search, setSearch] = useState(""),
    [date, setDate] = useState("");
  const [pass, setPass] = useState<any>(null),
    [payment, setPayment] = useState<any>(null),
    [cancelling, setCancelling] = useState<any>(null),
    [wifiOpen, setWifiOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
            (!date || (b.date <= date && (b.endDate || b.date) >= date)) &&
            (filter === "all" ||
              (filter === "pending" && state === "Pending") ||
              (filter === "upcoming" &&
                ["Pending", "Confirmed"].includes(state) &&
                (b.endDate || b.date) >= localToday()) ||
              (filter === "past" &&
                state === "Confirmed" &&
                (b.endDate || b.date) < localToday()) ||
              (filter === "cancelled" &&
                ["Cancelled", "Expired"].includes(state)))
          );
        })
        .sort((a: any, b: any) =>
          (b.date + (b.start || "")).localeCompare(a.date + (a.start || "")),
        ),
    [bookings, search, filter, date, tick],
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
    <section className="workspacePage">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">
            {staff ? "OPERATIONS" : "YOUR COWORX"}
          </span>
          <h1>{staff ? "Bookings" : "My bookings"}</h1>
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
            ? ["all", "pending", "upcoming", "past", "cancelled"]
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
        <input
          type="date"
          aria-label="Filter booking date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {date && (
          <button className="textButton" onClick={() => setDate("")}>
            Clear date
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
                  {b.start || "09:00"}–{b.end || "19:00"}
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
              <div className="reservationActions">
                {status(b) === "Confirmed" && (
                  <>
                    <button
                      className="primary small"
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
                    {(!staff || can("bookingsExtend")) && (
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
                  can("bookingsConfirm") &&
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
                {search || date
                  ? "Try a different search or date."
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
            released. Any recorded payment will enter refund review.
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
      {payment && (
        <Dialog
          title="Review payment"
          onClose={() => !busy && setPayment(null)}
        >
          <p>
            {payment.b.customerName} · {payment.b.label}
          </p>
          <div className="fieldGrid">
            {can("bookingsDiscount") && (
              <label>
                Additional discount ₹
                <input
                  type="number"
                  min="0"
                  max={payment.b.total}
                  value={payment.discount}
                  onChange={(e) =>
                    setPayment({ ...payment, discount: Number(e.target.value) })
                  }
                />
              </label>
            )}
            <label>
              Total amount received ₹
              <input
                type="number"
                min="0"
                value={payment.received}
                onChange={(e) =>
                  setPayment({ ...payment, received: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Payment method
              <select
                value={payment.method}
                onChange={(e) =>
                  setPayment({ ...payment, method: e.target.value })
                }
              >
                <option>UPI</option>
                <option>Cash</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Payment reference
              <input
                value={payment.ref}
                onChange={(e) =>
                  setPayment({ ...payment, ref: e.target.value })
                }
              />
            </label>
          </div>
          <p>
            Booking total:{" "}
            <strong>
              ₹{Math.max(0, Number(payment.b.total || 0) - payment.discount)}
            </strong>
          </p>
          <small>
            Enter the cumulative amount received. Confirming with ₹0 keeps
            payment pending.
          </small>
          {error && <p className="inlineError">{error}</p>}
          <div className="formActions">
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    confirmBooking(
                      payment.b.id,
                      user.uid,
                      Number(payment.b.staffDiscount || 0) + payment.discount,
                      payment.received,
                      payment.method,
                      payment.ref,
                    ),
                  "Booking and payment updated.",
                )
              }
            >
              <CheckCircle2 size={17} />
              {busy ? "Saving…" : "Save & confirm"}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
