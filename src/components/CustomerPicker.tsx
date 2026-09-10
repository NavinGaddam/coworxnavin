import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Search, UserPlus, X } from "lucide-react";
import { createCustomerProfile } from "../lib/firestore";
import {
  customerMatches,
  emptyCustomer,
  validEmail,
  validateCustomer,
} from "../lib/customer";
import { localToday } from "../pages/types";
import { DatePicker } from "../pages/DatePicker";
import UserAvatar from "./UserAvatar";

const PROFESSIONS = [
  "Student",
  "Business Owner",
  "Entrepreneur",
  "Freelancer",
  "Developer / IT",
  "Designer / Creative",
  "Marketing / Sales",
  "Finance / Accounting",
  "Consultant",
  "Lawyer",
  "Doctor / Healthcare",
  "Engineer",
  "Teacher / Education",
  "Government Employee",
  "Other",
];

export default function CustomerPicker({
  users = [],
  selected,
  onSelect,
  user,
  canCreate = true,
  disabled = false,
}: any) {
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<any>(() => ({ ...emptyCustomer(), otherProfession: "" })),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const saveLock = useRef(false);
  const results = useMemo(
    () => users.filter((u: any) => customerMatches(u, query)).slice(0, 7),
    [users, query],
  );
  const choose = (customer: any) => {
    onSelect({ ...customer, uid: customer.uid || customer.id });
    setQuery("");
    setOpen(false);
    setAdding(false);
    setError("");
  };
  const start = () => {
    setDraft({
      ...emptyCustomer(),
      otherProfession: "",
      email: validEmail(query) ? query : "",
      name: !query.includes("@") && !/\d/.test(query) ? query : "",
    });
    setAdding(true);
    setOpen(false);
    onSelect(null);
    setError("");
    setNotice("");
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLock.current) return;
    try {
      setError("");
      const prepared = {
        ...draft,
        profession:
          draft.profession === "Other"
            ? String(draft.otherProfession || "").trim()
            : draft.profession,
      };
      const value = validateCustomer(prepared, localToday());
      saveLock.current = true;
      setSaving(true);
      const customer: any = await createCustomerProfile(
        value,
        user.uid,
        user.email,
      );
      choose(customer);
      setNotice(
        customer.alreadyExists
          ? "Existing customer found and selected. No duplicate was created."
          : "Customer saved and selected. Continue with the workspace below.",
      );
    } catch (e: any) {
      setError(e.message || "Customer could not be saved. Please try again.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };
  const field = (key: string, value: string) =>
    setDraft((d: any) => ({ ...d, [key]: value }));
  return (
    <section
      className="customerPicker surface"
      aria-labelledby="customer-heading"
    >
      <div className="sectionHeading">
        <div>
          <span className="eyebrow">01 / CUSTOMER</span>
          <h3 id="customer-heading">Who are you booking for?</h3>
          <p>Choose a customer or save a new profile to continue.</p>
        </div>
        {selected && (
          <span className="statePill good">
            <CheckCircle2 size={14} /> Selected
          </span>
        )}
      </div>
      {selected ? (
        <div className="selectedCustomer">
          <UserAvatar profile={selected} size={52} />
          <div>
            <strong>{selected.name}</strong>
            <span>{selected.email}</span>
            <small>
              {selected.phone} · {selected.profession || "Customer"}
            </small>
          </div>
          <button
            type="button"
            className="ghost small"
            disabled={disabled}
            onClick={() => {
              onSelect(null);
              setNotice("");
              setOpen(true);
            }}
          >
            Change
          </button>
        </div>
      ) : (
        !adding && (
          <div
            className="customerSearch"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
            }}
          >
            <label className="searchInput">
              <Search size={18} />
              <input
                aria-label="Search customers"
                placeholder="Search name, email or mobile"
                value={query}
                onFocus={() => setOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                autoComplete="off"
                disabled={disabled}
              />
            </label>
            {open && (
              <div className="customerResults">
                {results.map((u: any) => (
                  <button
                    type="button"
                    key={u.uid || u.id}
                    onClick={() => choose(u)}
                  >
                    <UserAvatar profile={u} size={38} />
                    <span>
                      <b>{u.name || u.email}</b>
                      <small>
                        {u.email} · {u.phone || "No mobile"}
                      </small>
                    </span>
                  </button>
                ))}
                {!results.length && <p>No matching customer.</p>}
                {canCreate && (
                  <button
                    type="button"
                    className="newCustomerButton"
                    onClick={start}
                  >
                    <UserPlus size={17} /> Add new customer
                  </button>
                )}
              </div>
            )}
            {!open && canCreate && (
              <button type="button" className="textButton" onClick={start}>
                <UserPlus size={16} /> Add new customer
              </button>
            )}
          </div>
        )
      )}
      {adding && (
        <form className="customerCreateForm" onSubmit={save} noValidate>
          <div className="sectionHeading">
            <div>
              <h4>Create customer profile</h4>
              <p>Save once. Use this profile for future bookings.</p>
            </div>
            <button
              type="button"
              className="iconButton"
              aria-label="Cancel new customer"
              disabled={saving}
              onClick={() => setAdding(false)}
            >
              <X size={18} />
            </button>
          </div>
          <fieldset disabled={saving}>
            <div className="fieldGrid">
              <label>
                Full name *
                <input
                  name="name"
                  value={draft.name}
                  onChange={(e) => field("name", e.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                Email *
                <input
                  name="email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => field("email", e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Mobile *
                <input
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={draft.phone}
                  onChange={(e) => field("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  autoComplete="tel"
                  placeholder="10 digits · starts with 6/7/8/9"
                  required
                />
              </label>
              <div className="customerDateField">
                <DatePicker
                  label="Date of birth *"
                  value={draft.dob}
                  max={localToday()}
                  min="1900-01-01"
                  placeholder="Choose date of birth"
                  onChange={(value) => field("dob", value)}
                />
                <small>Age is calculated from the date of birth.</small>
              </div>
              <label>
                Profession *
                <select
                  name="profession"
                  value={draft.profession}
                  onChange={(e) => field("profession", e.target.value)}
                  required
                >
                  <option value="">Choose profession</option>
                  {PROFESSIONS.map((profession) => (
                    <option value={profession} key={profession}>{profession}</option>
                  ))}
                </select>
              </label>
              {draft.profession === "Other" && (
                <label>
                  Profession details *
                  <input
                    value={draft.otherProfession || ""}
                    onChange={(e) => field("otherProfession", e.target.value)}
                    placeholder="Enter profession"
                    required
                  />
                </label>
              )}
              <label>
                Gender
                <select
                  name="gender"
                  value={draft.gender}
                  onChange={(e) => field("gender", e.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
              </label>
            </div>
          </fieldset>
          {error && (
            <p className="inlineError" role="alert">
              {error}
            </p>
          )}
          <div className="formActions">
            <small>Your workspace selection is kept while saving.</small>
            <button
              className="primary"
              type="submit"
              disabled={saving || disabled}
            >
              {saving ? "Saving customer…" : "Save customer & continue"}
              <UserPlus size={17} />
            </button>
          </div>
        </form>
      )}
      {notice && (
        <p className="inlineSuccess" role="status">
          <CheckCircle2 size={16} />
          {notice}
        </p>
      )}
      {selected?.blocked && (
        <p className="inlineError" role="alert">
          This customer is blocked from new bookings.
        </p>
      )}
    </section>
  );
}
