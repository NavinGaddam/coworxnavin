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
export function attendanceError(b: any, date: string, action: "in" | "out") {
  if (b.status !== "Confirmed")
    return "Only a confirmed booking can be used at reception.";
  if (date < b.date || date > (b.endDate || b.date))
    return "This booking is not valid today.";
  const sameDay = b.attendanceDate === date;
  if (action === "in" && sameDay && b.checkedInAt)
    return b.checkedOutAt
      ? "This customer has already checked out today."
      : "This customer is already checked in.";
  if (action === "out" && (!sameDay || !b.checkedInAt))
    return "Check the customer in before checking them out.";
  if (action === "out" && b.checkedOutAt)
    return "This customer has already checked out today.";
  return "";
}
