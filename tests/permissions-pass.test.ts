import { describe, it, expect } from "vitest";
import {
  DEFAULT_PERMISSIONS,
  changePermission,
  permissionMatrix,
  canAccess,
} from "../src/lib/permissions";
import {
  attendanceError,
  parsePass,
  passPayload,
} from "../src/lib/booking-pass";
describe("role boundaries", () => {
  it("gives reception arrival access without financial or company administration", () => {
    const p = DEFAULT_PERMISSIONS.Receptionist;
    expect(p.checkIn && p.checkOut && p.customersCreate).toBe(true);
    expect(p.paymentsCorrect || p.companyManage || p.refundsManage).toBe(false);
  });
  it("enables prerequisites and removes dependent access when its read capability is removed", () => {
    const m = changePermission(
      DEFAULT_PERMISSIONS,
      "Receptionist",
      "bookingsDiscount",
      true,
    );
    expect(m.Receptionist.paymentsCollect).toBe(true);
    const n = changePermission(m, "Receptionist", "bookingsView", false);
    expect(
      n.Receptionist.bookingsDiscount ||
        n.Receptionist.checkIn ||
        n.Receptionist.bookingsCreate,
    ).toBe(false);
  });
  it("ignores staff capabilities for customer accounts and retains owner recovery access", () => {
    const m = permissionMatrix({
      User: { teamManage: true },
      Admin: { teamManage: false },
    });
    expect(canAccess("User", "teamManage", m)).toBe(false);
    expect(canAccess("Admin", "teamManage", m, true)).toBe(true);
  });
});
describe("booking passes", () => {
  const token = "12345678-1234-1234-1234-123456789abc",
    b = { status: "Confirmed", date: "2026-09-09", endDate: "2026-09-10", total:250, paymentReceived:250 };
  it("round trips a local QR payload and rejects arbitrary content", () => {
    expect(parsePass(passPayload("abc", token))).toEqual({ id: "abc", token });
    expect(() => parsePass("https://untrusted.example")).toThrow();
  });
  it("rejects unconfirmed, wrong-day and duplicate attendance, while permitting the next booked day", () => {
    expect(
      attendanceError({ ...b, status: "Pending" }, b.date, "in"),
    ).toBeTruthy();
    expect(attendanceError(b, "2026-09-11", "in")).toBeTruthy();
    expect(attendanceError(b, b.date, "out")).toBeTruthy();
    const visited = {
      ...b,
      attendanceDate: b.date,
      checkedInAt: 1,
      checkedOutAt: 2,
    };
    expect(attendanceError(visited, b.date, "in",new Date("2026-09-09T12:00:00+05:30").getTime())).toBe("");
    expect(attendanceError(visited, b.date, "out")).toContain("already");
    expect(attendanceError(visited, "2026-09-10", "in",new Date("2026-09-10T12:00:00+05:30").getTime())).toBe("");
  });
});

it("generates a QR that the receptionist decoder reads exactly", async () => {
  const QRCode = await import("qrcode"),
    jsQR = (await import("jsqr")).default,
    { PNG } = await import("pngjs");
  const payload = passPayload(
    "booking_123",
    "12345678-1234-1234-1234-123456789abc",
  );
  const png = PNG.sync.read(
    await QRCode.toBuffer(payload, { width: 300, margin: 4 }),
  );
  expect(
    jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
  ).toBe(payload);
});
