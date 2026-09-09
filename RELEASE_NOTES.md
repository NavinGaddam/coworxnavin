# Coworx Central platform update

## Required Firebase release step

The app and database rules must be released together. Updating GitHub/Vercel alone does **not** publish Firestore rules. Until the new rules are published, the receptionist role and permission switches will not work correctly.

1. Open Firebase Console → **coworxnavin** → Firestore Database → Rules.
2. Replace the rules with the complete contents of `firestore.rules` in this commit.
3. Click **Publish**. Existing documents remain in place.

Alternatively, from an authenticated project administrator's terminal:

```sh
npm ci
npx firebase login
npx firebase deploy --only firestore:rules --project coworxnavin
```

No Firestore data migration or new paid backend service is required. Owner accounts keep recovery access. Existing Manager assignments continue to work; new assignments use collision-safe document IDs. Existing confirmed bookings receive a QR pass when opened. Customers who later sign in with a walk-in email can see the bookings saved under that email.

## What changed

- A new customer homepage uses supplied Coworx workspace photographs, a video tour and an optional 360° tour. Member quick actions, upcoming bookings, responsive navigation, light/dark mode and command search are included.
- Staff workspace separates daily overview, bookings, front desk, customer records, maintenance, holidays, rates, catalog, notices, communications, revenue and refunds.
- Administration owns Company & GST, payment details, Wi-Fi, policy, shifts, staff assignments, permission settings and activity logs.
- Walk-in creation validates and saves the complete profile before selecting its database identity. Existing customers are searchable by name, email and phone. Duplicate saves reuse the existing record. Failed saves keep the draft.
- Receptionists can create customers and booking requests and check customers in/out. Payment confirmation, staff discounts, refunds and business settings are separate capabilities. Rules enforce the saved permissions.
- Confirmed bookings have locally generated QR passes. Reception supports camera scanning, uploading a QR image, pasting a pass and searching the guest list. Attendance is transactional, recorded per day and rejects repeat or invalid actions.
- Confirmation and cancellation update the booking and its locks atomically. Expired holds cannot reclaim reused slots; cancelling an old request cannot release a newer booking. Multi-day lock identities and hourly lock times are corrected.
- Extensions create a separate payable request and preserve the original reservation. Confirmation no longer marks a booking paid unless payment has been recorded. Add-ons and staff discounts are included in payment review.
- Install guidance and an offline application shell are included. Firestore caches previously loaded bookings, passes and Wi-Fi details on the device. Changes require connectivity; no offline payments or attendance actions are silently queued.

## Validation

```sh
npm ci
npm test
npm run build
npm run test:rules
```

The emulator test command requires **Java 21 or later**. It uses the isolated `demo-coworx` project and does not modify production data. It covers role escalation, per-capability denials, public notices, company/GST persistence, staff invitations, walk-in creation, payment totals, daily QR attendance, expired holds, multi-day locks and extensions.

The physical camera and native install dialog depend on the device/browser. Camera scanning requires HTTPS or localhost. Safari on iPhone uses Share → Add to Home Screen. Payment collection remains your staff-managed WhatsApp/UPI process; this update does not automatically verify bank transfers.
