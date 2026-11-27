# auth-security-service

## Purpose
Everything about proving who someone is: phone OTP, transaction PIN, secure single-use links, vendor/staff session checks and roles, re-verification. Read docs/ALGORITHMS.md §7–9 and docs/SECURITY.md first.

## Owns (schema `auth`)
- `otp_challenges` (id, phone_e164, code_hash, purpose, expires_at, attempts, consumed_at)
- `pins` (user_id PK, pin_hash, set_at, failed_attempts, locked_at)
- `secure_links` (id, token_hash UNIQUE, user_id, purpose, ref_type, ref_id, amount_cents, summary_hash, expires_at, used_at)
- `staff_roles` (auth_user_id, role owner|support|finance|ops), `vendor_staff_index` (auth_user_id → vendor_id, role) synced from vendor-service events
- `security_events` (id, user_id, kind, detail, at)

## Key logic
- OTP: 6 digits, hashed, 5 min, 5 attempts, send-rate limits; delivered via `message.send`.
- PIN: weak-PIN rejection, peppered argon2id, constant-time verify, 5-attempt lock, reset via OTP. Pepper in Secrets Store.
- Secure links: 256-bit token, store sha256 only, purpose-bound, TTLs, single use, Turnstile on POST.
- `verifyPin(token, pin)` for pin_approve → emit `pin.verified` with bound refType/refId/amount/summaryHash.
- Vendor/staff: validate Supabase JWTs, require 2FA (AAL2), resolve roles.
- Re-verification triggers (90-day inactivity, secret exposure, risk signals) → `auth.reverify_required`.

## Events
Publishes: auth.phone_verified, pin.set, pin.reset, pin.verified, pin.failed, pin.locked, auth.reverify_required.
Consumes: security.secret_exposed, vendor staff changes, user.closed.

## Must never
- Log or return PINs, OTPs, tokens or hashes. Accept a PIN from anywhere but the secure page route. Allow a link to be used twice or for another purpose/amount.

## Tests
Weak PIN list, hashing + pepper, lockout and unlock, timing-safe compare, link expiry/replay/tamper/wrong purpose, Turnstile failure, OTP limits, JWT without 2FA rejected, role matrix.
