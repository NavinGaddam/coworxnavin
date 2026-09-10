import { addDays, localToday } from "../pages/types";

export const PASS_ALLOWANCES: Record<number, number> = { 10: 1, 20: 2, 30: 3 };
export const DEFAULT_POLICY = {
  maxAdvanceDays: 60, businessStart: "09:00", businessEnd: "19:00",
  minimumAdvancePercent: 100, balanceDueDays: 0, rescheduleWindowDays: 30,
  cancellationHours: 24, cancellationRefundPercent: 100,
  weekly: { 0: { closed: true } } as Record<string, any>, seasons: [] as any[], exceptions: [] as any[],
};
export const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(n || 0));
export const localTime = (now = new Date()) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
export const minutes = (t: string) => { const [h,m] = t.split(":").map(Number); return h * 60 + m; };
export const timeAt = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).getTime();
export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export function officeHours(date: string, raw: any = {}, holidays: any[] = []) {
  const policy = { ...DEFAULT_POLICY, ...raw, weekly: { ...DEFAULT_POLICY.weekly, ...(raw?.weekly || {}) } };
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date).getTime()))return {start:policy.businessStart,end:policy.businessEnd,closed:true,reason:"Choose a valid date"};
  const season = [...(policy.seasons || [])].filter((s: any) => s.from <= date && date <= s.to).sort((a: any,b: any) => b.from.localeCompare(a.from))[0];
  const weekly = policy.weekly?.[weekday(date)] || {};
  const exception = (policy.exceptions || []).find((e: any) => e.date === date);
  const holiday = holidays.find(h => h.active !== false && h.date === date);
  const hours = { start: policy.businessStart, end: policy.businessEnd, closed: false, ...weekly, ...season, ...exception };
  const closed = Boolean(holiday) || Boolean(hours.closed);
  return { start: hours.start, end: hours.end, closed, reason: holiday?.reason || hours.reason || (weekday(date) === 0 ? "Sunday holiday" : "Closed") };
}
export function consecutiveDates(start: string, count: number, policy: any = {}, holidays: any[] = []) {
  if (!PASS_ALLOWANCES[count]) throw Error("Choose a 10, 20 or 30 working-day pass.");
  const dates: string[] = [];
  for (let i = 0; i < 366 && dates.length < count; i++) {
    const date = addDays(start, i);
    if (!officeHours(date, policy, holidays).closed) dates.push(date);
  }
  if (dates.length !== count) throw Error("There are not enough open days for this pass.");
  return dates;
}
export function sessionHours(b: any, date: string) { return b.sessions?.[date] || { start: b.start || "09:00", end: b.end || "19:00" }; }
export const bookingOn = (b: any, date: string) => b.dates?.length ? b.dates.includes(date) : b.date <= date && (b.endDate || b.date) >= date;
export const balance = (b: any) => Math.max(0, Math.round((Number(b.total || 0) - Number(b.paymentReceived || 0)) * 100) / 100);
export function paymentAccessError(b: any) {
  if (b.status !== "Confirmed") return "Payment must be verified before this booking is active.";
  if (balance(b) > 0) return "Full advance payment is required before entry.";
  return "";
}
export function sessionState(b: any, now = new Date()) {
  const date = localToday(), hours = sessionHours(b, date);
  if (!bookingOn(b,date)) return "Not scheduled";
  if (now.getTime() >= timeAt(date,hours.end)) return "Ended";
  if (b.attendanceDate === date && b.checkedInAt) return b.checkedOutAt ? "Left · re-entry allowed" : "Inside";
  return "Expected";
}
export function rescheduleError(b: any, from: string, to: string, policy: any, holidays: any[], now = Date.now()) {
  if (!b.passDays || b.status !== "Confirmed") return "Only a confirmed consecutive pass can be rescheduled.";
  if (!b.dates.includes(from) || b.dates.includes(to)) return "Choose a scheduled day and a different unused date.";
  if (timeAt(from,sessionHours(b,from).start) <= now) return "A pass day must be moved before its session starts.";
  if (timeAt(to,officeHours(to,policy,holidays).start) <= now) return "Choose a future open session.";
  if (officeHours(to,policy,holidays).closed) return "The replacement date is a holiday or closed day.";
  if (to < b.date || to > addDays(b.originalEndDate || b.endDate, Number(policy.rescheduleWindowDays || 30))) return "The replacement date is outside this pass’s reschedule window.";
  if (Number(b.rescheduleUsed || 0) >= Number(b.rescheduleAllowance || 0)) return "Reschedule allowance used. Ask admin for an exception.";
  return "";
}
export function cancellationQuote(b: any, now = Date.now()) {
  const policy = b.cancellationPolicy || { hours: 24, refundPercent: 100 };
  const beforeCutoff = now <= timeAt(b.date,sessionHours(b,b.date).start) - Number(policy.hours) * 3600000;
  const refundable = b.status === "Pending" || beforeCutoff;
  return { beforeCutoff, refund: refundable ? Math.round(Number(b.paymentReceived || 0) * Number(policy.refundPercent) ) / 100 : 0, cutoff: timeAt(b.date,sessionHours(b,b.date).start) - Number(policy.hours) * 3600000 };
}
export function validatePolicy(p: any) {
  const ranges = [{ start:p.businessStart,end:p.businessEnd }, ...Object.values(p.weekly || {}), ...(p.seasons || []), ...(p.exceptions || [])] as any[];
  if (ranges.some(h => !h.closed && (!/^\d{2}:\d{2}$/.test(h.start) || !/^\d{2}:\d{2}$/.test(h.end) || minutes(h.start) < 0 || minutes(h.end) > 1439 || minutes(h.start) >= minutes(h.end)))) throw Error("Opening time must be before closing time on the same day.");
  if ((p.seasons || []).some((s:any) => !s.from || !s.to || s.to < s.from)) throw Error("Choose valid seasonal date ranges.");
  if ((p.exceptions || []).some((e:any) => !e.date)) throw Error("Choose a date for each exception.");
  for (const [key,min,max] of [["minimumAdvancePercent",100,100],["balanceDueDays",0,0],["rescheduleWindowDays",1,90],["cancellationHours",0,168],["cancellationRefundPercent",0,100],["maxAdvanceDays",1,365]] as const)
    if (!Number.isFinite(Number(p[key])) || Number(p[key]) < min || Number(p[key]) > max) throw Error(`Enter a valid ${key.replace(/([A-Z])/g," $1").toLowerCase()}.`);
}
