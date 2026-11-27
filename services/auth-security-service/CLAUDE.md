# auth-security-service

## Purpose
Everything about proving who someone is: phone OTP, transaction PIN, secure single-use links, vendor/staff session checks and roles, re-verification. Read docs/ALGORITHMS.md §7–9 and §15 and docs/SECURITY.md first.

## Owns (schema `auth`)
- `otp_challenges` (id, phone_e164, code_hash, purpose, expires_at, attempts, consumed_at)
- `pins` (user_id PK, pin_hash, set_at, failed_attempts, locked_at, reset_required_at, reset_at, spend_hold_until, spend_hold_kind cap|blocked)
- `secure_links` (id, token_hash UNIQUE, user_id, purpose, ref_type, ref_id, amount_cents, summary_hash, expires_at, used_at)
- `pin_approvals` (id, link_id, user_id, ref_type, ref_id, amount_cents, summary_hash, expires_at, redeemed_at, redeem_key)
- `action_codes` (id, phone_e164, action, ref_type, ref_id, code_hash, expires_at, used_at)
- `staff_roles` (auth_user_id, role owner|support|finance|ops), `vendor_staff_index` (auth_user_id → vendor_id, role) synced from vendor-service events
- `security_events` (id, user_id, kind, detail, at)

## Key logic
- OTP: 6 digits, hashed, 5 min, 5 attempts, send-rate limits; delivered via `message.send`.
- PIN: weak-PIN rejection, peppered argon2id, constant-time verify, 5-attempt lock, reset via OTP. Pepper in Secrets Store. RESET_REQUIRED after an exposure in chat (§7): `verifyPin` refuses with `PIN_RESET_REQUIRED`, open `pin_approve` links are voided, and the new PIN must differ from the old one.
- Secure links: 256-bit token, store sha256 only, purpose-bound, TTLs, single use, Turnstile on POST.
- `verifyPin(token, pin)` for pin_approve → record a one-time approval and emit `pin.verified` with bound refType/refId/amount/summaryHash and the `approvalId` (docs/ALGORITHMS.md §8). `redeemApproval`, on its own entrypoint bound only by wallet-payments-service, answers yes once, before expiry, and only when every bound field matches; a retry with the same idempotencyKey gets the same answer.
- `checkSecretExposure({sender, candidates})` (docs/ALGORITHMS.md §15) lives on its own named entrypoint, which only messaging-gateway binds (enforced by the binding allow-list in `infra/`), and is never routable from api-gateway. `sender` is exactly one of an E.164 number or a WhatsApp BSUID. Find the user through user-service (`getByPhone` / `getByBsuid`), then answer per candidate `pin`, `otp`, `none` or `unavailable` exactly as §15 defines, including the cases where no comparison is made and the limit of 5 non-matching comparisons per user per 24 h. A lookup failure or internal error is `unavailable`, never `none`. On `pin`, set RESET_REQUIRED straight away (do not wait for the event). On `otp`, cancel that code. Write each non-matching comparison to `security_events` without the digits. It never counts as a PIN attempt and never approves or unlocks anything.
- After a PIN reset (docs/ALGORITHMS.md §7): a 24-hour cap on wallet approvals ($50 in total by default), reported by `getSpendAllowance(userId)` and enforced in `createSecureLink` for `pin_approve` (`PIN_RESET_HOLD`). Before a reset, a SIM-change lookup through messaging-gateway (`lookupNumber`); a reported change blocks approvals completely for 72 hours by default and flags the account for staff review.
- Action codes for the few SMS commands that need one (docs/ALGORITHMS.md §14: READY for a delivery order, PAUSE, a cancellation that costs the customer money, and any command during the step-up hour): `issueActionCode({phoneE164, action, refType?, refId?})` returns a 3-character code once and stores only its hash; `verifyActionCode({phoneE164, code})` returns the bound action and ref, single use, and counts wrong tries (5 in an hour → coded commands by SMS off for that number for an hour + alert). notification-service and agent-orchestrator issue codes; only agent-orchestrator verifies them.
- Vendor/staff: validate Supabase JWTs, require 2FA (AAL2), resolve roles.
- Re-verification triggers (90-day inactivity, secret exposure, risk signals) → `auth.reverify_required`.

## Events
Publishes: auth.phone_verified, pin.set, pin.reset, pin.verified, pin.failed, pin.locked, auth.reverify_required.
Consumes: security.secret_exposed, vendor staff changes, user.closed.

## Must never
- Log or return PINs, OTPs, tokens or hashes. Accept a PIN from anywhere but the secure page route (`checkSecretExposure` is a leak check, not a way to submit a PIN: its only effects are a forced reset or a cancelled code). Log, store or queue the digits passed to `checkSecretExposure`. Allow a link to be used twice or for another purpose/amount.

## Tests
Weak PIN list, hashing + pepper, lockout and unlock, timing-safe compare, link expiry/replay/tamper/wrong purpose, Turnstile failure, OTP limits, JWT without 2FA rejected, role matrix, exposure check (digits match the PIN, match a live OTP, match nothing, sender has no PIN; every `unavailable` case: limit reached, PIN locked, reset required, open setup or reset link, unlinked BSUID, user lookup failure; never counts toward the lockout; digits absent from logs, errors and traces; only the exposure entrypoint exposes it), RESET_REQUIRED (blocks `verifyPin`, voids open approve links, rejects reuse of the old PIN), approvals (redeemed once, expired, wrong amount, ref or user, retry with the same key, reachable only from the wallet entrypoint), post-reset cap (under, at and over the cap, ends after 24 hours, the first PIN is not a reset), SIM-change block, action codes (right code, wrong code, reuse, wrong phone, lock after 5 wrong, expiry).

## Fakes in use
- user-service `getByPhone` / `getByBsuid` (for `checkSecretExposure`) until docs/BUILD_PLAN.md step 7.
