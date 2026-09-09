import { readFileSync } from "node:fs";
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
const session = vi.hoisted(() => ({ db: null as any, uid: "" }));
vi.mock("../src/firebase", () => ({
  get db() {
    return session.db;
  },
  auth: {
    get currentUser() {
      return { uid: session.uid };
    },
  },
}));
import {
  createBooking,
  createCustomerProfile,
  confirmBooking,
  cancelBooking,
  extendBooking,
  saveCompanySettings,
} from "../src/lib/firestore";
import { recordAttendance, activateAssignment } from "../src/lib/platform";
import { DEFAULT_POLICY, consecutiveDates, officeHours } from "../src/lib/business";
import { collectPayment, reversePayment, processRefund, saveHandover } from "../src/lib/finance";
import { reschedulePass, grantReschedules } from "../src/lib/passes";
import {DEFAULT_PERMISSIONS} from "../src/lib/permissions";
import { localToday, addDays } from "../src/pages/types";
let env: RulesTestEnvironment;
const today = localToday();
const auth = (uid: string, email = uid + "@example.com") => {
  session.uid = uid;
  session.db = env
    .authenticatedContext(uid, { email, email_verified: true })
    .firestore();
  return session.db;
};
const owner = () => auth("owner", "vsshegur@gmail.com");
async function seed(path: string, value: any) {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), path), value);
  });
}
function booking(overrides: any = {}) {
  return {
    date: today,
    endDate: today,
    space: "desk" as const,
    inventoryId: "desk-D01",
    label: "D01",
    userId: "customer",
    userEmail: "customer@example.com",
    customerEmail: "customer@example.com",
    customerName: "Customer",
    customerPhone: "9876543210",
    base: 250,
    discount: 0,
    total: 250,
    ...overrides,
  };
}
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-coworx",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed("settings/permissions",DEFAULT_PERMISSIONS);
  await seed("settings/policy",{...DEFAULT_POLICY,businessStart:"00:00",businessEnd:"23:59"});
  for (const [uid, role] of [
    ["customer", "User"],
    ["manager", "Manager"],
    ["reception", "Receptionist"],
  ])
    await seed("users/" + uid, {
      uid,
      email: uid + "@example.com",
      name: uid,
      role,
    });
});
afterAll(async () => {
  await env?.cleanup();
});
describe("database capability enforcement and booking lifecycle", () => {
  it("prevents customer privilege escalation and private-data access", async () => {
    const db = auth("customer");
    await assertFails(
      updateDoc(doc(db, "users/customer"), { role: "Manager" }),
    );
    const fresh = auth("new");
    await assertFails(
      setDoc(doc(fresh, "users/new"), {
        uid: "new",
        email: "new@example.com",
        role: "Admin",
      }),
    );
    await assertFails(getDoc(doc(fresh, "users/customer")));
    await assertSucceeds(
      setDoc(doc(fresh, "users/new"), {
        uid: "new",
        email: "new@example.com",
        name: "New",
        role: "User",
      }),
    );
  });
  it("publishes notices for managers and applies a saved denial immediately", async () => {
    const db = auth("manager");
    await assertSucceeds(
      setDoc(doc(db, "banners/notice"), { title: "Welcome", active: true }),
    );
    await assertSucceeds(
      getDoc(doc(env.unauthenticatedContext().firestore(), "banners/notice")),
    );
    await seed("settings/permissions", { Manager: { noticesManage: false } });
    await assertFails(
      updateDoc(doc(db, "banners/notice"), { title: "Changed" }),
    );
  });
  it("saves company and GST details only for a role with that capability", async () => {
    owner();
    await saveCompanySettings({
      name: "Coworx Central",
      gstNumber: "27TEST1234A1Z1",
      gstRate: 18,
    });
    expect(
      (await getDoc(doc(session.db, "settings/company"))).data()?.gstNumber,
    ).toBe("27TEST1234A1Z1");
    auth("manager");
    await assertFails(saveCompanySettings({ name: "No access" }));
    await seed("settings/permissions", { Manager: { companyManage: true } });
    await assertSucceeds(saveCompanySettings({ name: "Updated company" }));
  });
  it("accepts an email-matched receptionist invitation without allowing a forged role", async () => {
    await seed("roleAssignments/new-example-com", {
      email: "new@example.com",
      role: "Receptionist",
      status: "pending",
    });
    const db = auth("new");
    await setDoc(doc(db, "users/new"), {
      uid: "new",
      email: "new@example.com",
      name: "New",
      role: "User",
    });
    expect(
      (
        await getDocs(
          query(
            collection(db, "roleAssignments"),
            where("email", "==", "new@example.com"),
          ),
        )
      ).size,
    ).toBe(1);
    await activateAssignment(
      { id: "new-example-com", role: "Receptionist", status: "pending" },
      "new",
    );
    expect((await getDoc(doc(db, "users/new"))).data()?.role).toBe(
      "Receptionist",
    );
    await assertFails(updateDoc(doc(db, "users/new"), { role: "Manager" }));
  });
  it("creates one complete walk-in profile, reuses it, and supports its first booking", async () => {
    auth("reception");
    const data = {
      name: "GOPP",
      email: " GOPP@gmail.com ",
      phone: "4575757575",
      dob: "2000-05-22",
      profession: "Marketing Team",
      gender: "Female",
    };
    const first: any = await createCustomerProfile(
      data,
      "reception",
      "reception@example.com",
    );
    const again: any = await createCustomerProfile(data, "reception");
    expect(again.uid || again.id).toBe(first.uid);
    expect(again.alreadyExists).toBe(true);
    const created = await createBooking(
      booking({
        userId: first.uid,
        userEmail: "gopp@gmail.com",
        customerEmail: "gopp@gmail.com",
      }),
    );
    expect(
      (await getDoc(doc(session.db, "bookings", created.id))).data()?.userId,
    ).toBe(first.uid);
    await assertSucceeds(confirmBooking(created.id, "reception", 0, 250,"Cash"));
  });
  it("atomically confirms payment including add-ons, scans in/out once, and preserves finance", async () => {
    auth("customer");
    const created = await createBooking(
      booking({ addons: [{ name: "Print", total: 50 }], total: 300 }),
    );
    auth("manager");
    await confirmBooking(created.id, "manager", 20, 280, "Cash");
    let b = (await getDoc(doc(session.db, "bookings", created.id))).data()!;
    expect(b.total).toBe(280);
    expect(b.paymentStatus).toBe("Paid");
    auth("reception");
    await recordAttendance(created.id, "in", b.passToken);
    await expect(
      recordAttendance(created.id, "in", b.passToken),
    ).rejects.toThrow("already");
    await recordAttendance(created.id, "out", b.passToken);
    await expect(
      recordAttendance(created.id, "out", b.passToken),
    ).rejects.toThrow("already");
    await assertFails(
      updateDoc(doc(session.db, "bookings", created.id), { total: 0 }),
    );
    b = (await getDoc(doc(session.db, "bookings", created.id))).data()!;
    expect(b.total).toBe(280);
    expect(b.checkedOutBy).toBe("reception");
    expect(
      (
        await getDoc(doc(session.db, "attendance", created.id + "_" + today))
      ).exists(),
    ).toBe(true);
  });
  it("prevents blocked customers from creating a booking", async () => {
    await seed("users/customer", {
      uid: "customer",
      email: "customer@example.com",
      role: "User",
      blocked: true,
    });
    auth("customer");
    await assertFails(createBooking(booking()));
  });
  it("enforces a disabled check-in permission even with a valid pass", async () => {
    auth("manager");
    const b = await createBooking(booking());
    await confirmBooking(b.id,"manager",0,250,"Cash");
    await seed("settings/permissions", { Receptionist: { checkIn: false } });
    auth("reception");
    await assertFails(recordAttendance(b.id, "in"));
  });
  it("will not let a staff member without discounts alter the total", async () => {
    auth("manager");
    const b = await createBooking(booking());
    await seed("settings/permissions", {
      Manager: { bookingsDiscount: false },
    });
    await assertFails(confirmBooking(b.id, "manager", 10, 240));
    await assertFails(
      updateDoc(doc(session.db, "bookings", b.id), {
        status: "Confirmed",
        staffDiscount: 0,
        total: 0,
        confirmedBy: "manager",
        confirmedAt: serverTimestamp(),
        expiresAt: null,
        paymentReceived: 0,
      }),
    );
  });
  it("does not release a newer reservation when cancelling an expired hold", async () => {
    auth("customer");
    const old = await createBooking(booking());
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore(),
        b = (await getDoc(doc(db, "bookings", old.id))).data()!;
      await updateDoc(doc(db, "bookings", old.id), {
        expiresAt: Timestamp.fromMillis(Date.now() - 60000),
      });
      for (const id of b.lockIds)
        await updateDoc(doc(db, "bookingLocks", id), {
          expiresAt: Timestamp.fromMillis(Date.now() - 60000),
        });
    });
    const newer = await createBooking(booking());
    await cancelBooking(old.id, "customer");
    const data = (await getDoc(doc(session.db, "bookings", newer.id))).data()!;
    const lock = (
      await getDoc(doc(session.db, "bookingLocks", data.lockIds[0]))
    ).data()!;
    expect(lock.bookingId).toBe(newer.id);
    expect(lock.status).toBe("Pending");
    auth("manager");
    await expect(confirmBooking(old.id, "manager", 0, 250)).rejects.toThrow(
      "expired",
    );
  });
  it("keeps every desk paired with the correct date for multi-desk, multi-day bookings", async () => {
    auth("customer");
    const tomorrow = addDays(today, 1);
    const b = await createBooking(
      booking({
        endDate: tomorrow,
        dates: [today, tomorrow],
        inventoryIds: ["desk-D01", "desk-D02"],
        lockKeys: [
          today + "_desk-D01_day",
          tomorrow + "_desk-D01_day",
          today + "_desk-D02_day",
          tomorrow + "_desk-D02_day",
        ],
      }),
    );
    const rows = await getDocs(collection(session.db, "bookingLocks"));
    expect(rows.size).toBe(4);
    rows.forEach((r) => {
      const d = r.data();
      expect(r.id).toBe(d.date + "_" + d.inventoryId + "_day");
      expect(d.bookingId).toBe(b.id);
    });
  });
  it("creates a separately payable extension with the exact extra hour", async () => {
    auth("manager");
    const b = await createBooking(
      booking({
        date:addDays(today,1),endDate:addDays(today,1),
        space: "meeting",
        inventoryId: "meeting",
        start: "09:00",
        end: "10:00",
        durationHours: 1,
        status: "Confirmed",
      }),
    );
    await confirmBooking(b.id,"manager",0,250,"Cash");
    auth("customer");
    const extended = await extendBooking(b.id, {
      uid: "customer",
      extraHours: 1,
    });
    const parent = (await getDoc(doc(session.db, "bookings", b.id))).data()!,
      child = (await getDoc(doc(session.db, "bookings", extended.id))).data()!;
    expect(parent.end).toBe("10:00");
    expect(child.start).toBe("10:00");
    expect(child.end).toBe("11:00");
    expect(child.status).toBe("Pending");
    expect(child.extensionOf).toBe(b.id);
  });
});

describe("prepaid operations and consecutive passes",()=>{
  async function passBooking(days=10) {
    await seed("membershipPlans/plan",{name:`${days} day pass`,days,deskDays:days,price:1000,active:true,minimumAdvancePercent:50,balanceDueDays:7});
    auth("customer");
    return createBooking(booking({date:addDays(today,1),endDate:addDays(today,1),membershipId:"plan"}));
  }
  it("requires full advance for regular bookings and stores split receipts atomically",async()=>{
    auth("reception");const created=await createBooking(booking({status:"Confirmed"}));
    expect((await getDoc(doc(session.db,"bookings",created.id))).data()?.status).toBe("Pending");
    await expect(collectPayment(created.id,{cash:100,upi:0,other:0,reference:""})).rejects.toThrow("full advance");
    await collectPayment(created.id,{cash:100,upi:150,other:0,reference:"UPI-123"});
    const b=(await getDoc(doc(session.db,"bookings",created.id))).data()!;
    const receipt=(await getDoc(doc(session.db,"payments",b.lastPaymentId))).data()!;
    expect(b.paymentReceived).toBe(250);expect(receipt.cashAmount).toBe(100);expect(receipt.upiAmount).toBe(150);expect(receipt.provider).toBe("manual");
    await assertFails(updateDoc(doc(session.db,"payments",b.lastPaymentId),{amount:1}));
    auth("customer");await assertFails(updateDoc(doc(session.db,"bookings",created.id),{rescheduleAllowance:100}));
  });
  it("records allowed pass instalments and blocks a disabled collection capability",async()=>{
    const created=await passBooking();auth("reception");
    await expect(collectPayment(created.id,{cash:499,upi:0,other:0,reference:""})).rejects.toThrow("at least");
    await collectPayment(created.id,{cash:500,upi:0,other:0,reference:""});
    let b=(await getDoc(doc(session.db,"bookings",created.id))).data()!;
    expect(b.passDays).toBe(10);expect(b.dates).toHaveLength(10);expect(b.rescheduleAllowance).toBe(1);expect(b.paymentStatus).toBe("Partially Paid");
    await seed("settings/permissions",{Receptionist:{paymentsCollect:false}});
    await assertFails(collectPayment(created.id,{cash:500,upi:0,other:0,reference:""}));
    auth("manager");await collectPayment(created.id,{cash:0,upi:500,other:0,reference:"FINAL-1"});
    b=(await getDoc(doc(session.db,"bookings",created.id))).data()!;expect(b.paymentStatus).toBe("Paid");
    expect((await getDocs(collection(session.db,"payments"))).size).toBe(2);
  });
  it("reschedules once, moves its locks, then requires an admin-only exception",async()=>{
    const created=await passBooking();auth("manager");await collectPayment(created.id,{cash:500,upi:0,other:0,reference:""});
    let b=(await getDoc(doc(session.db,"bookings",created.id))).data()!;
    let to=addDays(b.endDate,1);while(officeHours(to).closed)to=addDays(to,1);
    const from=b.dates[0];auth("customer");await reschedulePass(created.id,from,to,"Unable to attend");
    b=(await getDoc(doc(session.db,"bookings",created.id))).data()!;expect(b.rescheduleUsed).toBe(1);expect(b.dates).not.toContain(from);expect(b.dates).toContain(to);
    expect((await getDoc(doc(session.db,"bookingLocks",`${from}_desk-D01_day`))).data()?.status).toBe("Cancelled");
    expect((await getDoc(doc(session.db,"bookingLocks",`${to}_desk-D01_day`))).data()?.status).toBe("Confirmed");
    let next=addDays(to,1);while(officeHours(next).closed)next=addDays(next,1);
    await expect(reschedulePass(created.id,b.dates[0],next,"Second change")).rejects.toThrow("allowance");
    await assertFails(grantReschedules(created.id,1,"Customer tries exception"));
    auth("manager");await seed("settings/permissions",{Manager:{passExceptions:true}});await assertFails(grantReschedules(created.id,2,"Not an admin"));
    owner();await grantReschedules(created.id,2,"Festival closure");
    b=(await getDoc(doc(session.db,"bookings",created.id))).data()!;expect(b.rescheduleAllowance).toBe(3);
    auth("customer");await reschedulePass(created.id,b.dates[0],next,"Approved festival change");
    expect((await getDocs(query(collection(session.db,"passChanges"),where("bookingId","==",created.id),where("customerEmail","==","customer@example.com")))).size).toBe(3);
  });
  it("supports thirty-day passes within database transaction limits",async()=>{
    const created=await passBooking(30);auth("manager");await collectPayment(created.id,{cash:1000,upi:0,other:0,reference:""});
    const b=(await getDoc(doc(session.db,"bookings",created.id))).data()!;expect(b.dates).toHaveLength(30);expect(b.rescheduleAllowance).toBe(3);expect(b.lockIds).toHaveLength(30);
  });
  it("keeps corrections immutable and prevents repeating a reversal",async()=>{
    auth("manager");const created=await createBooking(booking());await collectPayment(created.id,{cash:250,upi:0,other:0,reference:""});
    let b=(await getDoc(doc(session.db,"bookings",created.id))).data()!;const original=b.lastPaymentId;
    await assertFails(reversePayment(original,"Wrong receipt"));owner();await reversePayment(original,"Payment entered against wrong customer");
    b=(await getDoc(doc(session.db,"bookings",created.id))).data()!;expect(b.paymentReceived).toBe(0);
    await expect(reversePayment(original,"Again")).rejects.toThrow("already reversed");
    auth("reception");await expect(recordAttendance(created.id,"in")).rejects.toThrow("Full advance");
  });
  it("keeps private promotions staff-only and enforces coupon uses per customer",async()=>{
    await seed("coupons/ONCE",{code:"ONCE",type:"fixed",value:50,active:true,visibleToUsers:true,maxUsesPerCustomer:1});
    await seed("coupons/STAFF",{code:"STAFF",type:"percent",value:10,active:true,visibleToUsers:false,maxUsesPerCustomer:1});
    let db=auth("customer");
    await assertSucceeds(getDoc(doc(db,"coupons/ONCE")));
    await assertFails(getDoc(doc(db,"coupons/STAFF")));
    const first=await createBooking(booking({discount:50,total:200,couponId:"ONCE",couponCode:"ONCE"}));
    db=auth("reception");
    await assertSucceeds(getDoc(doc(db,"coupons/STAFF")));
    await collectPayment(first.id,{cash:200,upi:0,other:0,reference:""});
    expect((await getDoc(doc(db,"couponRedemptions/ONCE_customer"))).data()?.count).toBe(1);
    auth("customer");
    const date=addDays(today,1);
    const second=await createBooking(booking({date,endDate:date,inventoryId:"desk-D02",inventoryIds:["desk-D02"],discount:50,total:200,couponId:"ONCE",couponCode:"ONCE"}));
    auth("reception");
    await expect(collectPayment(second.id,{cash:200,upi:0,other:0,reference:""})).rejects.toThrow("maximum");
  });
});


describe("refunds, handovers and exact office times",()=>{
  it("records a cash refund once and keeps the original collection",async()=>{
    owner();const created=await createBooking(booking({date:addDays(today,2),endDate:addDays(today,2)}));
    await collectPayment(created.id,{cash:250,upi:0,other:0,reference:""});
    await cancelBooking(created.id,"owner");
    await processRefund(created.id,250,"Cash acknowledged","Cash");
    const b=(await getDoc(doc(session.db,"bookings",created.id))).data()!;
    expect(b.refundStatus).toBe("Processed");expect(b.paymentReceived).toBe(250);
    const payments=await getDocs(collection(session.db,"payments"));expect(payments.size).toBe(2);
    expect(payments.docs.find(d=>d.data().kind==="Refund")?.data().cashAmount).toBe(250);
    await expect(processRefund(created.id,250,"Duplicate","Cash")).rejects.toThrow("already processed");
    auth("customer");expect((await getDocs(query(collection(session.db,"payments"),where("customerEmail","==","customer@example.com")))).size).toBe(2);
  });
  it("saves reception cash handovers and denies customer submissions",async()=>{
    auth("reception");await saveHandover(today,500,750,750,"Till checked with next shift");
    expect((await getDocs(collection(session.db,"handovers"))).size).toBe(1);
    auth("customer");await assertFails(saveHandover(today,0,0,0,"Invalid"));
  });
  it("prevents quarter-hour reservations overlapping legacy hourly locks",async()=>{
    const date=addDays(today,1);await seed(`bookingLocks/${date}_meeting_09-00`,{bookingId:"legacy",inventoryId:"meeting",userId:"customer",date,start:"09:00",end:"10:00",status:"Confirmed",expiresAt:null});
    auth("manager");await expect(createBooking(booking({date,endDate:date,space:"meeting",inventoryId:"meeting",start:"09:15",end:"10:15",durationHours:1}))).rejects.toThrow("overlaps");
    const a=await createBooking(booking({date,endDate:date,space:"meeting",inventoryId:"meeting",start:"10:15",end:"11:15",durationHours:1}));
    const b=await createBooking(booking({date,endDate:date,space:"meeting",inventoryId:"meeting",start:"11:15",end:"12:15",durationHours:1}));
    expect(a.id).not.toBe(b.id);
    expect((await getDoc(doc(session.db,"bookings",a.id))).data()?.lockIds.length).toBe(4);
  });
});
