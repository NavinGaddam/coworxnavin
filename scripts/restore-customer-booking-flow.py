from pathlib import Path
import subprocess

# Start from the last known-good booking page before the inline required-details panel.
base = subprocess.check_output([
    "git", "show", "4ad88b6d2b293826370680f4f5004cca06f10fdb^:src/pages/Booking.tsx"
], text=True)
s = base

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
helper = anchor + '''const validDobValue = (value: unknown) => {
  const dob = String(value || "").trim();
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dob) || dob < "1900-01-01" || dob > localToday()) return false;
  const parsed = new Date(`${dob}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dob;
};
'''
if anchor not in s:
    raise SystemExit("freeHours anchor not found")
s = s.replace(anchor, helper, 1)

old = '''    const savedMobile = String(
      p.myProfile?.mobile || p.phoneNumber || profile.mobile || "",
    ).trim();
    const savedProfession = String(
      p.myProfile?.profession || profile.profession || "",
    ).trim();
    if (p.staffBooking) {
'''
new = '''    if (p.staffBooking) {
'''
if old not in s:
    raise SystemExit("saved-profile declarations not found")
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
new = '''    // Always collect/confirm every required customer detail before the final WhatsApp action.
    // This keeps workspace selection available while preventing incomplete customer bookings.
    setProfile((x) => ({
      ...x,
      mobile: p.myProfile?.mobile || p.phoneNumber || x.mobile || "",
      gender: p.myProfile?.gender || x.gender || "",
      dob: p.myProfile?.dob || x.dob || "",
      profession: p.myProfile?.profession || x.profession || "",
    }));
    setModal(true);
'''
if old not in s:
    raise SystemExit("old customer bypass block not found")
s = s.replace(old, new, 1)

s = s.replace(
    '    const phone = String(useProfile.mobile || "").trim();',
    '    const phone = normalizePhone(useProfile.mobile || "");',
    1,
)

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
    raise SystemExit("submit validation block not found")
s = s.replace(old, new, 1)

# Use WhatsApp's explicit send endpoint for better mobile/desktop behavior.
s = s.replace(
    'const url = `https://wa.me/919970836509?text=${encodeURIComponent(text)}`;',
    'const url = `https://api.whatsapp.com/send?phone=919970836509&text=${encodeURIComponent(text)}`;',
    1,
)
s = s.replace(
    'if (typeof window !== "undefined") window.location.assign(url);',
    'if (typeof window !== "undefined") window.location.href = url;',
    1,
)

# The summary button opens the required-details dialog; the final dialog button performs WhatsApp request.
s = s.replace(
    '<MessageCircle /> Request on WhatsApp',
    '<UserPlus /> Continue to customer details',
    1,
)

# Make all final-check fields visibly required.
s = s.replace('<span>Gender</span>', '<span>Gender <em>*</em></span>', 1)
s = s.replace('label="Date of birth"', 'label="Date of birth *"', 1)
s = s.replace('<span>Profession</span>', '<span>Profession <em>*</em></span>', 1)

old = '''}: any) {
  const professions = [
    "IT Professional",
'''
new = '''}: any) {
  const professions = [
    "IT Professional",
'''
# Keep location anchor, then inject readiness after profession list below.
if old not in s:
    raise SystemExit("ProfileModal anchor not found")

list_end = '''    "Business",
    "Other",
  ];
  return (
'''
ready = '''    "Business",
    "Other",
  ];
  const professionValue = profile.profession === "Other"
    ? String(profile.otherProfession || "").trim()
    : String(profile.profession || "").trim();
  const detailsReady = Boolean(
    validPhone(profile.mobile) &&
    String(profile.gender || "").trim() &&
    validDobValue(profile.dob) &&
    professionValue
  );
  return (
'''
if list_end not in s:
    raise SystemExit("ProfileModal profession list end not found")
s = s.replace(list_end, ready, 1)

s = s.replace(
    '''              Google name is used automatically. Add your contact and
              professional details before submitting.''',
    '''              Google name and email are used automatically. Complete every
              required detail below before requesting on WhatsApp.''',
    1,
)

old = '''          <button
            className="primary modernContinue"
            disabled={busy}
            onClick={onContinue}
          >
            {busy ? "Creating booking…" : "Continue to WhatsApp"}{" "}
            <MessageCircle size={17} />
          </button>
'''
new = '''          <button
            className="primary modernContinue"
            disabled={busy || !detailsReady}
            onClick={onContinue}
          >
            {busy ? "Creating booking…" : detailsReady ? "Request on WhatsApp" : "Complete all required details"}{" "}
            <MessageCircle size={17} />
          </button>
'''
if old not in s:
    raise SystemExit("ProfileModal final button not found")
s = s.replace(old, new, 1)

Path("src/pages/Booking.tsx").write_text(s)
