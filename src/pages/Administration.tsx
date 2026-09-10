import HoursEditor from "../components/HoursEditor";
import { DEFAULT_POLICY, validatePolicy } from "../lib/business";
import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ShieldCheck,
  UserPlus,
  Wifi,
  WalletCards,
  Clock3,
  ScrollText,
} from "lucide-react";
import {
  addAdmin,
  removeAdmin,
  saveCompanySettings,
  saveWifi,
  saveUpi,
  savePermissions,
  loadSetting,
  savePolicy,
  saveShift,
} from "../lib/firestore";
import { assignStaff, watchTeamAssignments } from "../lib/platform";
import {
  DEFAULT_PERMISSIONS,
  PERMISSIONS,
  PermissionMatrix,
  changePermission,
} from "../lib/permissions";
import { ADMIN_EMAILS, Role } from "./types";
export default function Administration({
  can,
  user,
  company,
  wifi,
  upi,
  users = [],
  admins = [],
  logs = [],
  matrix,
  bookings = [],
  onFlash,
}: any) {
  const pages = [
    ["company", "Company & GST", "companyManage", Building2],
    ["payments", "Payments", "paymentsManage", WalletCards],
    ["wifi", "Wi-Fi", "wifiManage", Wifi],
    ["policy", "Hours & policies", "policyManage", Clock3],
    ["team", "Team & permissions", "teamManage", ShieldCheck],
    ["audit", "Activity log", "auditView", ScrollText],
  ].filter(([, , permission]) => can(permission));
  const [tab, setTab] = useState(String(pages[0]?.[0] || "")),
    [companyDraft, setCompanyDraft] = useState<any>(company || {}),
    [wifiDraft, setWifiDraft] = useState<any>(wifi || {}),
    [upiDraft, setUpiDraft] = useState<any>(upi || {});
  const [permissions, setPermissions] = useState<PermissionMatrix>(
      matrix || DEFAULT_PERMISSIONS,
    ),
    [teamEmail, setTeamEmail] = useState(""),
    [teamRole, setTeamRole] = useState<Role>("Receptionist"),
    [assignments, setAssignments] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [policy, setPolicy] = useState<any>(DEFAULT_POLICY),
    [shifts, setShifts] = useState<any>({
      morning: "09:00–15:00",
      evening: "15:00–19:00",
      note: "",
    });
  useEffect(() => setCompanyDraft(company || {}), [company]);
  useEffect(() => setWifiDraft(wifi || {}), [wifi]);
  useEffect(() => setUpiDraft(upi || {}), [upi]);
  useEffect(() => setPermissions(matrix), [matrix]);
  useEffect(() => {
    if (!can("teamManage")) return;
    return watchTeamAssignments(setAssignments, (e) => setError(e.message));
  }, [can("teamManage")]);
  useEffect(() => {
    if (can("policyManage")) {
      loadSetting("policy", policy)
        .then(setPolicy)
        .catch((e) => setError(e.message));
      loadSetting("shifts", shifts)
        .then(setShifts)
        .catch((e) => setError(e.message));
    }
  }, []);
  const save = async (fn: () => Promise<any>, message: string) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onFlash(message);
    } catch (e: any) {
      setError(e.message || "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const fields = (values: any, setValues: any, items: string[][]) => (
    <div className="fieldGrid">
      {items.map(([key, label, type = "text"]) => (
        <label key={key}>
          {label}
          <input
            type={type}
            value={values[key] ?? ""}
            onChange={(e) =>
              setValues({
                ...values,
                [key]:
                  type === "number" ? Number(e.target.value) : e.target.value,
              })
            }
          />
        </label>
      ))}
    </div>
  );
  const staff = new Map<string, any>();
  users
    .filter((u: any) => ["Admin", "Manager", "Receptionist"].includes(u.role))
    .forEach((u: any) => staff.set(u.email, u));
  assignments
    .filter((a) => a.status !== "revoked" && a.role !== "User")
    .forEach((a) =>
      staff.set(a.email, {
        ...staff.get(a.email),
        email: a.email,
        role: a.role,
      }),
    );
  admins.forEach((email: string) =>
    staff.set(email, { ...staff.get(email), email, role: "Admin" }),
  );
  return (
    <section className="workspacePage">
      <div className="pageHeading">
        <div>
          <span className="eyebrow">BUSINESS SETTINGS</span>
          <h1>Administration</h1>
          <p>Set up the business. Give each person the access they need.</p>
        </div>
      </div>
      <div className="settingsLayout">
        <nav className="settingsNav" aria-label="Administration sections">
          {pages.map(([id, label, , Icon]: any) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                setError("");
              }}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="settingsContent">
          {error && (
            <p className="inlineError" role="alert">
              {error}
            </p>
          )}
          {tab === "company" && can("companyManage") && (
            <section className="surface">
              <div className="sectionHeading">
                <div>
                  <h3>Company & GST</h3>
                  <p>These details appear on customer invoices and receipts.</p>
                </div>
                <Building2 />
              </div>
              {fields(companyDraft, setCompanyDraft, [
                ["name", "Company name"],
                ["address", "Business address"],
                ["gstNumber", "GSTIN (optional)"],
                ["gstRate", "GST rate (%)", "number"],
                ["invoicePrefix", "Invoice prefix"],
                ["phone", "Phone", "tel"],
                ["email", "Email", "email"],
              ])}
              <p className="muted">
                Leave GSTIN empty to issue plain receipts. Existing bookings
                keep their recorded prices.
              </p>
              <div className="formActions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    save(async () => {
                      if (!companyDraft.name?.trim())
                        throw Error("Enter the company name.");
                      if (
                        !Number.isFinite(Number(companyDraft.gstRate)) ||
                        companyDraft.gstRate < 0 ||
                        companyDraft.gstRate > 100
                      )
                        throw Error("Enter a GST rate between 0 and 100.");
                      await saveCompanySettings({
                        ...companyDraft,
                        name: companyDraft.name.trim(),
                        gstNumber: String(companyDraft.gstNumber || "")
                          .trim()
                          .toUpperCase(),
                      });
                    }, "Company and GST details saved.")
                  }
                >
                  <CheckCircle2 size={17} />
                  {busy ? "Saving…" : "Save company details"}
                </button>
              </div>
            </section>
          )}
          {tab === "payments" && can("paymentsManage") && (
            <section className="surface">
              <div className="sectionHeading">
                <div>
                  <h3>Payment details</h3>
                  <p>Customers complete requests on WhatsApp; staff verifies Cash/UPI before confirmation. Payment records are provider-ready for a future Razorpay connection.</p>
                </div>
                <WalletCards />
              </div>
              {fields(upiDraft, setUpiDraft, [
                ["upiId", "UPI ID"],
                ["merchantName", "Merchant name"],
              ])}
              <p className="noticeBox"><b>Current checkout: WhatsApp + manual verification</b><br/>Do not mark a booking paid until the UPI transaction appears in the merchant account or cash is physically received.</p>
              <div className="formActions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    save(() => saveUpi(upiDraft), "Payment settings saved.")
                  }
                >
                  Save payment details
                </button>
              </div>
            </section>
          )}
          {tab === "wifi" && can("wifiManage") && (
            <section className="surface">
              <div className="sectionHeading">
                <div>
                  <h3>Workspace Wi-Fi</h3>
                  <p>Shown with confirmed bookings in the customer account.</p>
                </div>
                <Wifi />
              </div>
              {fields(wifiDraft, setWifiDraft, [
                ["ssid", "Network name"],
                ["password", "Password"],
                ["note", "Instructions"],
              ])}
              <div className="formActions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    save(() => saveWifi(wifiDraft), "Wi-Fi details saved.")
                  }
                >
                  Save Wi-Fi details
                </button>
              </div>
            </section>
          )}
          {tab === "policy" && can("policyManage") && (
            <>
              <section className="surface">
                <div className="sectionHeading">
                  <div>
                    <h3>Booking policy</h3>
                    <p>Office schedules, advance payments and customer change policies.</p>
                  </div>
                  <Clock3 />
                </div>
                <HoursEditor value={policy} onChange={setPolicy} bookings={bookings}/>
                <h3>Booking & payment policy</h3>
                {fields(policy,setPolicy,[["maxAdvanceDays","Maximum advance booking days","number"],["minimumAdvancePercent","Default minimum pass advance (%)","number"],["balanceDueDays","Pass balance due after start (calendar days)","number"],["rescheduleWindowDays","Replacement date window after original pass end (days)","number"],["cancellationHours","Cancellation cutoff before first session (hours)","number"],["cancellationRefundPercent","Refund percentage before cutoff","number"]])}
                <p>Regular bookings always require full advance. Passes include 1 / 2 / 3 reschedules for 10 / 20 / 30 working days. Only admin can grant additional allowance.</p>
                <div className="formActions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      save(async () => {
                        validatePolicy(policy);
                        await savePolicy(policy);
                      }, "Booking policy saved.")
                    }
                  >
                    Save policy
                  </button>
                </div>
              </section>
              <section className="surface">
                <h3>Staff shifts</h3>
                {fields(shifts, setShifts, [
                  ["morning", "Morning shift"],
                  ["evening", "Evening shift"],
                  ["note", "Handover note"],
                ])}
                <div className="formActions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      save(() => saveShift(shifts, user.uid), "Shifts saved.")
                    }
                  >
                    Save shifts
                  </button>
                </div>
              </section>
            </>
          )}
          {tab === "team" && can("teamManage") && (
            <>
              <section className="surface">
                <div className="sectionHeading">
                  <div>
                    <h3>Your team</h3>
                    <p>
                      Assign access by email. New staff receive their role when
                      they sign in.
                    </p>
                  </div>
                  <UserPlus />
                </div>
                <form
                  className="teamInvite"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save(async () => {
                      if (teamRole === "Admin")
                        await addAdmin(teamEmail, user.uid, user.email);
                      else await assignStaff(teamEmail, teamRole, user.uid);
                      setTeamEmail("");
                    }, "Team access updated.");
                  }}
                >
                  <input
                    aria-label="Team email"
                    type="email"
                    required
                    value={teamEmail}
                    onChange={(e) => setTeamEmail(e.target.value)}
                    placeholder="colleague@example.com"
                  />
                  <select
                    aria-label="Team role"
                    value={teamRole}
                    onChange={(e) => setTeamRole(e.target.value as Role)}
                  >
                    <option>Receptionist</option>
                    <option>Manager</option>
                    <option>Admin</option>
                  </select>
                  <button className="primary" disabled={busy}>
                    Add team member
                  </button>
                </form>
                <div className="teamRoster">
                  {[...staff.values()].map((u: any) => (
                    <div key={u.email}>
                      <span>
                        <b>{u.name || u.email}</b>
                        <small>
                          {u.name
                            ? u.email
                            : ADMIN_EMAILS.includes(u.email)
                              ? "Protected owner"
                              : "Team member"}
                        </small>
                      </span>
                      <span className="statePill">{u.role}</span>
                      {!ADMIN_EMAILS.includes(u.email) &&
                        u.email !== user.email && (
                          <button
                            className="textButton dangerText"
                            disabled={busy}
                            onClick={() =>
                              save(
                                () =>
                                  u.role === "Admin"
                                    ? removeAdmin(u.email, user.uid, user.email)
                                    : assignStaff(u.email, "User", user.uid),
                                "Staff access removed.",
                              )
                            }
                          >
                            Remove access
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              </section>
              <section className="surface">
                <div className="sectionHeading">
                  <div>
                    <h3>Role permissions</h3>
                    <p>
                      Changes apply to every person in the role and are enforced
                      by the database. Owner accounts always retain full access.
                    </p>
                  </div>
                  <ShieldCheck />
                </div>
                <div className="permissionTableWrap">
                  <table className="permissionTable">
                    <thead>
                      <tr>
                        <th>Capability</th>
                        {["Admin", "Manager", "Receptionist"].map((r) => (
                          <th key={r}>{r}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSIONS.map(([key, group, label], i) => (
                        <tr key={key}>
                          <th>
                            {(i === 0 || PERMISSIONS[i - 1][1] !== group) && (
                              <small>{group}</small>
                            )}
                            {label}
                          </th>
                          {(["Admin", "Manager", "Receptionist"] as const).map(
                            (role) => (
                              <td key={role}>
                                <input
                                  type="checkbox"
                                  aria-label={`${role}: ${label}`}
                                  checked={permissions[role][key]}
                                  onChange={(e) =>
                                    setPermissions(
                                      changePermission(
                                        permissions,
                                        role,
                                        key,
                                        e.target.checked,
                                      ),
                                    )
                                  }
                                />
                              </td>
                            ),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted">
                  Customers can manage their own profile and booking requests.
                  They cannot receive staff privileges from this table.
                </p>
                <div className="formActions">
                  <button
                    className="ghost"
                    disabled={busy}
                    onClick={() => setPermissions(DEFAULT_PERMISSIONS)}
                  >
                    Reset draft to defaults
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      save(
                        () =>
                          savePermissions(
                            { ...permissions, User: DEFAULT_PERMISSIONS.User },
                            user.uid,
                          ),
                        "Role permissions saved.",
                      )
                    }
                  >
                    {busy ? "Saving…" : "Save permissions"}
                  </button>
                </div>
              </section>
            </>
          )}
          {tab === "audit" && can("auditView") && (
            <section className="surface">
              <div className="sectionHeading">
                <div>
                  <h3>Activity log</h3>
                  <p>Customer and team changes recorded by the app.</p>
                </div>
                <ScrollText />
              </div>
              <div className="activityList">
                {logs.map((l: any) => (
                  <div key={l.id}>
                    <span className="activityDot" />
                    <div>
                      <strong>
                        {String(l.action || "Update")
                          .replaceAll("_", " ")
                          .toLowerCase()}
                      </strong>
                      <span>{l.targetEmail || l.target || l.details}</span>
                      <small>
                        {l.performedByEmail || l.performedByUid} ·{" "}
                        {l.createdAt?.toDate?.()?.toLocaleString("en-IN") ||
                          "Just now"}
                      </small>
                    </div>
                  </div>
                ))}
                {!logs.length && (
                  <p className="muted">No activity recorded yet.</p>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
