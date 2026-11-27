# user-service

## Purpose
Customer accounts: identity by phone number, profile, addresses, consent, onboarding progress, preferences and privacy requests.

## Owns (schema `users`)
- `users` (id, phone_e164 UNIQUE, first_name, language en|fr, status pending|active|suspended|closed, verified_at, last_active_at, created_at)
- `addresses` (id, user_id, label, line1, line2, city, province, postal_code, country, geom geography(Point), provider_place_id, delivery_notes, is_default)
- `consents` (id, user_id, kind terms|privacy|marketing_casl, version, granted, method chat|web, source, at)
- `onboarding_progress` (user_id, step, data jsonb, reminder_sent_at, updated_at)
- `preferences` (user_id, fulfilment_default delivery|pickup, quiet_hours)
- `whatsapp_identities` (bsuid UNIQUE, user_id, linked_at) — WhatsApp users who hide their number; linked only after phone OTP
- `privacy_requests` (id, user_id, kind access|correct|delete|portability, status, due_at)

## Key logic
- `createPending` on first contact; `user.registered`.
- `addAddress`: geocode [CONFIRM provider], confirm with user via agent, check served area against admin-service launch regions (cached) → `NOT_SERVED` + waitlist.
- Becomes VERIFIED when it has: `auth.phone_verified` + terms & privacy consent recorded + `pin.set` → emit `user.verified`.
- `closeAccount`: requires zero wallet balance or refund started (ask wallet), then anonymise PII, keep financial records per retention rules.
- `exportData` for access/portability (Law 25).
- `getByBsuid`; unknown BSUID → onboarding asks the user to verify a phone number on the setup page, then links the BSUID.

## Events
Publishes: user.registered, user.updated, user.verified, user.closed, consent.changed.
Consumes: auth.phone_verified, pin.set, messaging.opted_out/in, auth.reverify_required.

## Must never
- Store PINs or payment data. Share phone numbers with vendors.

## Tests
Onboarding state transitions, verified-condition logic, geocode + served-area (inside, outside, edge), consent versioning, close/anonymise, export completeness, RLS/role isolation.
