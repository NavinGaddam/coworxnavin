import { useEffect, useState } from "react";
import { CalendarDays, Download, MapPin, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import Dialog from "./Dialog";
import { ensureBookingPass } from "../lib/platform";
import { passPayload } from "../lib/booking-pass";
export default function BookingPass({ booking, onClose }: any) {
  const [data, setData] = useState<any>(booking),
    [qr, setQr] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = booking.passToken
          ? booking
          : await ensureBookingPass(booking.id);
        const url = await QRCode.toDataURL(passPayload(b.id, b.passToken), {
          width: 320,
          margin: 3,
          errorCorrectionLevel: "M",
          color: { dark: "#10231d", light: "#ffffff" },
        });
        if (alive) {
          setData(b);
          setQr(url);
        }
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [booking.id]);
  return (
    <Dialog title="Your booking pass" onClose={onClose}>
      <div className="bookingPass">
        <div className="passBrand">
          COWORX <span>CENTRAL</span>
        </div>
        <span className="statePill good">
          <ShieldCheck size={14} /> Confirmed booking
        </span>
        <h2>{data.customerName || "Coworx member"}</h2>
        <p>
          {data.label} ·{" "}
          {(data.inventoryIds || [])
            .map((id: string) => id.replace("desk-", ""))
            .join(", ")}
        </p>
        <div className="qrFrame">
          {qr ? (
            <img
              src={qr}
              alt="Coworx booking QR pass"
              width="280"
              height="280"
            />
          ) : error ? (
            <p role="alert">{error}</p>
          ) : (
            <div className="skeleton" style={{ width: 250, height: 250 }} />
          )}
        </div>
        <strong>Show this code at reception</strong>
        <p className="muted">Staff will scan it to check you in and out.</p>
        <div className="passDetails">
          <span>
            <CalendarDays size={16} />
            {data.date}
            {data.endDate && data.endDate !== data.date
              ? ` → ${data.endDate}`
              : ""}
          </span>
          <span>
            {data.start ? `${data.start}–${data.end}` : "9:00 AM–7:00 PM"}
          </span>
          <span>
            <MapPin size={16} /> Coworx Central · Solapur
          </span>
        </div>
        {qr && (
          <a
            className="ghost"
            href={qr}
            download={`coworx-pass-${data.id}.png`}
          >
            <Download size={16} /> Save QR for offline use
          </a>
        )}
      </div>
    </Dialog>
  );
}
