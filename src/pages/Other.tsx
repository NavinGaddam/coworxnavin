import { useEffect, useState } from "react";
import { Copy, Gift, Tag } from "lucide-react";
import { Offer } from "./types";
import { watchMembershipPlans, watchCoupons } from "../lib/firestore";
import "./ops.css";
import "./ui-fixes.css";
import "./booking-enhancements.css";

const percentLabel = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n * 100) / 100}%` : "0%";
};

export function OffersPage({ offers }: { offers: Offer[] }) {
  const [plans, setPlans] = useState<any[]>([]),
    [coupons, setCoupons] = useState<any[]>([]);
  useEffect(() => {
    const a = watchMembershipPlans(setPlans, () => {}),
      b = watchCoupons(setCoupons, () => {}, true);
    return () => {
      a();
      b();
    };
  }, []);
  const publicCoupons = coupons.filter(
    (c) => c.active && c.visibleToUsers === true,
  );
  return (
    <main className="simple">
      <span className="eyebrow">MY OFFERS</span>
      <h2>Offers, coupons & passes</h2>
      <div className="offerCards">
        {offers.length ? (
          offers.map((o) => (
            <article className="offerCard" key={o.id}>
              <span className="offerIcon"><Gift /></span>
              <div className="offerTop">
                <span className="offerPill">SPECIAL OFFER</span>
                <h3>{o.title}</h3>
              </div>
              <p>{o.description}</p>
              <strong>
                {o.type === "percent"
                  ? `${percentLabel(o.value)} OFF`
                  : `₹${Number(o.value || 0).toLocaleString("en-IN")} OFF`}
              </strong>
            </article>
          ))
        ) : (
          <article className="info">
            <span className="cardIcon"><Tag /></span>
            <h3>No active offers</h3>
            <p>Coworx Central promotions will appear here.</p>
          </article>
        )}
      </div>
      {publicCoupons.length > 0 && (
        <section className="membershipPublic panel">
          <div>
            <span className="eyebrow">COUPON CODES</span>
            <h3>Pick a coupon while booking</h3>
            <p>Public codes appear directly in the booking dropdown.</p>
          </div>
          <div className="membershipGrid">
            {publicCoupons.map((c) => (
              <article key={c.id}>
                <b>{c.code}</b>
                <span>
                  {c.type === "percent"
                    ? `${percentLabel(c.value)} off`
                    : `₹${Number(c.value || 0).toLocaleString("en-IN")} off`} ·{" "}
                  {c.maxUsesPerCustomer ?? c.maxUses ?? 1} use(s) per customer
                </span>
                <button className="ghost small" onClick={() => navigator.clipboard?.writeText(c.code)}>
                  <Copy size={15} /> Copy code
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="membershipPublic panel">
        <div>
          <span className="eyebrow">CONSECUTIVE PASSES</span>
          <h3>Work more, save more</h3>
          <p>Passes use working days configured by Coworx Central and require full advance payment before activation.</p>
        </div>
        <div className="membershipGrid">
          {plans.filter((p) => p.active !== false).length ? (
            plans.filter((p) => p.active !== false).map((p) => (
              <article key={p.id}>
                <b>{p.name}</b>
                <span>{p.description || "Flexible workspace access"}</span>
                <strong>₹{Number(p.price || 0).toLocaleString("en-IN")}</strong>
                <small>
                  {p.deskDays || p.days} working days ·{" "}
                  {(p.deskDays || p.days) === 10 ? 1 : (p.deskDays || p.days) === 20 ? 2 : 3} reschedule(s)
                </small>
              </article>
            ))
          ) : (
            <p className="muted">No membership plans published yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
