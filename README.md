# Coworx Central PWA

## Quick start
1. Install Node.js 20+
2. Run `npm install`
3. Add Firebase configuration in `src/firebase.ts`
4. Run `npm run dev`

## Firestore collections
- users/{uid}: uid, name, email, role, activePass
- inventory/{id}: type, location, tier
- settings/pricing: cubicle_basic, cubicle_premium, conference_slot, podcast_hourly
- bookings/{id}: date, userId, inventoryId, status, paymentRef, createdAt
- temporaryLocks/{id}: inventoryId, date, expiresAt

## Recommended production security
Use Firestore Security Rules and Cloud Functions for:
- Role validation
- Atomic availability checks
- 15-minute lock expiry
- Preventing double bookings
- Admin-only pricing writes
- Manager confirmation permissions

## WhatsApp
Destination configured in the UI: +91 99708 36509

## Podcast Studio
All microphones, mic stands, camera, camera stands/tripods, lighting and required podcast equipment are included at no extra cost.
