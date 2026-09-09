import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  addDays,
  ADMIN_EMAILS,
  emailKey,
  localToday,
  Role,
} from "../pages/types";
import { normalizeEmail, validEmail } from "./customer";
import { attendanceError, parsePass } from "./booking-pass";
import { permissionMatrix } from "./permissions";

export function watchSetting(
  id: string,
  cb: (value: any) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    doc(db, "settings", id),
    (s) => cb(s.exists() ? s.data() : {}),
    onError,
  );
}
export function watchPermissions(
  cb: (value: any) => void,
  onError?: (e: any) => void,
) {
  return watchSetting(
    "permissions",
    (raw) => cb(permissionMatrix(raw)),
    onError,
  );
}
export function watchOwnProfile(
  uid: string,
  cb: (value: any) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    doc(db, "users", uid),
    (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null),
    onError,
  );
}
export function watchTeamAssignments(
  cb: (value: any[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    query(collection(db, "roleAssignments"), limit(200)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}
export function watchLocksRange(
  dates: string[],
  cb: (value: any[]) => void,
  onError?: (e: any) => void,
) {
  const groups: string[][] = [];
  for (let i = 0; i < dates.length; i += 10)
    groups.push(dates.slice(i, i + 10));
  const values: Record<number, any[]> = {};
  const stops = groups.map((group, i) =>
    onSnapshot(
      query(
        collection(db, "bookingLocks"),
        where("date", "in", group),
        limit(2000),
      ),
      (s) => {
        values[i] = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (Object.keys(values).length === groups.length)
          cb(Object.values(values).flat());
      },
      onError,
    ),
  );
  return () => stops.forEach((stop) => stop());
}
export async function assignStaff(
  emailInput: string,
  role: Role,
  actorUid: string,
) {
  const email = normalizeEmail(emailInput);
  if (!validEmail(email)) throw Error("Enter a valid team email.");
  if (ADMIN_EMAILS.includes(email)) throw Error("Owner access is protected.");
  if (!["Manager", "Receptionist", "User"].includes(role))
    throw Error("Select Manager, Receptionist or User.");
  const users = await getDocs(
    query(collection(db, "users"), where("email", "==", email), limit(10)),
  );
  const prior = await getDocs(
    query(collection(db, "roleAssignments"), where("email", "==", email)),
  );
  const batch = writeBatch(db);
  const assignmentId = `team_${encodeURIComponent(email)}`;
  for (const entry of prior.docs)
    if (entry.id !== assignmentId)
      batch.update(entry.ref, { status: "revoked" });
  batch.set(doc(db, "roleAssignments", assignmentId), {
    email,
    role,
    status: role === "User" ? "revoked" : "accepted",
    assignedBy: actorUid,
    assignedAt: serverTimestamp(),
  });
  for (const user of users.docs)
    batch.update(user.ref, { role, updatedAt: serverTimestamp() });
  await batch.commit();
  await addDoc(collection(db, "adminLogs"), {
    action: "SET_STAFF_ROLE",
    targetEmail: email,
    targetRole: role,
    performedByUid: actorUid,
    createdAt: serverTimestamp(),
  });
}
export async function activateAssignment(a: any, uid: string) {
  if (!["Manager", "Receptionist"].includes(a.role) || a.status === "revoked")
    return;
  const batch = writeBatch(db);
  batch.update(doc(db, "roleAssignments", a.id), {
    status: "accepted",
    acceptedAt: serverTimestamp(),
  });
  batch.update(doc(db, "users", uid), {
    role: a.role,
    roleAssignmentId: a.id,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
export async function ensureBookingPass(id: string) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "bookings", id),
      snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw Error("Booking not found.");
    const b: any = { id: snapshot.id, ...snapshot.data() };
    if (b.status !== "Confirmed")
      throw Error("A pass becomes available when your booking is confirmed.");
    if (b.passToken) return b;
    const patch = {
      passToken: crypto.randomUUID(),
      passValidFrom: Timestamp.fromDate(new Date(`${b.date}T00:00:00+05:30`)),
      passValidUntil: Timestamp.fromDate(
        new Date(`${addDays(b.endDate || b.date, 1)}T00:00:00+05:30`),
      ),
    };
    tx.update(ref, patch);
    return { ...b, ...patch };
  });
}
export async function lookupPass(raw: string) {
  const { id, token } = parsePass(raw),
    s = await getDoc(doc(db, "bookings", id));
  if (!s.exists()) throw Error("Booking not found.");
  const b: any = { id: s.id, ...s.data() };
  if (b.passToken !== token)
    throw Error(
      "This pass is invalid. Ask the customer to reopen their booking pass.",
    );
  if (b.status !== "Confirmed") throw Error("This booking is not confirmed.");
  if (localToday() < b.date || localToday() > (b.endDate || b.date))
    throw Error("This pass is not valid today.");
  return b;
}
export async function recordAttendance(
  id: string,
  action: "in" | "out",
  expectedToken?: string,
) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw Error("Sign in to use reception.");
  const date = localToday();
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "bookings", id),
      s = await tx.get(ref);
    if (!s.exists()) throw Error("Booking not found.");
    const b: any = s.data();
    if (expectedToken && b.passToken !== expectedToken)
      throw Error("The booking pass has changed. Scan it again.");
    const error = attendanceError(b, date, action);
    if (error) throw Error(error);
    const patch =
      action === "in"
        ? {
            attendanceDate: date,
            checkedInAt: serverTimestamp(),
            checkedInBy: uid,
            checkedOutAt: null,
            checkedOutBy: null,
          }
        : { checkedOutAt: serverTimestamp(), checkedOutBy: uid };
    tx.update(ref, patch);
    tx.set(
      doc(db, "attendance", `${id}_${date}`),
      { bookingId: id, userId: b.userId, date, ...patch },
      { merge: true },
    );
    return action === "in" ? "Customer checked in." : "Customer checked out.";
  });
}
