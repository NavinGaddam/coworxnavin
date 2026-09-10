export const normalizeEmail = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
export const validEmail = (value: unknown) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
export const normalizePhone = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/[\s()-]/g, "");
export const validPhone = (value: unknown) =>
  /^\+?\d{10,15}$/.test(normalizePhone(value));
export const emptyCustomer = () => ({
  name: "",
  email: "",
  phone: "",
  gender: "",
  dob: "",
  profession: "",
});
export type CustomerDraft = ReturnType<typeof emptyCustomer>;
export function validateCustomer(draft: CustomerDraft, today: string) {
  const value = {
    ...draft,
    name: draft.name.trim(),
    email: normalizeEmail(draft.email),
    phone: normalizePhone(draft.phone),
    profession: draft.profession.trim(),
  };
  if (!value.name) throw Error("Enter the customer's full name.");
  if (!validEmail(value.email)) throw Error("Enter a valid customer email.");
  if (!validPhone(value.phone))
    throw Error("Enter a mobile number with 10–15 digits.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value.dob) ||
    Number.isNaN(new Date(value.dob + "T00:00:00Z").getTime()) ||
    new Date(value.dob + "T00:00:00Z").toISOString().slice(0, 10) !==
      value.dob ||
    value.dob > today ||
    value.dob < "1900-01-01"
  )
    throw Error("Enter a valid date of birth.");
  if (!value.profession) throw Error("Enter the customer's profession.");
  return value;
}
export function ageFromDob(dob:string,today:string){
  const birth=new Date(dob+"T00:00:00Z"), now=new Date(today+"T00:00:00Z");
  return now.getUTCFullYear()-birth.getUTCFullYear()-(now.getUTCMonth()<birth.getUTCMonth()||now.getUTCMonth()===birth.getUTCMonth()&&now.getUTCDate()<birth.getUTCDate()?1:0);
}
export function customerMatches(customer: any, term: string) {
  const q = term.trim().toLowerCase(),
    digits = q.replace(/\D/g, "");
  return (
    !q ||
    [customer.name, customer.email].some((v) =>
      String(v || "")
        .toLowerCase()
        .includes(q),
    ) ||
    Boolean(
      digits &&
      String(customer.phone || "")
        .replace(/\D/g, "")
        .includes(digits),
    )
  );
}
