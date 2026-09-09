import { useEffect, useState } from "react";
import {
  loadDeskPricing,
  loadPricing,
  saveDeskPricing,
} from "../lib/firestore";
import { localToday } from "../pages/types";
export default function DeskRates({ onFlash }: any) {
  const [date, setDate] = useState(localToday()),
    [rates, setRates] = useState<any>({}),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    setLoading(true);
    loadPricing()
      .then((p) => loadDeskPricing(date, p))
      .then((r) => {
        if (current) {
          setRates(r);
          setLoading(false);
        }
      })
      .catch((e) => onFlash(e.message));
    return () => {
      current = false;
    };
  }, [date]);
  return (
    <section className="opsPanel">
      <h3>Desk rates for a specific date</h3>
      <p className="opsNote">
        Override individual desk rates for this date. Seasonal rates take
        priority when a rule is active.
      </p>
      <label className="fieldLabel">
        Date
        <input
          type="date"
          min={localToday()}
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
      </label>
      {loading ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : (
        <div className="deskRatesGrid">
          {Object.entries(rates).map(([id, value]) => (
            <label key={id}>
              {id}
              <input
                type="number"
                min="0"
                value={Number(value)}
                onChange={(e) =>
                  setRates({ ...rates, [id]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
      )}
      <div className="formActions">
        <button
          className="primary"
          disabled={busy || loading}
          onClick={async () => {
            if (
              Object.values(rates).some(
                (n) => !Number.isFinite(n) || Number(n) < 0,
              )
            )
              return onFlash("Enter valid non-negative desk rates.");
            setBusy(true);
            try {
              await saveDeskPricing(date, rates);
              onFlash("Desk rates saved.");
            } catch (e: any) {
              onFlash(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save desk rates"}
        </button>
      </div>
    </section>
  );
}
