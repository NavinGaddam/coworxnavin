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
    await assertFails(confirmBooking(created.id, "reception", 0, 250));
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
    const b = await createBooking(booking({ status: "Confirmed" }));
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
      "no longer active",
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
        space: "meeting",
        inventoryId: "meeting",
        start: "09:00",
        end: "10:00",
        durationHours: 1,
        status: "Confirmed",
      }),
    );
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
