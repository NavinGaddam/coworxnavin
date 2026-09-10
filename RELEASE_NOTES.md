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

- Staff now keep the six daily work areas in front of them on tablets and laptops: Overview, Front Desk, Bookings, Customers, Passes and Collections. New booking and QR scan remain one tap away, and phone/tablet controls use larger labels and touch targets.
- Front Desk, All bookings and Enquiries are now primary staff navigation items. Advanced configuration remains in the side rail, keeping daily tablet work one tap away without mixing Company & GST into communications tools.
- Every regular reservation is a full-advance booking. Staff-created bookings open a payment step before confirmation, support split cash/UPI/other tender, require a verified UPI reference and create an immutable receipt. Incorrect entries are reversed with an audit reason instead of being overwritten.
- Walk-in payment is now captured inline before the final booking action. A failed receipt write leaves a clearly identified 15-minute hold that can be safely completed from Collections instead of losing the reservation or creating a duplicate.
- Desk passes are limited to 10, 20 or 30 consecutive **working** days and skip Sundays and declared holidays. Their included reschedule allowances are 1, 2 and 3 days. Only an administrator can grant extra festival/closure exceptions, with a reason recorded in pass history.
- Passes may be activated with the configured partial advance and then paid in instalments. An overdue balance blocks entry. Regular bookings, QR entry and normal desk use stay unavailable until the required payment has been recorded.
- Office hours can use weekly schedules, seasonal date ranges and one-day overrides. Desk sessions and reception status use that date's closing time, so summer and winter changes do not require a code release. Holiday changes update the booking calendar atomically.
- Collections now has a daily cash/UPI/other register, downloadable receipts, payment corrections, refunds and shift cash handover with expected-versus-counted differences. Finance permissions separately control collection, discounts, corrections, refunds and reporting.
- Customer records now combine profile, company/GST/billing details, reminder preferences, booking history, pass history and payment history. Staff can block a customer with a reason; blocked profiles cannot create new reservations.
- Customer profile photos are optional, compressed before saving and editable by the customer or authorised staff. Gender-aware default avatars are used when no photo exists. The supplied CW mark now has dedicated browser, iPhone, Android and maskable PWA icon variants with cache-busting, replacing the old clock icon everywhere.
- Reception distinguishes expected guests, people currently inside, people who left with re-entry available and sessions that have ended. Customers see booking, pass-expiry and balance reminders from the home screen.
- A new customer homepage uses supplied Coworx workspace photographs, a video tour and an optional 360° tour. Member quick actions, upcoming bookings, responsive navigation, light/dark mode and command search are included.
- Staff workspace separates daily overview, bookings, front desk, customer records, maintenance, holidays, rates, catalog, notices, communications, revenue and refunds.
- Administration owns Company & GST, payment details, Wi-Fi, policy, shifts, staff assignments, permission settings and activity logs.
- Walk-in creation validates and saves the complete profile before selecting its database identity. Existing customers are searchable by name, email and phone. Duplicate saves reuse the existing record. Failed saves keep the draft.
- Date-of-birth and booking date controls use the same responsive calendar with month/year selection. The desktop range calendar now opens inside the booking panel instead of clipping outside the viewport.
- Public coupons appear in customer Offers and in a selectable booking dropdown; staff-only coupons stay private. Limits are enforced per customer transactionally, including simultaneous payment attempts, and both coupons and offer cards can be shown, hidden, paused or activated.
- Booking records display their creation timestamp and channel and sort newest-created first. Staff views separate Today, Upcoming, Past, Needs payment, All and Cancelled, with an optional date range.
- Booking extras now match the actual operation: one complimentary coffee or tea, plus printing at ₹5 per page. Projector, whiteboard and locker choices have been removed.
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

The emulator test command requires **Java 21 or later**. It uses the isolated `demo-coworx` project and does not modify production data. It covers role escalation, per-capability denials, public notices, company/GST persistence, staff invitations, walk-in creation, full and split advance payments, immutable corrections and refunds, daily handover, consecutive passes, reschedule exceptions, daily QR attendance, expired holds, quarter-hour room collisions, multi-day locks and extensions.

The physical camera and native install dialog depend on the device/browser. Camera scanning requires HTTPS or localhost. Safari on iPhone uses Share → Add to Home Screen. Staff still verify received cash/UPI before saving a payment; this update does not automatically verify bank transfers.
