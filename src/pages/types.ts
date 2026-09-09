export type Role = "User" | "Manager" | "Receptionist" | "Admin";
export type Space = "desk" | "meeting" | "conference" | "podcast" | "cubicle";
export type OfferType = "percent" | "fixed";
export type TargetType = "all" | "email";
export type BookingStatus = "Pending" | "Confirmed" | "Expired" | "Cancelled";
export type PaymentStatus =
  "Pending" | "Partially Paid" | "Paid" | "Refund Pending" | "Refunded";
export type RefundStatus =
  "Not Requested" | "Pending" | "Approved" | "Processed" | "Rejected";
export type AppUser = {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: Role;
  phone?: string;
  age?: number;
  gender?: string;
  dob?: string;
  profession?: string;
  customerNotes?: string;
  vip?: boolean;
  blocked?: boolean;
  blockedReason?: string;
  preferredDesk?: string;
  company?: string;
  referralCode?: string;
  referralCount?: number;
  totalSpend?: number;
  bookingCount?: number;
  lastBookingAt?: any;
  membershipId?: string;
  membershipName?: string;
  membershipRemaining?: number;
};
export type Offer = {
  id: string;
  title: string;
  description: string;
  type: OfferType;
  value: number;
  targetType: TargetType;
  targetEmail?: string;
  active: boolean;
  space?: Space | string;
  minDays?: number;
  maxDays?: number;
  autoApply?: boolean;
  couponCode?: string;
  expiresAt?: any;
  visibleToUsers?: boolean;
};
export type Booking = {
  id: string;
  userId: string;
  userEmail: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  inventoryId: string;
  inventoryIds?: string[];
  lockIds?: string[];
  space: Space;
  label: string;
  date: string;
  endDate?: string;
  days?: number;
  dates?: string[];
  start?: string;
  end?: string;
  durationHours?: number;
  base: number;
  discount: number;
  staffDiscount?: number;
  total: number;
  offerId?: string | null;
  couponCode?: string;
  couponId?: string;
  membershipId?: string;
  referralCode?: string;
  status: BookingStatus;
  walkIn?: boolean;
  createdByRole?: Role | string;
  paymentMethod?: "UPI" | "Cash" | "Other";
  paymentRef?: string;
  paymentReceived?: number;
  paymentStatus?: PaymentStatus;
  confirmedBy?: string;
  confirmedAt?: any;
  expiresAt?: any;
  createdAt?: any;
  checkoutChannel?: "whatsapp" | "staff_manual" | "razorpay";
  checkedInAt?: any;
  checkedOutAt?: any;
  attendanceDate?: string;
  checkedInBy?: string;
  checkedOutBy?: string;
  passToken?: string;
  passValidFrom?: any;
  passValidUntil?: any;
  revokedBy?: string;
  revokedAt?: any;
  cancellationReason?: string;
  refundStatus?: RefundStatus;
  refundAmount?: number;
  refundReference?: string;
  invoiceNumber?: string;
  extensionOf?: string;
  extensionTotal?: number;
  addons?: Array<{
    id: string;
    name: string;
    qty: number;
    unitPrice: number;
    total: number;
  }>;
  amenities?: string[];
  notes?: string;
  billing?: {company:string;gstNumber:string;address:string};
  passDays?: number;
  minimumAdvance?: number;
  balanceDueDate?: string;
  rescheduleAllowance?: number;
  rescheduleUsed?: number;
  sessions?: Record<string, {start: string; end: string}>;
};
export const ADMIN_EMAIL = "vsshegur@gmail.com";
export const ADMIN_EMAILS = ["vsshegur@gmail.com", "navingaddam2@gmail.com"];
export const WA = "919970836509";
export const BUSINESS_START = "09:00";
export const BUSINESS_END = "19:00";
export const DESK_COUNT = 22;
export const DEFAULT_PRICING = {
  desk_basic: 200,
  desk_premium: 250,
  meeting_hourly: 600,
  conference_hourly: 500,
  podcast_hourly: 200,
};
const premiumDeskNumbers = [2, 3, 9, 15, 22];
export const desks = Array.from({ length: DESK_COUNT }, (_, i) => {
  const number = i + 1;
  return {
    id: `D${String(number).padStart(2, "0")}`,
    number,
    premium: premiumDeskNumbers.includes(number),
  };
});
export const seats = desks;
export const confStarts = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];
export const meetingStarts = confStarts;
export const podStarts = confStarts;
export const localToday = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};
export const today = localToday;
export const addHours = (t: string, h: number) => {
  const [hh, mm] = t.split(":").map(Number),
    n = hh * 60 + mm + h * 60;
  return `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};
export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const dateSpan = (start: string, end: string) => {
  if (end < start) return [];
  const out: string[] = [];
  for (let i = 0; i < 370; i++) {
    const d = addDays(start, i);
    out.push(d);
    if (d === end) break;
  }
  return out;
};
export const withinBusinessHours = (start: string, end: string) =>
  start >= BUSINESS_START && end <= BUSINESS_END && start < end;
export const emailKey = (email: string) =>
  email
    .trim()
    .toLowerCase()
    .replaceAll(".", "-")
    .replaceAll("#", "-")
    .replaceAll("$", "-")
    .replaceAll("[", "-")
    .replaceAll("]", "-")
    .replaceAll("/", "-");
export const spaceLabel = (space: Space) =>
  space === "desk" || space === "cubicle"
    ? "Desk"
    : space === "meeting"
      ? "Meeting Room"
      : space === "conference"
        ? "Conference Room"
        : "Creator Studio";
export type CompanySettings = {
  name: string;
  address: string;
  gstNumber?: string;
  gstRate?: number;
  invoicePrefix?: string;
  phone?: string;
  email?: string;
};
export type Holiday = {
  id: string;
  date: string;
  reason: string;
  active: boolean;
};
export type Banner = {
  id: string;
  kind: "offer" | "instruction" | "reminder" | "holiday";
  title: string;
  message: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  active: boolean;
};
export type Enquiry = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  interest?: string;
  notes?: string;
  status: "New" | "Contacted" | "Converted" | "Closed";
  source: "Staff" | "Signup";
};
export type PricingRule = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  pricing: Record<string, number>;
  active: boolean;
};
export const isWednesday = (d: string) => {
  try {
    return new Date(`${d}T00:00:00`).getDay() === 3;
  } catch {
    return false;
  }
};
export const isWithinRange = (d: string, start: string, end: string) =>
  d >= start && d <= end;
export const nowInRange = (
  startDate?: string,
  endDate?: string,
  startTime?: string,
  endTime?: string,
) => {
  const ds = localToday();
  if (startDate && ds < startDate) return false;
  if (endDate && ds > endDate) return false;
  const t = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  if (startTime && t < startTime) return false;
  if (endTime && t > endTime) return false;
  return true;
};
