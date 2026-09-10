import type { Role } from "../pages/types";

export const PERMISSIONS = [
  ["bookingsView", "Bookings", "View all bookings"],
  ["bookingsCreate", "Bookings", "Book for a customer"],
  ["paymentsCollect", "Finance", "Collect payments and confirm paid bookings"],
  ["collectionsView", "Finance", "View collections and close shifts"],
  ["paymentsCorrect", "Finance", "Correct a wrongly recorded payment method (admin only)"],
  ["passesView", "Bookings", "View consecutive passes"],
  ["passesReschedule", "Bookings", "Reschedule within the pass allowance"],
  ["passExceptions", "Administration", "Grant extra pass reschedules (admin only)"],
  ["bookingsCancel", "Bookings", "Cancel and release bookings"],
  ["bookingsDiscount", "Bookings", "Apply staff discounts"],
  ["bookingsExtend", "Bookings", "Extend confirmed bookings"],
  ["checkIn", "Front desk", "Check customers in"],
  ["checkOut", "Front desk", "Check customers out"],
  ["customersView", "Customers", "View customer directory"],
  ["customersCreate", "Customers", "Create customer profiles"],
  ["customersEdit", "Customers", "Edit customer profiles"],
  ["customersBlock", "Customers", "Block or unblock customers"],
  ["enquiriesManage", "Customers", "Manage enquiries"],
  ["revenueView", "Finance", "View revenue and export reports"],
  ["refundsManage", "Finance", "Record refunds"],
  ["pricingManage", "Workspace", "Manage rates and seasonal pricing"],
  ["catalogManage", "Workspace", "Manage offers, memberships and add-ons"],
  ["resourcesManage", "Workspace", "Manage maintenance, lockers and holidays"],
  ["noticesManage", "Workspace", "Publish homepage notices"],
  ["communicationsManage", "Workspace", "Manage message templates"],
  ["companyManage", "Administration", "Edit company and GST details"],
  ["paymentsManage", "Administration", "Edit payment settings"],
  ["wifiManage", "Administration", "Edit Wi-Fi details"],
  ["policyManage", "Administration", "Edit booking policy and shifts"],
  ["teamManage", "Administration", "Manage team and role permissions"],
  ["auditView", "Administration", "View activity log"],
] as const;
export type Permission = (typeof PERMISSIONS)[number][0];
export type PermissionSet = Record<Permission, boolean>;
export type PermissionMatrix = Record<Role, PermissionSet>;
const set = (allowed: readonly string[]): PermissionSet =>
  Object.fromEntries(
    PERMISSIONS.map(([key]) => [key, allowed.includes(key)]),
  ) as PermissionSet;
export const DEFAULT_PERMISSIONS: PermissionMatrix = {
  Admin: set(PERMISSIONS.map(([key]) => key)),
  Manager: set([
    "paymentsCollect",
    "collectionsView",
    "passesView",
    "passesReschedule",
    "bookingsView",
    "bookingsCreate",
    "bookingsCancel",
    "bookingsDiscount",
    "bookingsExtend",
    "checkIn",
    "checkOut",
    "customersView",
    "customersCreate",
    "customersEdit",
    "enquiriesManage",
    "revenueView",
    "resourcesManage",
    "noticesManage",
    "communicationsManage",
  ]),
  Receptionist: set([
    "paymentsCollect",
    "collectionsView",
    "passesView",
    "passesReschedule",
    "bookingsView",
    "bookingsCreate",
    "checkIn",
    "checkOut",
    "customersView",
    "customersCreate",
    "enquiriesManage",
  ]),
  User: set([]),
};
export function permissionMatrix(raw: any): PermissionMatrix {
  return Object.fromEntries(
    Object.entries(DEFAULT_PERMISSIONS).map(([role, defaults]) => [
      role,
      Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [
          key,
          role === "User"
            ? false
            : typeof raw?.[role]?.[key] === "boolean"
              ? raw[role][key]
              : value,
        ]),
      ),
    ]),
  ) as PermissionMatrix;
}
export function canAccess(
  role: Role,
  key: Permission,
  matrix: PermissionMatrix,
  owner = false,
) {
  const adminOnly = key === "passExceptions" || key === "paymentsCorrect";
  return (!adminOnly || role === "Admin") && (owner || (role !== "User" && Boolean(matrix[role]?.[key])));
}
export const STAFF_ROLES: Role[] = ["Admin", "Manager", "Receptionist"];

const dependencies: Partial<Record<Permission, Permission[]>> = {
  bookingsCreate: ["bookingsView", "customersView"],
  paymentsCollect: ["bookingsView", "collectionsView"],
  paymentsCorrect: ["bookingsView", "collectionsView"],
  passesReschedule: ["bookingsView", "passesView"],
  passesView: ["bookingsView"],
  bookingsCancel: ["bookingsView"],
  bookingsDiscount: ["paymentsCollect"],
  bookingsExtend: ["bookingsView"],
  checkIn: ["bookingsView"],
  checkOut: ["bookingsView"],
  customersCreate: ["customersView"],
  customersEdit: ["customersView"],
  customersBlock: ["customersView"],
};
export function changePermission(
  matrix: PermissionMatrix,
  role: Role,
  key: Permission,
  enabled: boolean,
): PermissionMatrix {
  if ((key === "paymentsCorrect" || key === "passExceptions") && role !== "Admin")
    return matrix;
  const next = { ...matrix, [role]: { ...matrix[role] } };
  const change = (p: Permission, value: boolean) => {
    next[role][p] = value;
    if (value) (dependencies[p] || []).forEach((dep) => change(dep, true));
    else
      Object.entries(dependencies).forEach(([dependent, requires]) => {
        if (requires.includes(p)) change(dependent as Permission, false);
      });
  };
  change(key, enabled);
  return next;
}
