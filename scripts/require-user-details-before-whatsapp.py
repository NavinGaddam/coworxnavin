from pathlib import Path

p = Path('src/pages/Booking.tsx')
s = p.read_text()

s = s.replace(
'import { validEmail, validPhone } from "../lib/customer";',
'import { normalizePhone, validEmail, validPhone } from "../lib/customer";',
1,
)

anchor = '''const freeHours = (locks: any[], space: string, start: string, closing = BUSINESS_END) => {
  let n = 0;
  for (let i = 0; i < 10; i++) {
    const t = addHours(start, i);
    if (minutes(t)+60 > minutes(closing) || busy(locks, space, t)) break;
    n++;
  }
  return n;
};
'''
insert = anchor + '''const validDobValue = (value: unknown) => {
  const dob = String(value || "").trim();
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dob) || dob < "1900-01-01" || dob > localToday()) return false;
  const parsed = new Date(`${dob}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dob;
};
'''
if anchor not in s:
    raise SystemExit('freeHours anchor not found')
s = s.replace(anchor, insert, 1)

old = '''  const valid = isDesk
    ? selected.length > 0
    : !startBusy && roomAvailable > 0 && duration <= roomAvailable;
  const openModal = () => {
'''
new = '''  const valid = isDesk
    ? selected.length > 0
    : !startBusy && roomAvailable > 0 && duration <= roomAvailable;
  const profileProfession = profile.profession === "Other"
    ? String(profile.otherProfession || "").trim()
    : String(profile.profession || "").trim();
  const userDetailsReady = p.staffBooking || Boolean(
    validPhone(profile.mobile) &&
    String(profile.gender || "").trim() &&
    validDobValue(profile.dob) &&
    profileProfession
  );
  const openModal = () => {
'''
if old not in s:
    raise SystemExit('valid/openModal anchor not found')
s = s.replace(old, new, 1)

old = '''    if (
      savedMobile.replace(/\\D/g, "").length >= 10 &&
      savedProfession &&
      savedProfession !== "Other"
    ) {
      submit({
        mobile: savedMobile,
        gender: p.myProfile?.gender || profile.gender || "",
        dob: p.myProfile?.dob || profile.dob || "",
        profession: savedProfession,
        otherProfession: "",
      });
      return;
    }
    setProfile((x) => ({ ...x, mobile: p.phoneNumber || x.mobile }));
    setModal(true);
'''
new = '''    if (!userDetailsReady) {
      return setMessage("Complete all customer details before requesting on WhatsApp: mobile, gender, date of birth and profession.");
    }
    void submit();
'''
if old not in s:
    raise SystemExit('saved profile bypass block not found')
s = s.replace(old, new, 1)

old = '''    const phone = String(useProfile.mobile || "").trim();
'''
new = '''    const phone = normalizePhone(useProfile.mobile || "");
'''
if old not in s:
    raise SystemExit('phone normalization line not found')
s = s.replace(old, new, 1)

old = '''    if (!validPhone(phone))
      return setMessage("Please enter a valid mobile number.");
    if (!profession && !p.staffBooking)
      return setMessage("Please enter your profession.");
'''
new = '''    if (!validPhone(phone))
      return setMessage("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.");
    if (!p.staffBooking && !String(useProfile.gender || "").trim())
      return setMessage("Select your gender before requesting on WhatsApp.");
    if (!p.staffBooking && !validDobValue(useProfile.dob))
      return setMessage("Enter a valid date of birth before requesting on WhatsApp.");
    if (!profession && !p.staffBooking)
      return setMessage("Select your profession before requesting on WhatsApp.");
'''
if old not in s:
    raise SystemExit('profile validation block not found')
s = s.replace(old, new, 1)

old = '''          <Extras
            qty={addonQty}
'''
new = '''          {!p.staffBooking && (
            <CustomerDetailsPanel
              user={p.user}
              profile={profile}
              setProfile={setProfile}
              ready={userDetailsReady}
            />
          )}
          <Extras
            qty={addonQty}
'''
if old not in s:
    raise SystemExit('Extras insertion point not found')
s = s.replace(old, new, 1)

old = '''          customerReady={
            !p.staffBooking ||
            Boolean(selectedCustomer?.uid && !selectedCustomer.blocked)
          }
'''
new = '''          customerReady={
            p.staffBooking
              ? Boolean(selectedCustomer?.uid && !selectedCustomer.blocked)
              : userDetailsReady
          }
'''
if old not in s:
    raise SystemExit('customerReady block not found')
s = s.replace(old, new, 1)

anchor = '''function Extras({
'''
panel = '''function CustomerDetailsPanel({ user, profile, setProfile, ready }: any) {
  const professions = [
    "IT Professional",
    "Developer",
    "Tester",
    "Marketing Team",
    "Student",
    "Designer",
    "Consultant",
    "Business",
    "Other",
  ];
  return (
    <section className="bookingExtras panel customerDetailsPanel">
      <div className="extrasHead">
        <div>
          <span className="eyebrow">CUSTOMER DETAILS · REQUIRED</span>
          <h3>Complete your details before WhatsApp</h3>
          <small>All fields below are compulsory. Request on WhatsApp is enabled only after they are valid.</small>
        </div>
        {ready ? <CheckCircle2 /> : <UserPlus />}
      </div>
      <div className="fieldGrid">
        <label>Name<input value={user?.displayName || ""} readOnly /></label>
        <label>Email<input value={user?.email || ""} readOnly /></label>
        <label>
          Mobile number *
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={10}
            placeholder="9876543210"
            value={normalizePhone(profile.mobile || "")}
            onChange={(e) => setProfile({ ...profile, mobile: e.target.value.replace(/\\D/g, "").slice(0, 10) })}
          />
          <small>10 digits, starting with 6, 7, 8 or 9.</small>
        </label>
        <label>
          Gender *
          <select value={profile.gender || ""} onChange={(e) => setProfile({ ...profile, gender: e.target.value })}>
            <option value="">Select gender</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
            <option>Prefer not to say</option>
          </select>
        </label>
        <div className="customerDateField">
          <DatePicker
            label="Date of birth *"
            value={profile.dob || ""}
            min="1900-01-01"
            max={localToday()}
            placeholder="Choose date of birth"
            onChange={(dob) => setProfile({ ...profile, dob })}
          />
        </div>
        <label>
          Profession *
          <select value={profile.profession || ""} onChange={(e) => setProfile({ ...profile, profession: e.target.value, otherProfession: e.target.value === "Other" ? profile.otherProfession : "" })}>
            <option value="">Select profession</option>
            {professions.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        {profile.profession === "Other" && (
          <label className="full">
            Profession details *
            <input value={profile.otherProfession || ""} onChange={(e) => setProfile({ ...profile, otherProfession: e.target.value })} placeholder="e.g. Architect, HR, Photographer" />
          </label>
        )}
      </div>
      <p className={ready ? "goodText" : "noticeBox"}>
        {ready ? "All required customer details are complete. You can now request on WhatsApp." : "Complete every required field to enable Request on WhatsApp."}
      </p>
    </section>
  );
}
'''
if anchor not in s:
    raise SystemExit('Extras function anchor not found')
s = s.replace(anchor, panel + anchor, 1)

old = '''      <div className="securityNote">
        <Lock />
        <span>
          {staffBooking
            ? "Save the customer, then collect payment before confirming the booking."
            : "Online requests reserve the selected resource for 15 minutes while payment is completed."}
        </span>
      </div>
'''
new = '''      <div className="securityNote">
        <Lock />
        <span>
          {staffBooking
            ? "Save the customer, then collect payment before confirming the booking."
            : customerReady
              ? "Customer details verified. Online requests reserve the selected resource for 15 minutes while payment is completed."
              : "Complete all required customer details before requesting on WhatsApp."}
        </span>
      </div>
'''
if old not in s:
    raise SystemExit('securityNote block not found')
s = s.replace(old, new, 1)

old = '''        ) : (
          <>
            <MessageCircle /> Request on WhatsApp
          </>
        )}
'''
new = '''        ) : !customerReady ? (
          <>
            <UserPlus /> Complete customer details first
          </>
        ) : (
          <>
            <MessageCircle /> Request on WhatsApp
          </>
        )}
'''
if old not in s:
    raise SystemExit('summary CTA label block not found')
s = s.replace(old, new, 1)

p.write_text(s)
