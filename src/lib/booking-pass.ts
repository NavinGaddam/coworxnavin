import { bookingOn, paymentAccessError, sessionHours, timeAt } from "./business";
export const PASS_PREFIX = "coworx:pass:v1:";
export function passPayload(id: string, token: string) {
  return `${PASS_PREFIX}${id}:${token}`;
}
export function parsePass(raw: string) {
  const match = raw
    .trim()
    .match(/^coworx:pass:v1:([a-zA-Z0-9_-]{1,128}):([a-zA-Z0-9-]{32,64})$/);
  if (!match)
    throw Error(
      "This is not a Coworx booking pass. Scan the QR shown in My bookings.",
    );
  return { id: match[1], token: match[2] };
}
export function attendanceError(b: any, date: string, action: "in" | "out", now = Date.now()) {
  if (b.status !== "Confirmed")
    return "Only a confirmed booking can be used at reception.";
  if (!bookingOn(b,date))
    return "This booking is not valid today.";
  if (action === "in") {
    const paymentError=paymentAccessError(b,date);
    if(paymentError) return paymentError;
    const h=sessionHours(b,date);
    if(now<timeAt(date,h.start) || now>=timeAt(date,h.end)) return "Check-in is available only during the booked session.";
  }
  const sameDay = b.attendanceDate === date;
  if (action === "in" && sameDay && b.checkedInAt && !b.checkedOutAt) return "This customer is already checked in.";
  if (action === "out" && (!sameDay || !b.checkedInAt))
    return "Check the customer in before checking them out.";
  if (action === "out" && b.checkedOutAt)
    return "This customer has already checked out today.";
  return "";
}
