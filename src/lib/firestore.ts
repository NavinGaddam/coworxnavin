import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  runTransaction,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { DEFAULT_POLICY, officeHours, consecutiveDates, PASS_ALLOWANCES, cancellationQuote, timeAt, validatePolicy, minutes } from "./business";
import { collectPayment, processRefund } from "./finance";
import { ageFromDob, normalizeEmail, validateCustomer } from "./customer";
import { localToday, dateSpan } from "../pages/types";
import {
  ADMIN_EMAILS,
  DEFAULT_PRICING,
  Offer,
  Booking,
  Space,
  emailKey,
  addDays,
  addHours,
} from "../pages/types";
const clean = (obj: any) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
const sortNewest = (a: any, b: any) =>
  (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
const lower = (v: any) =>
  String(v || "")
    .trim()
    .toLowerCase();
export function watchUser(
  uid: string,
  email: string,
  cb: (b: Booking[]) => void,
  onError?: (e: any) => void,
) {
  const result: Record<string, Booking[]> = {};
  const queries = [
    query(collection(db, "bookings"), where("userId", "==", uid), limit(500)),
    query(
      collection(db, "bookings"),
      where("customerEmail", "==", normalizeEmail(email)),
      limit(500),
    ),
  ];
  const stops = queries.map((q, i) =>
    onSnapshot(
      q,
      (s) => {
        result[i] = s.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking);
        cb(
          [
            ...new Map(
              Object.values(result)
                .flat()
                .map((b) => [b.id, b]),
            ).values(),
          ].sort(sortNewest),
        );
      },
      (e) => onError?.(e),
    ),
  );
  return () => stops.forEach((stop) => stop());
}
export async function backfillUserBookings(_uid: string) {
  return;
}
export function watchAllBookings(
  cb: (b: Booking[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    query(collection(db, "bookings")),
    (s) => {
      cb(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Booking)
          .sort(sortNewest),
      );
    },
    (e) => onError?.(e),
  );
}
export function watchPendingBookings(
  cb: (b: Booking[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    query(
      collection(db, "bookings"),
      where("status", "==", "Pending"),
      limit(500),
    ),
    (s) => {
      cb(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Booking)
          .sort(sortNewest),
      );
    },
    (e) => onError?.(e),
  );
}
export function watchBookingLocks(
  date: string,
  cb: (locks: any[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    query(
      collection(db, "bookingLocks"),
      where("date", "==", date),
      limit(500),
    ),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => onError?.(e),
  );
}
export function watchOffers(email: string, cb: (o: Offer[]) => void, onError?: (e:any)=>void) {
  const groups:any[][]=[[],[]], e=lower(email);
  const queries=[
    query(collection(db,"offers"),where("visibleToUsers","==",true),where("targetType","==","all"),limit(100)),
    query(collection(db,"offers"),where("visibleToUsers","==",true),where("targetEmail","==",e||"__none__"),limit(100)),
  ];
  const emit=()=>cb([...new Map(groups.flat().filter(o=>o.active!==false).map(o=>[o.id,o])).values()].sort(sortNewest));
  const stops=queries.map((q,index)=>onSnapshot(q,s=>{groups[index]=s.docs.map(d=>({id:d.id,...d.data()}));emit();},e=>onError?.(e)));
  return ()=>stops.forEach(stop=>stop());
}
export function watchAllOffers(cb:(o:any[])=>void,onError?: (e:any)=>void){
  return onSnapshot(query(collection(db,"offers"),limit(200)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()})).sort(sortNewest)),e=>onError?.(e));
}
export function watchRoleAssignment(email: string, cb: (a: any) => void) {
  return onSnapshot(
    query(
      collection(db, "roleAssignments"),
      where("email", "==", normalizeEmail(email)),
      limit(10),
    ),
    (s) => {
      const a = s.docs.find((d) => d.data().status !== "revoked");
      cb(a ? { id: a.id, ...a.data() } : null);
    },
  );
}
export function watchUsers(cb: (u: any[]) => void, onError?: (e: any) => void) {
  return onSnapshot(
    query(collection(db, "users")),
    (s) =>
      cb(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) =>
            (a.name || a.email || "").localeCompare(b.name || b.email || ""),
          ),
      ),
    (e) => onError?.(e),
  );
}
export function watchAdmins(
  cb: (emails: string[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    doc(db, "settings", "admins"),
    (s) => {
      const stored =
        s.exists() && Array.isArray(s.data().emails) ? s.data().emails : [];
      cb([...new Set([...ADMIN_EMAILS, ...stored].map(lower))]);
    },
    (e) => onError?.(e),
  );
}
export function watchAdminLogs(
  cb: (logs: any[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    query(collection(db, "adminLogs"), limit(500)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortNewest)),
    (e) => onError?.(e),
  );
}
export function watchNotifications(
  uid: string,
  cb: (items: any[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    query(
      collection(db, "notifications"),
      where("recipientUid", "==", uid),
      limit(100),
    ),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortNewest)),
    (e) => onError?.(e),
  );
}
export function watchResourceBlocks(
  date: string,
  cb: (items: any[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    query(
      collection(db, "resourceBlocks"),
      where("date", "==", date),
      limit(200),
    ),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => onError?.(e),
  );
}
export function watchResourceBlocksRange(
  dates: string[],
  cb: (items: any[]) => void,
  onError?: (e: any) => void,
) {
  const uniq = [...new Set(dates)].filter(Boolean);
  if (uniq.length <= 1) return watchResourceBlocks(uniq[0] || "", cb, onError);
  const chunks: string[][] = [];
  for (let i = 0; i < uniq.length; i += 10) chunks.push(uniq.slice(i, i + 10));
  const results: Record<number, any[]> = {};
  const unsubs = chunks.map((chunk, idx) =>
    onSnapshot(
      query(
        collection(db, "resourceBlocks"),
        where("date", "in", chunk),
        limit(500),
      ),
      (s) => {
        results[idx] = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        cb(Object.values(results).flat());
      },
      (e) => onError?.(e),
    ),
  );
  return () => unsubs.forEach((u) => u());
}
export function watchCoupons(
  cb: (items: any[]) => void,
  onError?: (e: any) => void,
  publicOnly = false,
) {
  return onSnapshot(
    publicOnly ? query(collection(db,"coupons"),where("visibleToUsers","==",true),limit(200)) : query(collection(db, "coupons"), limit(200)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortNewest)),
    (e) => onError?.(e),
  );
}
export function watchCouponRedemptions(userId:string,cb:(items:any[])=>void,onError?: (e:any)=>void){
  return onSnapshot(query(collection(db,"couponRedemptions"),where("userId","==",userId),limit(200)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))),e=>onError?.(e));
}
export function watchMembershipPlans(
  cb: (items: any[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    query(collection(db, "membershipPlans"), limit(100)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => onError?.(e),
  );
}
export function watchAddons(
  cb: (items: any[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    query(collection(db, "addons"), limit(100)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => onError?.(e),
  );
}
export async function getUserByEmail(email: string): Promise<any | null> {
  const e = lower(email),
    q = await getDocs(
      query(collection(db, "users"), where("email", "==", e), limit(10)),
    );
  const rows = q.docs
    .map((d) => ({ id: d.id, ...d.data() }) as any)
    .sort(
      (a, b) =>
        Number(a.createdFrom === "staff_walk_in") -
        Number(b.createdFrom === "staff_walk_in"),
    );
  return rows[0] || null;
}
export async function createCustomerProfile(
  data: any,
  actorUid: string,
  actorEmail: string = "",
) {
  const value = validateCustomer(
    { ...data, phone: data.phone || data.mobile || "" },
    localToday(),
  );
  const existing = await getUserByEmail(value.email);
  if (existing)
    return {
      ...existing,
      uid: existing.uid || existing.id,
      alreadyExists: true,
    };
  // Encoding keeps dots and hyphens distinct; a transaction prevents duplicate saves.
  const ref = doc(db, "users", `walkin_${encodeURIComponent(value.email)}`);
  const saved = await runTransaction(db, async (tx) => {
    const prior = await tx.get(ref);
    if (prior.exists())
      return { id: prior.id, ...prior.data(), alreadyExists: true };
    const payload = {
      ...value,
      age:ageFromDob(value.dob,localToday()),
      uid: ref.id,
      role: "User",
      createdFrom: "staff_walk_in",
      createdByUid: actorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    tx.set(ref, payload);
    return { id: ref.id, ...payload, alreadyExists: false };
  });
  // The profile is already committed; an audit log failure must not invite a duplicate retry.
  void writeOperationLog(
    "CREATE_CUSTOMER",
    actorUid,
    actorEmail,
    ref.id,
    value.email,
  ).catch(() => {});
  return saved;
}
export async function loadUserProfile(uid: string): Promise<any | null> {
  if (!uid) return null;
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}
async function adminEmails() {
  try {
    const s = await getDoc(doc(db, "settings", "admins"));
    const stored =
      s.exists() && Array.isArray(s.data().emails) ? s.data().emails : [];
    return [...new Set([...ADMIN_EMAILS, ...stored].map(lower))];
  } catch {
    return ADMIN_EMAILS.map(lower);
  }
}
async function writeAdminLog(
  action: string,
  targetEmail: string,
  targetRole: string,
  actorUid: string,
  actorEmail: string,
  details?: string,
) {
  await addDoc(
    collection(db, "adminLogs"),
    clean({
      action,
      targetEmail: lower(targetEmail),
      targetRole,
      performedByUid: actorUid,
      performedByEmail: lower(actorEmail),
      details: details || "",
      createdAt: serverTimestamp(),
    }),
  );
}
export async function writeOperationLog(
  action: string,
  actorUid: string,
  actorEmail: string,
  target: string,
  details: string,
) {
  await addDoc(
    collection(db, "adminLogs"),
    clean({
      action,
      target,
      performedByUid: actorUid,
      performedByEmail: lower(actorEmail),
      details,
      createdAt: serverTimestamp(),
    }),
  );
}
export async function ensureUser(u: any) {
  const email = lower(u.email),
    admins = await adminEmails(),
    ref = doc(db, "users", u.uid),
    s = await getDoc(ref);
  const d = s.exists() ? s.data() : {},
    role = admins.includes(email) ? "Admin" : d.role || "User";
  let inherited: any = {};
  if (!s.exists()) {
    const prior = await getUserByEmail(email).catch(() => null);
    if (prior)
      for (const key of ["phone", "gender", "dob", "profession"])
        if (prior[key]) inherited[key] = prior[key];
  }
  await setDoc(
    ref,
    {
      ...inherited,
      uid: u.uid,
      email,
      name: u.displayName || d.name || email.split("@")[0],
      // Keep a customer-selected photo instead of replacing it with the Google image at every sign-in.
      photoURL: d.photoURL || u.photoURL || "",
      ...(s.exists() ? {} : { role }),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return role;
}
export async function saveUserProfile(uid: string, data: any) {
  await updateDoc(
    doc(db, "users", uid),
    clean({ ...data, updatedAt: serverTimestamp() }),
  );
}
export async function updateCustomer(
  uid: string,
  data: any,
  actorUid: string,
  actorEmail: string,
) {
  await updateDoc(
    doc(db, "users", uid),
    clean({ ...data, updatedAt: serverTimestamp() }),
  );
  await writeOperationLog(
    "UPDATE_CUSTOMER",
    actorUid,
    actorEmail,
    uid,
    Object.entries(data)
      .map(([k, v]) => `${k}=${v}`)
      .join("; "),
  );
}
export async function setCustomerBlock(
  uid: string,
  blocked: boolean,
  reason: string,
  actorUid: string,
  actorEmail: string,
) {
  await updateDoc(doc(db, "users", uid), {
    blocked,
    blockedReason: blocked ? reason : "",
    updatedAt: serverTimestamp(),
  });
  await writeOperationLog(
    blocked ? "BLOCK_CUSTOMER" : "UNBLOCK_CUSTOMER",
    actorUid,
    actorEmail,
    uid,
    blocked ? reason : "Customer unblocked",
  );
}
export async function saveCustomerPreference(
  uid: string,
  preferredDesk: string,
  actorUid: string,
  actorEmail: string,
) {
  await updateDoc(doc(db, "users", uid), {
    preferredDesk,
    updatedAt: serverTimestamp(),
  });
  await writeOperationLog(
    "SAVE_DESK_PREFERENCE",
    actorUid,
    actorEmail,
    uid,
    preferredDesk,
  );
}
export async function loadPricing() {
  const s = await getDoc(doc(db, "settings", "pricing"));
  if (!s.exists()) return DEFAULT_PRICING;
  const raw: any = s.data();
  return {
    ...DEFAULT_PRICING,
    ...raw,
    conference_hourly: Number(
      raw.conference_hourly ??
        raw.conference_slot ??
        DEFAULT_PRICING.conference_hourly,
    ),
  };
}
export async function savePricing(p: any) {
  const next: any = { ...p };
  delete next.conference_slot;
  delete next.cubicle_basic;
  delete next.cubicle_premium;
  await setDoc(doc(db, "settings", "pricing"), next, { merge: true });
}
export async function loadDeskPricing(date: string, defaults: any) {
  const s = await getDoc(doc(db, "settings", "deskPricing"));
  const data: any = s.exists() ? s.data() : {};
  const base: any = {};
  for (let n = 1; n <= 22; n++) {
    const id = `D${String(n).padStart(2, "0")}`;
    base[id] = [2, 3, 9, 15, 22].includes(n)
      ? Number(
          defaults[id] ?? defaults.desk_premium ?? DEFAULT_PRICING.desk_premium,
        )
      : Number(
          defaults[id] ?? defaults.desk_basic ?? DEFAULT_PRICING.desk_basic,
        );
  }
  return { ...base, ...(data[date] || {}) };
}
export async function saveDeskPricing(date: string, prices: any) {
  await setDoc(
    doc(db, "settings", "deskPricing"),
    { [date]: prices },
    { merge: true },
  );
}
export async function loadWifi() {
  const s = await getDoc(doc(db, "settings", "wifi"));
  return s.exists() ? s.data() : { ssid: "", password: "", note: "" };
}
export async function saveWifi(data: any) {
  await setDoc(doc(db, "settings", "wifi"), data, { merge: true });
}
export async function loadUpi() {
  const s = await getDoc(doc(db, "settings", "upi"));
  return s.exists() ? s.data() : { upiId: "", merchantName: "Coworx Central" };
}
export async function saveUpi(data: any) {
  await setDoc(doc(db, "settings", "upi"), data, { merge: true });
}
export async function loadCompanySettings() {
  const s = await getDoc(doc(db, "settings", "company"));
  return s.exists()
    ? {
        name: "Coworx Central",
        address: "Solapur City, Maharashtra",
        gstNumber: "",
        gstRate: 18,
        invoicePrefix: "CC",
        phone: "",
        email: "",
        ...s.data(),
      }
    : {
        name: "Coworx Central",
        address: "Solapur City, Maharashtra",
        gstNumber: "",
        gstRate: 18,
        invoicePrefix: "CC",
        phone: "",
        email: "",
      };
}
export async function saveCompanySettings(data: any) {
  await setDoc(doc(db, "settings", "company"), clean({...data,updatedAt:serverTimestamp()}), { merge: true });
}
export function watchHolidays(
  cb: (items: any[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    query(collection(db, "holidays"), limit(365)),
    (s) =>
      cb(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((h: any) => h.active !== false)
          .sort((a: any, b: any) => String(a.date).localeCompare(b.date)),
      ),
    (e) => onError?.(e),
  );
}
export async function setHoliday(date: string, reason: string, uid: string) {
  const holidayRef=doc(db,"holidays",date), policyRef=doc(db,"settings","policy");
  await runTransaction(db,async tx=>{
    const snapshot=await tx.get(policyRef), policy={...DEFAULT_POLICY,...snapshot.data()};
    const calendar={...(snapshot.data()?.calendar||{}),[date]:officeHours(date,policy,[{date,reason,active:true}])};
    tx.set(holidayRef,{date,reason,active:true,createdBy:uid,createdAt:serverTimestamp()},{merge:true});
    tx.set(policyRef,{calendar},{merge:true});
  });
}
export async function removeHoliday(date: string, uid: string) {
  const holidayRef=doc(db,"holidays",date), policyRef=doc(db,"settings","policy");
  await runTransaction(db,async tx=>{
    const snapshot=await tx.get(policyRef), policy={...DEFAULT_POLICY,...snapshot.data()};
    const calendar={...(snapshot.data()?.calendar||{}),[date]:officeHours(date,policy,[])};
    tx.update(holidayRef,{active:false,updatedBy:uid,updatedAt:serverTimestamp()});
    tx.set(policyRef,{calendar},{merge:true});
  });
}
export function watchBanners(
  cb: (items: any[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    query(collection(db, "banners"), limit(50)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortNewest)),
    (e) => onError?.(e),
  );
}
export async function createBanner(data: any, uid: string) {
  await addDoc(
    collection(db, "banners"),
    clean({
      ...data,
      active: data.active !== false,
      createdBy: uid,
      createdAt: serverTimestamp(),
    }),
  );
}
export async function updateBanner(id: string, data: any, uid: string) {
  await updateDoc(
    doc(db, "banners", id),
    clean({ ...data, updatedBy: uid, updatedAt: serverTimestamp() }),
  );
}
export async function deleteBanner(id: string, uid: string) {
  await updateDoc(doc(db, "banners", id), {
    active: false,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}
export function watchEnquiries(
  cb: (items: any[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    query(collection(db, "enquiries"), limit(300)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortNewest)),
    (e) => onError?.(e),
  );
}
export async function createEnquiry(data: any, uid: string) {
  await addDoc(
    collection(db, "enquiries"),
    clean({
      ...data,
      status: data.status || "New",
      source: data.source || "Staff",
      createdBy: uid,
      createdAt: serverTimestamp(),
    }),
  );
}
export async function updateEnquiry(id: string, data: any, uid: string) {
  await updateDoc(
    doc(db, "enquiries", id),
    clean({ ...data, updatedBy: uid, updatedAt: serverTimestamp() }),
  );
}
export function watchPricingRules(
  cb: (items: any[]) => void,
  onError?: (e: any) => void,
) {
  return onSnapshot(
    query(collection(db, "pricingRules"), limit(200)),
    (s) =>
      cb(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((r: any) => r.active !== false)
          .sort(sortNewest),
      ),
    (e) => onError?.(e),
  );
}
export async function savePricingRule(data: any, uid: string) {
  await addDoc(
    collection(db, "pricingRules"),
    clean({
      ...data,
      createdBy: uid,
      active: true,
      createdAt: serverTimestamp(),
    }),
  );
}
export async function deletePricingRule(id: string, uid: string) {
  await updateDoc(doc(db, "pricingRules", id), {
    active: false,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}
export async function loadPolicy() {
  const s = await getDoc(doc(db, "settings", "policy"));
  return s.exists()
    ? {
        maxAdvanceDays: 60,
        businessStart: "09:00",
        businessEnd: "19:00",
        ...s.data(),
      }
    : { maxAdvanceDays: 60, businessStart: "09:00", businessEnd: "19:00" };
}
export async function savePolicy(data: any) {
  const policy={...DEFAULT_POLICY,...data};
  validatePolicy(policy);
  const holidays=(await getDocs(collection(db,"holidays"))).docs.map(d=>d.data());
  const calendar=Object.fromEntries(Array.from({length:740},(_,i)=>{const d=addDays(localToday(),i);return [d,officeHours(d,policy,holidays)];}));
  await setDoc(doc(db,"settings","policy"),{...policy,calendar},{merge:true});
}
export async function loadOperationsSettings() {
  const s = await getDoc(doc(db, "settings", "operations"));
  return s.exists()
    ? s.data()
    : {
        referralEnabled: true,
        referralRewardPercent: 5,
        weekendMultiplier: 1,
        peakMultiplier: 1,
        notificationTemplates: {
          bookingConfirmation: "",
          paymentReminder: "",
          cancellation: "",
          checkIn: "",
        },
      };
}
export async function saveOperationsSettings(data: any) {
  await setDoc(doc(db, "settings", "operations"), data, { merge: true });
}
export async function loadNotificationTemplates() {
  const s = await getDoc(doc(db, "settings", "notificationTemplates"));
  return s.exists()
    ? s.data()
    : {
        bookingConfirmation:
          "Hello {name}, your Coworx Central booking is confirmed for {date}.",
        paymentReminder:
          "Hello {name}, your Coworx Central slot is held for 15 minutes. Please complete payment.",
        cancellation:
          "Hello {name}, your Coworx Central booking has been cancelled.",
        checkIn:
          "Hello {name}, your Coworx Central booking is ready for check-in.",
      };
}
export async function saveNotificationTemplates(data: any) {
  await setDoc(doc(db, "settings", "notificationTemplates"), data, {
    merge: true,
  });
}
export async function markNotificationRead(id: string) {
  await updateDoc(doc(db, "notifications", id), { read: true });
}
export async function assignManager(
  email: string,
  uid: string,
  actorEmail: string = "",
) {
  const e = lower(email);
  await setDoc(doc(db, "roleAssignments", emailKey(e)), {
    email: e,
    role: "Manager",
    status: "pending",
    assignedBy: uid,
    assignedAt: serverTimestamp(),
  });
  const q = await getDocs(
    query(collection(db, "users"), where("email", "==", e), limit(1)),
  );
  if (!q.empty)
    await addDoc(collection(db, "notifications"), {
      recipientUid: q.docs[0].id,
      title: "Manager invitation",
      message:
        "An admin has invited you to become a Coworx Central Manager. Sign in and accept the invitation.",
      read: false,
      createdAt: serverTimestamp(),
    });
  if (actorEmail)
    await writeAdminLog(
      "ADD_MANAGER",
      e,
      "Manager",
      uid,
      actorEmail,
      "Manager invitation created",
    );
}
export async function removeManager(
  email: string,
  uid: string,
  actorEmail: string = "",
) {
  const e = lower(email);
  await updateDoc(doc(db, "roleAssignments", emailKey(e)), {
    status: "revoked",
    revokedBy: uid,
    revokedAt: serverTimestamp(),
  }).catch(() => {});
  const existing = await getUserByEmail(e);
  if (existing?.id)
    await updateDoc(doc(db, "users", existing.id), {
      role: "User",
      updatedAt: serverTimestamp(),
    });
  if (actorEmail)
    await writeAdminLog(
      "REMOVE_MANAGER",
      e,
      "Manager",
      uid,
      actorEmail,
      "Manager access removed",
    );
}
export async function acceptManager(a: any, uid: string) {
  await updateDoc(doc(db, "roleAssignments", a.id), {
    status: "accepted",
    acceptedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "users", uid), { role: "Manager" });
}
export async function addAdmin(email: string, uid: string, actorEmail: string) {
  const e = lower(email);
  if (!e.includes("@")) throw Error("Enter a valid admin email.");
  const current = await adminEmails();
  await setDoc(
    doc(db, "settings", "admins"),
    { emails: [...new Set([...current, e])], updatedAt: serverTimestamp() },
    { merge: true },
  );
  const existing = await getUserByEmail(e);
  if (existing?.id)
    await updateDoc(doc(db, "users", existing.id), {
      role: "Admin",
      updatedAt: serverTimestamp(),
    });
  await writeAdminLog(
    "ADD_ADMIN",
    e,
    "Admin",
    uid,
    actorEmail,
    "Admin access granted",
  );
}
export async function removeAdmin(
  email: string,
  uid: string,
  actorEmail: string,
) {
  const e = lower(email);
  if (ADMIN_EMAILS.map(lower).includes(e))
    throw Error("The two owner admins are protected and cannot be removed.");
  const current = await adminEmails();
  await setDoc(
    doc(db, "settings", "admins"),
    { emails: current.filter((x) => x !== e), updatedAt: serverTimestamp() },
    { merge: true },
  );
  const existing = await getUserByEmail(e);
  if (existing?.id)
    await updateDoc(doc(db, "users", existing.id), {
      role: "User",
      updatedAt: serverTimestamp(),
    });
  await writeAdminLog(
    "REMOVE_ADMIN",
    e,
    "Admin",
    uid,
    actorEmail,
    "Admin access removed",
  );
}
export async function createOffer(data: any, uid: string) {
  if(!String(data.title||"").trim())throw Error("Offer title is required.");
  if(!Number.isFinite(Number(data.value))||Number(data.value)<=0||data.type==="percent"&&Number(data.value)>100)throw Error("Enter a valid offer discount.");
  if(data.targetType==="email"&&!validEmailAddress(data.targetEmail))throw Error("Enter a valid customer email for this offer.");
  await addDoc(collection(db, "offers"), {
    ...data,
    title:String(data.title).trim(),
    description:String(data.description||"").trim(),
    value: Number(data.value),
    targetEmail: data.targetType === "email" ? lower(data.targetEmail) : "",
    active: true,
    visibleToUsers: data.visibleToUsers !== false,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
}
const validEmailAddress=(value:any)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower(value));
export async function toggleOffer(id:string,active:boolean,uid:string){
  await updateDoc(doc(db,"offers",id),{active,updatedBy:uid,updatedAt:serverTimestamp()});
}
export async function setOfferVisibility(id:string,visibleToUsers:boolean,uid:string){
  await updateDoc(doc(db,"offers",id),{visibleToUsers,updatedBy:uid,updatedAt:serverTimestamp()});
}
export async function createCoupon(data: any, uid: string) {
  const code = String(data.code || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw Error("Use 3–24 letters, numbers, dashes or underscores for the coupon code.");
  const value=Number(data.value||0), maxUsesPerCustomer=Number(data.maxUsesPerCustomer??data.maxUses??1);
  if(!Number.isFinite(value)||value<=0||data.type==="percent"&&value>100)throw Error("Enter a valid coupon discount.");
  if(!Number.isInteger(maxUsesPerCustomer)||maxUsesPerCustomer<1||maxUsesPerCustomer>100)throw Error("Uses per customer must be between 1 and 100.");
  await setDoc(
    doc(db, "coupons", code),
    {
      ...data,
      code,
      value,
      maxUsesPerCustomer,
      visibleToUsers:data.visibleToUsers===true,
      active: data.active !== false,
      createdBy: uid,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}
export async function toggleCoupon(id: string, active: boolean, uid: string) {
  await updateDoc(doc(db, "coupons", id), {
    active,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}
export async function setCouponVisibility(id:string,visibleToUsers:boolean,uid:string){
  await updateDoc(doc(db,"coupons",id),{visibleToUsers,updatedBy:uid,updatedAt:serverTimestamp()});
}
export async function createMembershipPlan(data: any, uid: string) {
  const days=Number(data.deskDays || data.days);
  if (!PASS_ALLOWANCES[days] || !String(data.name||"").trim() || !Number.isFinite(Number(data.price)) || Number(data.price)<=0) throw Error("Enter a name, positive price and 10 / 20 / 30 working days.");
  const percent=Number(data.minimumAdvancePercent||50),due=Number(data.balanceDueDays??7);
  if(percent<1||percent>100||!Number.isInteger(due)||due<0||due>30)throw Error("Choose an advance of 1–100% and balance due in 0–30 days.");
  const ref=data.id ? doc(db,"membershipPlans",data.id) : doc(collection(db,"membershipPlans"));
  await setDoc(ref,{name:String(data.name).trim(),description:String(data.description||""),price:Number(data.price),days,deskDays:days,minimumAdvancePercent:percent,balanceDueDays:due,createdBy:uid,active:data.active!==false,updatedAt:serverTimestamp()},{merge:true});
}
export async function assignMembership(
  uid: string,
  plan: any,
  actorUid: string,
  actorEmail: string,
) {
  await updateDoc(doc(db, "users", uid), {
    membershipId: plan.id,
    membershipName: plan.name,
    membershipRemaining: Number(plan.deskDays || plan.days || 0),
    updatedAt: serverTimestamp(),
  });
  await writeOperationLog(
    "ASSIGN_MEMBERSHIP",
    actorUid,
    actorEmail,
    uid,
    `${plan.name} · remaining=${plan.deskDays || plan.days || 0}`,
  );
}
export async function createAddon(data: any, uid: string) {
  await addDoc(
    collection(db, "addons"),
    clean({
      ...data,
      unitPrice: Number(data.unitPrice || 0),
      active: data.active !== false,
      createdBy: uid,
      createdAt: serverTimestamp(),
    }),
  );
}
export async function toggleAddon(id: string, active: boolean, uid: string) {
  await updateDoc(doc(db, "addons", id), {
    active,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}
export async function setResourceBlock(data: any, uid: string) {
  data = {
    ...data,
    inventoryId: /^D\d{2}$/.test(data.inventoryId)
      ? `desk-${data.inventoryId}`
      : data.inventoryId,
  };
  const id = `${data.date}_${data.inventoryId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  await setDoc(
    doc(db, "resourceBlocks", id),
    clean({
      ...data,
      active: data.active !== false,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );
}
export async function removeResourceBlock(id: string, uid: string) {
  await updateDoc(doc(db, "resourceBlocks", id), {
    active: false,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}
export async function saveShift(data: any, uid: string) {
  await setDoc(
    doc(db, "settings", "shifts"),
    { ...data, updatedBy: uid, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
export async function savePermissions(data: any, uid: string) {
  await setDoc(
    doc(db, "settings", "permissions"),
    { ...data, updatedBy: uid, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
export async function loadSetting(id: string, defaults: any = {}) {
  const s = await getDoc(doc(db, "settings", id));
  return s.exists() ? { ...defaults, ...s.data() } : defaults;
}
/** Financial and lock changes commit together; stale holds cannot reclaim a reused slot. */
export async function confirmBooking(
  id: string,
  uid: string,
  staffDiscount = 0,
  paymentReceived?: number,
  paymentMethod?: string,
  paymentRef?: string,
) {
  const snapshot = await getDoc(doc(db,"bookings",id));
  if (!snapshot.exists()) throw Error("Booking not found.");
  const received = Number(snapshot.data().paymentReceived || 0);
  const amount = Number(paymentReceived ?? received) - received;
  return collectPayment(id,{cash:paymentMethod === "Cash" ? amount : 0,upi:paymentMethod === "UPI" ? amount : 0,other:!["Cash","UPI"].includes(paymentMethod || "Other") ? amount : 0,reference:paymentRef || ""},staffDiscount,received);
}

export async function cancelBooking(
  id: string,
  uid: string,
  reason = "Customer requested cancellation",
) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "bookings", id),
      snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw Error("Booking not found.");
    const d: any = snapshot.data();
    if (d.status === "Cancelled") return;
    if (!["Pending", "Confirmed"].includes(d.status))
      throw Error("This booking is no longer active.");
    const lockRefs = (d.lockIds?.length ? d.lockIds : [id]).map((key: string) =>
      doc(db, "bookingLocks", key),
    );
    const locks = await Promise.all(lockRefs.map((r: any) => tx.get(r)));
    const refundAmount = cancellationQuote(d).refund;
    tx.update(ref, {
      status: "Cancelled",
      revokedBy: uid,
      revokedAt: serverTimestamp(),
      expiresAt: null,
      cancellationReason: reason,
      refundStatus: refundAmount > 0 ? "Pending" : "Not Requested",
      refundAmount,
    });
    locks.forEach((l: any, i: number) => {
      if (l.exists() && l.data().bookingId === id)
        tx.update(lockRefs[i], {
          status: "Cancelled",
          expiresAt: null,
          updatedAt: serverTimestamp(),
        });
    });
  });
}
export async function revokeBooking(id: string, uid: string) {
  return cancelBooking(id, uid, "Request revoked before payment");
}
export async function updateRefund(
  id: string,
  uid: string,
  status: string,
  amount?: number,
  reference?: string,
  method = "UPI",
) {
  if (status === "Processed") return processRefund(id,Number(amount),reference || "",method);
  await updateDoc(
    doc(db, "bookings", id),
    clean({
      refundStatus: status,
      refundAmount: amount === undefined ? undefined : Number(amount),
      refundReference: reference || "",
      refundProcessedBy: uid,
      refundProcessedAt: serverTimestamp(),
      paymentStatus: status === "Processed" ? "Refunded" : "Refund Pending",
    }),
  );
}

/** An extension has its own hold, payment and pass. It never changes a paid reservation. */
export async function extendBooking(
  id: string,
  opts: { extraHours?: number; extraDays?: number; uid: string },
) {
  const snapshot = await getDoc(doc(db, "bookings", id));
  if (!snapshot.exists()) throw Error("Booking not found.");
  const b: any = snapshot.data();
  if (b.status !== "Confirmed")
    throw Error("Only confirmed bookings can be extended.");
  if(b.passDays) throw Error("Use the pass reschedule allowance or purchase a new pass.");
  if ((b.endDate || b.date) < localToday())
    throw Error("This booking has ended. Please make a new booking.");
  const timed = Boolean(b.start),
    extra = Number(timed ? opts.extraHours : opts.extraDays);
  if (!Number.isInteger(extra) || extra < 1 || extra > 30)
    throw Error("Choose a valid extension.");
  const date = timed ? b.endDate || b.date : addDays(b.endDate || b.date, 1);
  const endDate = timed ? date : addDays(date, extra - 1);
  const end = timed ? addHours(b.end, extra) : undefined;
  const policy = await loadPolicy();
  const hours=officeHours(date,policy);
  if(timed&&(!b.end||end!>hours.end||end!<=b.end||b.end<hours.start)) throw Error(`Extension must end by ${hours.end}.`);
  if (endDate > addDays(localToday(), Number(policy.maxAdvanceDays || 60)))
    throw Error("Extension is outside the advance booking window.");
  const prices = await loadPricing();
  const ids = b.inventoryIds?.length ? b.inventoryIds : [b.inventoryId];
  const dates = dateSpan(date, endDate);
  let base = 0;
  if (timed) {
    base =
      Number(
        prices[
          b.space === "meeting"
            ? "meeting_hourly"
            : b.space === "conference"
              ? "conference_hourly"
              : "podcast_hourly"
        ],
      ) * extra;
  } else {
    for (const day of dates) {
      const daily = await loadDeskPricing(day, prices);
      base += ids.reduce(
        (n: number, key: string) =>
          n + Number(daily[key.replace(/^desk-/, "")] || 0),
        0,
      );
    }
  }
  return createBooking({
    extensionOf: id,
    date,
    endDate,
    dates,
    days: dates.length,
    space: b.space,
    inventoryId: ids[0],
    inventoryIds: ids,
    label: `${b.label} · extension`,
    userId: b.userId,
    userEmail: b.userEmail || b.customerEmail,
    customerEmail: b.customerEmail || b.userEmail,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    start: timed ? b.end : undefined,
    end,
    durationHours: timed ? extra : undefined,
    base,
    discount: 0,
    total: base,
    status: "Pending",
    createdByRole: opts.uid === b.userId ? "User" : "Staff",
    walkIn: opts.uid !== b.userId,
  });
}
export async function cleanupExpiredHolds() {
  const now = Date.now(),
    q = await getDocs(
      query(
        collection(db, "bookingLocks"),
        where("status", "==", "Pending"),
        limit(500),
      ),
    ),
    expired = q.docs.filter((d) => {
      const t = d.data().expiresAt?.toMillis?.() || 0;
      return t > 0 && t <= now;
    });
  await Promise.all(
    expired.map((d) =>
      updateDoc(d.ref, {
        status: "Expired",
        expiresAt: null,
        updatedAt: serverTimestamp(),
      }),
    ),
  );
  const bq = await getDocs(
      query(
        collection(db, "bookings"),
        where("status", "==", "Pending"),
        limit(500),
      ),
    ),
    expiredBookings = bq.docs.filter((d) => {
      const t = d.data().expiresAt?.toMillis?.() || 0;
      return t > 0 && t <= now;
    });
  await Promise.all(
    expiredBookings.map((d) =>
      updateDoc(d.ref, {
        status: "Expired",
        expiresAt: null,
        paymentStatus: "Pending",
        updatedAt: serverTimestamp(),
      }),
    ),
  );
  return expired.length + expiredBookings.length;
}
export async function createBooking(input: {
  date: string;
  extensionOf?: string;
  endDate?: string;
  days?: number;
  dates?: string[];
  space: Space;
  inventoryId: string;
  inventoryIds?: string[];
  lockKeys?: string[];
  label: string;
  userId: string;
  userEmail: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  createdByRole?: string;
  walkIn?: boolean;
  start?: string;
  end?: string;
  durationHours?: number;
  base: number;
  discount: number;
  total: number;
  offerId?: string | null;
  couponCode?: string;
  couponId?: string;
  membershipId?: string;
  referralCode?: string;
  status?: "Pending" | "Confirmed";
  addons?: any[];
  amenities?: string[];
  notes?: string;
  checkoutChannel?: "whatsapp" | "staff_manual";
}) {
  const policyDoc = await getDoc(doc(db,"settings","policy"));
  const policy:any = { ...DEFAULT_POLICY, ...policyDoc.data() };
  const holidayDocs = await getDocs(collection(db,"holidays"));
  const holidays = holidayDocs.docs.map(d=>d.data());
  const planDoc = input.membershipId ? await getDoc(doc(db,"membershipPlans",input.membershipId)) : null;
  const plan:any = planDoc?.data();
  if (input.membershipId && (!plan || plan.active === false || !PASS_ALLOWANCES[Number(plan.deskDays || plan.days)] || !["desk","cubicle"].includes(input.space))) throw Error("Choose an active 10, 20 or 30-day desk pass.");
  const passDays = plan ? Number(plan.deskDays || plan.days) : 0;
  const dates = passDays ? consecutiveDates(input.date,passDays,policy,holidays) : input.dates?.length ? input.dates : [input.date],
    ids = input.inventoryIds?.length ? input.inventoryIds : [input.inventoryId],
    timed = !["desk","cubicle"].includes(input.space),
    hoursPerDay = timed
      ? Math.max(
          1,
          Math.round((input.durationHours || 1) / Math.max(1, dates.length)),
        )
      : 1,
    generatedLockKeys: string[] = [],
    lockInventories: string[] = [];
  if (timed) {
    for (const day of dates) {
      for (let i = 0; i < hoursPerDay * 4; i++) {
        const [hh, mm] = (input.start || "09:00").split(":").map(Number),
          n = hh * 60 + mm + i * 15,
          slot = `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
        generatedLockKeys.push(`${day}_${input.space}_${slot}`);
        lockInventories.push(ids[0]);
      }
    }
  } else {
    for (const day of dates)
      for (const id of ids) {
        generatedLockKeys.push(`${day}_${id}_day`);
        lockInventories.push(id);
      }
  }
  const finalLockKeys = generatedLockKeys,
    bookingRef = doc(collection(db, "bookings")),
    expiresAt = Timestamp.fromMillis(Date.now() + 15 * 60 * 1000),
    finalStatus = "Pending";
  const sessions = Object.fromEntries(dates.map(day=>{
    const h = officeHours(day,policy,holidays);
    if (h.closed) throw Error(`${day}: ${h.reason}. Choose an open day.`);
    if (timed && input.start && (minutes(input.start)%15!==0 || minutes(input.end||"")-minutes(input.start)!==hoursPerDay*60)) throw Error("Hourly rooms use 15-minute start times and whole-hour durations.");
    if (timed && (!input.start || !input.end || input.start < h.start || input.end > h.end || input.start >= input.end)) throw Error(`Bookings on ${day} must be within ${h.start}–${h.end}.`);
    return [day,{start:timed ? input.start! : h.start,end:timed ? input.end! : h.end}];
  }));
  if (dates[0]<localToday() || dates[0]>addDays(localToday(),policy.maxAdvanceDays)) throw Error("Choose a start within the advance booking window.");
  if (timeAt(dates[0],sessions[dates[0]].end)<=Date.now()) throw Error("This session has already ended.");
  const base = passDays ? Number(plan.price) * ids.length : input.base;
  const total = passDays ? base + (input.addons || []).reduce((n,a)=>n+Number(a.total || 0),0) : input.total;
  const lastDate = dates[dates.length-1];
  if (passDays && ids.length!==1) throw Error("Choose one desk per personal pass. Create another pass for another customer.");
  if (finalLockKeys.length > 450)
    throw Error(
      "Please split this reservation into smaller date ranges (maximum 450 desk-days per booking).",
    );
  if (lockInventories.length !== finalLockKeys.length)
    throw Error("Booking configuration is invalid.");
  await runTransaction(db, async (tx) => {
    const lockRefs = finalLockKeys.map((k) =>
        doc(db, "bookingLocks", k.replace(/[^a-zA-Z0-9_-]/g, "-")),
      ),
      locks = await Promise.all(lockRefs.map((r) => tx.get(r)));
    // Existing reservations used one lock per hour. Read those guard slots too,
    // so quarter-hour bookings cannot overlap reservations made by earlier builds.
    const legacyRefs=timed ? [...new Set(dates.flatMap(d=>Array.from({length:Math.ceil(minutes(input.end!)/60)-Math.floor(minutes(input.start!)/60)},(_,i)=>`${d}_${input.space}_${String(Math.floor(minutes(input.start!)/60)+i).padStart(2,"0")}-00`)))].map(id=>doc(db,"bookingLocks",id)) : [];
    const legacyLocks=await Promise.all(legacyRefs.map(r=>tx.get(r)));
    if (legacyLocks.some(l=>{if(!l.exists())return false;const x=l.data();return (x.status==="Confirmed"||x.status==="Pending"&&x.expiresAt?.toMillis()>Date.now())&&minutes(x.start)<minutes(input.end!)&&minutes(x.end)>minutes(input.start!);})) throw Error("This room overlaps an existing reservation. Choose another time.");
    if (input.extensionOf) {
      const parent = await tx.get(doc(db, "bookings", input.extensionOf));
      if (!parent.exists() || parent.data().status !== "Confirmed")
        throw Error("The original booking is no longer confirmed.");
    }
    const conflicts: { inventoryId: string; date: string }[] = [];
    for (let i = 0; i < locks.length; i++) {
      const lock = locks[i];
      if (lock.exists()) {
        const ld: any = lock.data(),
          active =
            ld.status === "Confirmed" ||
            (ld.status === "Pending" &&
              (ld.expiresAt?.toMillis?.() || 0) > Date.now());
        if (active)
          conflicts.push({
            inventoryId: lockInventories[i],
            date: finalLockKeys[i].split("_")[0] || input.date,
          });
      }
    }
    if (conflicts.length) {
      const names = [
        ...new Set(conflicts.map((c) => c.inventoryId.replace(/^desk-/, ""))),
      ];
      const err: any = new Error(
        `${names.join(", ")} ${names.length === 1 ? "is" : "are"} already booked for ${[...new Set(conflicts.map((c) => c.date))].join(", ")}. It has been removed from your selection — please review and try again.`,
      );
      err.conflicts = conflicts;
      throw err;
    }
    const customer=await tx.get(doc(db,"users",input.userId));
    const billing={company:customer.data()?.company||"",gstNumber:customer.data()?.gstNumber||"",address:customer.data()?.billingAddress||""};
    const payload = clean({
      billing,
      ...input,
      date:dates[0],dates,endDate:lastDate,days:dates.length,
      base,total,discount:passDays ? 0 : input.discount,
      sessions,
      ...(passDays ? {passDays,passName:plan.name,originalEndDate:lastDate,rescheduleAllowance:PASS_ALLOWANCES[passDays],rescheduleUsed:0,minimumAdvance:Math.ceil(total*Number(plan.minimumAdvancePercent || policy.minimumAdvancePercent))/100,balanceDueDate:[addDays(dates[0],Number(plan.balanceDueDays ?? policy.balanceDueDays)),lastDate].sort()[0]} : {}),
      cancellationPolicy:{hours:Number(policy.cancellationHours),refundPercent:Number(policy.cancellationRefundPercent)},
      inventoryIds: ids,
      lockIds: lockRefs.map((r) => r.id),
      status: finalStatus,
      expiresAt,
      paymentStatus: "Pending",
      paymentReceived: 0,
      passToken: crypto.randomUUID(),
      passValidFrom: Timestamp.fromDate(new Date(`${dates[0]}T00:00:00+05:30`)),
      passValidUntil: Timestamp.fromDate(
        new Date(
          `${addDays(lastDate, 1)}T00:00:00+05:30`,
        ),
      ),
      refundStatus: "Not Requested",
      createdAt: serverTimestamp(),
    });
    tx.set(bookingRef, payload);
    for (let i = 0; i < lockRefs.length; i++) {
      const k = finalLockKeys[i],
        parts = k.split("_"),
        day = parts.shift() || input.date,
        rest = parts.join("_"),
        slot = timed ? k.slice(k.lastIndexOf("_") + 1) : null;
      tx.set(
        lockRefs[i],
        clean({
          bookingId: bookingRef.id,
          inventoryId: lockInventories[i],
          date: day,
          start: slot,
          end: timed ? addHours(slot || "09:00", 0.25) : null,
          userId: input.userId,
          status: finalStatus,
          expiresAt,
          updatedAt: serverTimestamp(),
        }),
      );
    }
  });
  return { id: bookingRef.id, expiresAt };
}
