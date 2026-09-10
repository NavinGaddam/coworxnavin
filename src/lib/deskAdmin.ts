import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { addDays, desks } from "../pages/types";

export type DeskFeature = { locker: boolean };
export type DeskFeatureMap = Record<string, DeskFeature>;

export const emptyDeskFeatures = (): DeskFeatureMap =>
  Object.fromEntries(desks.map((d) => [d.id, { locker: false }])) as DeskFeatureMap;

export function watchDeskFeatures(
  cb: (features: DeskFeatureMap) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    doc(db, "settings", "deskFeatures"),
    (snapshot) => {
      const raw = snapshot.exists() ? snapshot.data()?.desks || {} : {};
      cb(
        Object.fromEntries(
          desks.map((d) => [d.id, { locker: Boolean(raw?.[d.id]?.locker) }]),
        ) as DeskFeatureMap,
      );
    },
    onError,
  );
}

export async function saveDeskFeatures(features: DeskFeatureMap) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw Error("Sign in to change desk features.");
  const clean = Object.fromEntries(
    desks.map((d) => [d.id, { locker: Boolean(features?.[d.id]?.locker) }]),
  );
  await setDoc(
    doc(db, "settings", "deskFeatures"),
    { desks: clean, updatedBy: uid, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function moveLocker(
  fromDesk: string,
  toDesk: string,
  current: DeskFeatureMap,
) {
  if (!fromDesk || !toDesk || fromDesk === toDesk)
    throw Error("Choose two different desks.");
  if (!current?.[fromDesk]?.locker)
    throw Error(`${fromDesk} does not currently have a locker.`);
  const next: DeskFeatureMap = {
    ...current,
    [fromDesk]: { locker: false },
    [toDesk]: { locker: true },
  };
  await saveDeskFeatures(next);
  return next;
}

export async function saveBulkDeskRates(input: {
  regular: number;
  premium: number;
  mode: "permanent" | "range";
  startDate?: string;
  endDate?: string;
  label?: string;
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw Error("Sign in to change desk pricing.");
  const regular = Number(input.regular),
    premium = Number(input.premium);
  if (![regular, premium].every((n) => Number.isFinite(n) && n >= 0))
    throw Error("Enter valid regular and premium desk rates.");
  if (input.mode === "permanent") {
    await setDoc(
      doc(db, "settings", "pricing"),
      { desk_basic: regular, desk_premium: premium, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return;
  }
  const startDate = String(input.startDate || ""),
    endDate = String(input.endDate || startDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || endDate < startDate)
    throw Error("Choose a valid date range.");
  // Keep temporary bulk rules reasonably bounded and easy to review.
  if (addDays(startDate, 366) <= endDate)
    throw Error("Bulk date-range pricing can cover up to 366 days at a time.");
  await addDoc(collection(db, "pricingRules"), {
    label: String(input.label || "Desk bulk rate").trim() || "Desk bulk rate",
    startDate,
    endDate,
    pricing: { desk_basic: regular, desk_premium: premium },
    active: true,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
}
