import { useState } from "react";
import { Search, Users, Monitor, ArrowRight } from "lucide-react";
import Dialog from "./Dialog";
import { customerMatches } from "../lib/customer";
import { desks } from "../pages/types";
export default function CommandSearch({
  onClose,
  openCustomer,
  users,
  bookings,
  nav,
  can,
  bookDesk,
  prices,
}: any) {
  const [q, setQ] = useState("");
  const customers =
    can("customersView") && q.trim()
      ? users.filter((u: any) => customerMatches(u, q)).slice(0, 5)
      : [];
  const matches = desks
    .filter((d) => d.id.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 5);
  return (
    <Dialog title="Find anything" onClose={onClose}>
      <label className="commandInput">
        <Search size={20} />
        <input
          autoFocus
          aria-label="Search customers and desks"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a name, email, or desk…"
        />
      </label>
      <div className="commandResults">
        {customers.map((u: any) => (
          <button
            key={u.uid}
            onClick={() => {
              openCustomer(u);
              onClose();
            }}
          >
            <Users size={18} />
            <span>
              <b>{u.name}</b>
              <small>
                {
                  bookings.filter((b: any) => b.customerEmail === u.email)
                    .length
                }{" "}
                bookings · {u.email}
              </small>
            </span>
            <ArrowRight size={17} />
          </button>
        ))}
        {matches.map((d) => (
          <button
            key={d.id}
            onClick={() => {
              bookDesk(d.id);
              onClose();
            }}
          >
            <Monitor size={18} />
            <span>
              <b>Desk {d.id}</b>
              <small>
                {d.premium ? "Premium" : "Regular"} · ₹
                {d.premium ? prices.desk_premium : prices.desk_basic}/day ·
                Check availability
              </small>
            </span>
            <ArrowRight size={17} />
          </button>
        ))}
        {!customers.length && !matches.length && (
          <p className="muted">No matching customer or desk.</p>
        )}
      </div>
      <small className="muted">Press Esc to close · Ctrl / ⌘ K to search</small>
    </Dialog>
  );
}
