# Hey Dovo — Algorithms and business logic

Implement each section in the service named. Values in `config` come from admin-service settings (cached in KV); the numbers shown are defaults.

## 1. Vendor matching and ranking (catalogue-quotes-service, using vendor-service)
### Step 1 — Filter (all must pass)
- Vendor `status = approved` and all required documents valid (trades: licence + insurance not expired).
- Serves the user's point: `ST_DWithin(location.geom, userPoint, delivery_radius_m)` for delivery, or `ST_Covers(service_area, userPoint)` for trades. For pickup, any vendor within `config.pickupMaxKm` (default 25 km).
- Offers the requested fulfilment (delivery / pickup / both; trades: on-site).
- Open now, or has a free slot at the requested time (respect vendor timezone, hours, closures, pause switch).
- Has the requested items in stock, or offers the requested service category.

### Step 2 — Shortlist (keep it cheap)
1. Order by straight-line distance; keep top 20.
2. Fetch real travel time (maps API [CONFIRM provider: Google Routes or Mapbox]) for the top 10.
3. Fetch courier quotes (delivery-service) only for the top 3–5 delivery candidates.

### Step 3 — Score
Normalise each signal to 0..1 across the shortlist (best = 1). Score = Σ weight × signal.

| Signal | Meaning | Default weight (goods) | Emergency trades |
|--------|---------|------------------------|------------------|
| proximity | inverse travel time (pickup: from user; delivery: vendor→user) | 0.40 | 0.15 |
| eta | delivery ETA or trade arrival time | 0.15 | 0.50 |
| price | total the user pays (items + delivery, or call-out fee) | 0.15 | 0.05 |
| rating | Bayesian rating: (C·m + Σratings) / (C + n), C = 10, m = platform mean | 0.15 | 0.15 |
| reliability | 0.5·accept_rate + 0.5·on_time_rate (last 90 days) | 0.10 | 0.15 |
| familiarity | user ordered before and rated ≥ 4 | 0.05 | 0.00 |

- Non-emergency trades use the goods weights.
- Weights are versioned per category in `ranking_weights` and edited in the admin portal.
- Featured vendors (later): may be boosted only when labelled "Featured" in the message, and never above a closer option whose score is within 0.05.
- Ties: shorter travel time wins, then higher rating.

### Step 4 — Present
Top 2–3 with distance, price, ETA, rating, nearest first. User may reply MORE, "cheapest", "fastest", "best rated" (re-sort on that single signal). A named vendor is used directly if it passes the filter. If nothing passes: say so, offer the nearest option outside the filter with its longer ETA/fee, or a waitlist alert.

## 2. Product search (catalogue-quotes-service)
- Hybrid search: Postgres full-text (english + french configs) and pgvector cosine similarity on OpenAI embeddings; merge with Reciprocal Rank Fusion (k = 60).
- Synonym table for specialty terms (for example garri/gari, egusi, ogbono, plantain, fufu, yam flour/elubo, suya spice, stockfish), expanded before full-text search.
- Embeddings regenerate on product create/update via a Queue job; search falls back to full-text if embeddings are missing.

## 3. Pricing and fees (order-booking-service computes; wallet-payments-service books)
All integer cents. Round half up at each line, never on totals only.
```
itemsSubtotal   = Σ (unitPriceCents × qty)            // live prices re-checked at draft and at confirmation
itemsTax        = per province and item tax category   // [CONFIRM with accountant: GST/HST/PST/QST and marketplace-facilitator rules]
deliveryFee     = courier fee quoted in the summary (0 for pickup and trades)
serviceFee      = config.serviceFeeCents (250)
feesTax         = tax on serviceFee and deliveryFee, per province   // [CONFIRM with accountant: whether each fee is taxable and at what rate]
tax             = itemsTax + feesTax
total           = itemsSubtotal + tax + deliveryFee + serviceFee
commission      = round(itemsSubtotal × commissionBps / 10000)   // 500 goods, 800 trades; vendor override allowed
vendorPayable   = itemsSubtotal + vendorCollectedTax − commission − vendorLiableRefunds
platformRevenue = serviceFee + commission              // Stripe fees are a platform expense
```
- Tax rates are never hard-coded: `itemsTax` and `feesTax` come from config per province and tax category. `vendorCollectedTax` is `itemsTax` when the vendor remits it; if the platform must remit item tax (marketplace-facilitator rules [CONFIRM]), it is 0 and `itemsTax` goes to `tax_payable`. `feesTax` always goes to `tax_payable`. Whether GST/HST applies to the commission charged to vendors is also [CONFIRM].
- The delivery fee the user pays is always the fee shown in the summary: never more, never less. If the courier's booked fee is higher, the platform absorbs the difference; if it is lower, the platform keeps it. Both go through `delivery_subsidy_expense` (§6), so the highs and lows net out in one account. Review the net amount monthly in the admin dashboard; if the platform keeps more than it absorbs, lower the quoted fee. [CONFIRM how long an Uber Direct quote stays valid.]
- Trades: call-out fee is held at booking; the final price needs a new summary + YES (+ PIN if more funds are needed). Commission applies to the final job total before tax.

## 4. Summary hash and confirmation (order-booking-service + agent-orchestrator)
- `summaryHash = sha256(canonicalJSON({vendorId, locationId, fulfilment, items[{productId, qty, unitPriceCents}], addressId, deliveryFeeCents, serviceFeeCents, taxCents, totalCents, paymentPlan}))`.
- The draft stores `summaryHash` and `summaryShownAt` when the agent sends the summary.
- `requestConfirmation(draftId, summaryHash)` succeeds only if: hash matches the current draft, shown < 30 min ago, prices/stock re-check unchanged. Otherwise `SUMMARY_CHANGED` → agent sends a new summary.
- Deterministic YES matcher (agent-orchestrator, not the LLM): normalised reply in an allow-list (`yes, y, yep, yeah, yes please, confirm, ok order it, order it, oui, d'accord, confirmer`…). A button reply with id `confirm:<summaryHash>` matching the current summary also counts as YES. Anything else is not consent.

## 5. Order state machines (order-booking-service)
One module owns transitions; any other transition throws `INVALID_TRANSITION`. Every change writes `order_events`.

**Delivery**
DRAFT → SUMMARY_SHOWN → AWAITING_PAYMENT → CONFIRMED → ACCEPTED → PREPARING → READY → COURIER_ASSIGNED → PICKED_UP → DELIVERED → COMPLETED
Side exits: DRAFT/SUMMARY_SHOWN → EXPIRED (30 min); AWAITING_PAYMENT → EXPIRED (link/PIN expiry) or FAILED; CONFIRMED → DECLINED (vendor) or AUTO_CANCELLED (no accept in `config.acceptTimeoutMin`, default 10); any pre-pickup state → CANCELLED; COURIER_ASSIGNED/PICKED_UP → DELIVERY_FAILED.

**Pickup**
DRAFT → SUMMARY_SHOWN → AWAITING_PAYMENT → CONFIRMED → ACCEPTED → PREPARING → READY_FOR_PICKUP → COLLECTED → COMPLETED
Side exits as above, plus READY_FOR_PICKUP → UNCLAIMED after `holdMinutes` (default 120) + one reminder → refund per policy.

**Booking (trades)**
DRAFT → SUMMARY_SHOWN → AWAITING_PAYMENT → BOOKED → ON_THE_WAY → STARTED → FINAL_QUOTE_PENDING → FINAL_APPROVED → DONE → COMPLETED
Side exits: BOOKED → CANCELLED (free if ≥ 24 h before, or before vendor sets off for same-day), CANCELLED_LATE (call-out fee kept), VENDOR_CANCELLED, NO_SHOW (vendor or customer).

**Switching fulfilment** allowed only before ACCEPTED; recalculates the draft and needs a new summary.

## 6. Wallet ledger (wallet-payments-service)
Double-entry. Every transaction's entries sum to zero (enforced by a deferred constraint trigger). Balances are derived from entries, never stored as mutable numbers (a cached balance may be kept but is rebuilt from entries in reconciliation).

**Accounts**: `user_wallet:{userId}`, `user_hold:{holdId}`, `stripe_clearing`, `platform_fee_revenue`, `platform_commission_revenue`, `vendor_payable:{vendorId}`, `delivery_payable:{provider}`, `tax_payable` (tax on platform fees; item tax too if the platform remits [CONFIRM]), `delivery_subsidy_expense`, `refund_expense`, `chargeback_loss`, `stripe_fee_expense`.

**Transactions** (sign: + debit, − credit, shown as from → to):
- Top-up succeeded: stripe_clearing → user_wallet.
- Hold (order confirmed): user_wallet → user_hold.
- Capture (order completed): user_hold → vendor_payable (itemsSubtotal + vendorCollectedTax − commission), platform_commission_revenue (commission), platform_fee_revenue (service fee), delivery_payable (the booked courier fee, up to the delivery fee shown), tax_payable (feesTax, plus itemsTax if the platform remits).
- Delivery subsidy (posted with the capture, when the booked courier fee differs from the fee shown), so that `delivery_payable:{provider}` always equals what the provider will bill. Booked fee higher: delivery_subsidy_expense → delivery_payable for the difference. Booked fee lower: the rest of the fee shown goes user_hold → delivery_subsidy_expense (a credit that offsets the absorbed amounts).
- Release (cancelled before capture): user_hold → user_wallet (amount per refund rules; the rest captured as above).
- Pay-by-link order: stripe_clearing → user_hold, then capture as normal.
- Refund after capture: reverse the captured lines in proportion, or charge vendor_payable if vendor liable; destination = user_wallet (wallet payments) or card via Stripe refund (link payments).
- Payout: vendor_payable → stripe_clearing (Stripe Connect transfer).
- Unique key per (refType, refId, entryKind) so a retry can never post twice.

**Limits** (config): max wallet balance $1,000; max top-up $500/day; first-week order cap $300/day; velocity and fraud checks before holds [CONFIRM values].

**Closing a wallet**: refund the balance to the original top-up charges, newest first, within the processor's refund window [CONFIRM Stripe window]; remainder by other method after identity check.

**Daily reconciliation**: compare Stripe balance transactions with ledger; alert on any mismatch.

**Courier reconciliation**: compare `delivery_payable:{provider}` with each provider's statement or invoice for the period [CONFIRM billing cycle]; alert on any mismatch.

## 7. PIN (auth-security-service)
- 4–6 digits. Reject weak PINs: all same digit, sequences (1234, 4321, 123456), the last 4 digits of the user's phone, and a top-100 common list.
- Store `argon2id(HMAC-SHA256(pepper, pin), salt)`. Pepper from Secrets Store (makes stolen hashes useless without the secret, since 6-digit PINs are otherwise easy to brute-force offline). Tune argon2id parameters to fit Workers CPU/memory limits [CONFIRM by benchmark].
- Verify with constant-time comparison. 5 consecutive failures → LOCKED (wallet spending blocked) → `pin.locked`. Unlock = OTP + set a new PIN.
- RESET_REQUIRED (`pins.reset_required_at`), set when the PIN was exposed in chat (§15): `verifyPin` fails with `PIN_RESET_REQUIRED`, open `pin_approve` links are voided and wallet spending is blocked, exactly as for LOCKED. Cleared only by OTP + a new PIN that differs from the old one.
- After any PIN reset (forgotten PIN, LOCKED or RESET_REQUIRED; not the first PIN at onboarding): for `config.postResetHoldHours` (default 24) wallet approvals are capped at `config.postResetCapCents` in total (default 5000 = $50). order-booking asks `auth.getSpendAllowance(userId)` when it builds a draft's payment plan, so the summary already shows the split; `createSecureLink` for `pin_approve` enforces the same limit and fails with `PIN_RESET_HOLD` above it. Anything over the cap is paid by payment link (split payment); pay-by-link is never affected. `pin.reset` triggers an alert by text (`pin.reset_alert`), and by email if one is on file, saying the PIN was changed and how to report it.
- Before a reset, look up the number for a recent SIM change or port (Telnyx Number Lookup, through messaging-gateway, which owns the Telnyx integration [CONFIRM availability in Canada]). If the lookup reports one: wallet approvals are blocked completely for `config.simChangeHoldHours` (default 72 [CONFIRM]), a risk signal is raised and staff review the account. If the lookup is unavailable, the standard 24-hour cap applies.
- PIN never travels through chat, logs, analytics, AI or email. Only the secure page posts it, over TLS, directly to auth-security.

## 8. Secure links (auth-security-service)
- Token: 32 random bytes, base64url. Store only `sha256(token)`.
- Bound to: purpose (setup, pin_approve, pin_reset, topup, pay_link, track, privacy), userId, and for approvals refType + refId + amountCents + summaryHash.
- TTL: pin_approve 10 min; setup, pin_reset, topup 30 min; track 7 days (read-only). Single use (except track).
- URL: `https://heydovo.com/l/{token}` (secure-pages). No personal data in the URL.
- `resolveLink` returns only what the page must show (first name, order summary, amount).
- Turnstile check on every POST from these pages.
- On successful PIN for pin_approve → auth-security records a one-time approval (`approvalId`: 128 random bits; bound to userId, refType, refId, amountCents and summaryHash; valid 10 min) and emits `pin.verified` with the bound fields and the `approvalId`. order-booking re-checks summaryHash and amount, then calls `wallet.hold` with the `approvalId`. Before moving anything, wallet calls `auth.redeemApproval(approvalId, {userId, refType, refId, amountCents}, idempotencyKey)`; auth-security says yes only once, only before expiry and only if every bound field matches (a retry with the same idempotencyKey gets the same answer). No valid approval, no hold: a `pin.verified` event on its own can never move wallet money.
- Only auth-security may publish `pin.*` and `auth.*` events, and only wallet-payments-service may publish `payment.*`, `hold.*`, `refund.*` and `payout.*`. Queue producer bindings are on the same CI-checked allow-list as service bindings (infra).

## 9. OTP (auth-security-service)
6 digits, hashed at rest, TTL 5 min, 5 attempts, max 3 sends per 15 min per number, sent via `message.send` to the same number. Never reuse codes.

## 10. Onboarding state machine (user-service + agent-orchestrator)
NEW → LANGUAGE → NAME → ADDRESS (geocode + served-area check; not served → waitlist) → SETUP_LINK_SENT → VERIFIED (phone OTP + terms/privacy accepted + PIN set) → WALLET_OFFERED → ACTIVE.
- A user who opens with a request ("I need a plumber") runs only the missing steps, then continues the request.
- Progress saved; one reminder after 24 h, never more.
- Re-verification required after 90 days inactive, after `security.secret_exposed` of kind pin or card (a typed OTP only cancels that code), or on suspicious signals.

## 11. Delivery provider selection (delivery-service)
Launch uses one courier provider, Uber Direct. The steps are written for any number of enabled providers so a second courier or in-house drivers can be added later without changing the rule; with one provider, steps 1–3 come down to getting the Uber Direct quote (timeout 3 s).
1. Get quotes from all enabled providers for the area in parallel (timeout 3 s each).
2. Drop providers with no coverage or errors.
3. Choose the lowest fee, unless its ETA is more than 15 min later than the fastest; then choose the fastest.
4. Admin flags can force or disable a provider by city.
5. No provider → vendor self-delivery if enabled → otherwise offer pickup.
6. Book at `order.ready` (or scheduled pickup at ready_by when the provider supports scheduling). Re-quote if the quote expired (see fee rule in section 3).

## 12. Refund rules (order-booking-service decides amounts; wallet executes)
**Products**: before vendor accepts → full refund incl. service fee. After accept, before pickup → refund minus costs already incurred (prepared items, courier booked), shown before the user confirms. After pickup → no cancellation. Missing/wrong/damaged/spoiled items reported within 24 h with photo → refund or replace those items. Never arrived → full refund incl. delivery and service fees.
**Trades**: free cancel ≥ 24 h before (or before vendor sets off for same-day/emergency). Late cancel / customer no-show → call-out fee kept by vendor. Vendor cancel/no-show → full refund + rebook help. Work quality issues within 7 days → dispute process.
**Destination**: wallet payments → wallet, instantly. Card/link payments → original card (5–10 business days).
**Liability**: vendor fault → deducted from vendor payable; courier fault → claim with provider; platform goodwill → refund_expense.

## 13. Vendor payouts (wallet-payments-service, Workflow)
Weekly [CONFIRM day]. For each vendor: payable = vendor_payable balance for orders completed > 7 days ago (dispute buffer) − open dispute reserves. Transfer via Stripe Connect; emit `payout.sent` with a statement. Failed transfers retry and alert.

## 14. Vendor text commands (agent-orchestrator, deterministic, no AI)
From a verified vendor staff phone only: `YES` accept · `NO <reason>` decline · `READY` · `PICKED <pickup code>` · `PAUSE` / `RESUME` · `HELP`.

An SMS sender number can be faked, so a command that arrives by SMS counts only with the one-time reply code from our own message to that phone:
- Every message that invites a command carries a 3-character reply code from the pickup-code alphabet (§16), for example "New order D4821 … Reply YES 7K2 to accept or NO 7K2 <reason> to decline", and after acceptance "Reply READY 4F9 when it is ready". The code identifies the order and the step, so no order ref is needed.
- `PAUSE` and `RESUME` are not replies to an alert, so we answer "Reply PAUSE 9CX to confirm" and act only on that reply.
- `PICKED <pickup code>` already needs the customer's pickup code. `HELP` needs no code.
- Codes come from auth-security (`issueActionCode` / `verifyActionCode`): bound to the phone, the action and the order, single use, hashed at rest, valid until the step ends (10 min for PAUSE and RESUME).
- 5 wrong codes from a number within an hour → SMS commands from that number are off for an hour (the portal and WhatsApp still work), and the vendor owner and staff are alerted.
- WhatsApp: button taps and replies count without a code, because the channel verifies the sender. RCS: the same once Telnyx confirms the sender of an inbound RCS message is verified [CONFIRM]; until then RCS follows the SMS rule. A message that fell back to SMS follows the SMS rule.

The same rule protects customer cancellations: after the refund amount is shown, a cancellation by SMS needs `YES <code>` with the code from that message (docs/CONTRACTS.md, `cancel` tool).

## 15. Secret masking (messaging-gateway, with a check by auth-security)
Runs in memory before any inbound text is stored, logged, queued or forwarded. Two goals: a real PIN, OTP or card number never reaches storage, logs or the AI; and an ordinary number (house number, buzzer code, quantity) does not force a PIN reset.

**Order in the gateway**: verify signature → per-number rate limit → dedupe → mask in memory → store the redacted text → ack → publish. The raw webhook body is never written to a Queue, KV, Durable Object storage, logs or error reports. The path up to the ack must fit inside Telnyx's webhook time limit [CONFIRM limit].

**Cards**: 13–19 digit sequences passing the Luhn check → `[REDACTED_CARD]`, emit `security.secret_exposed(kind: card)`.

**PIN and OTP candidates** (digit runs standing on their own, not part of a longer number or of a ref like `D4821`)
- (a) a message that is only 4–6 digits;
- (b) a 4–8 digit run in a message that contains a secret word anywhere: "pin", "nip", "password", "passcode", "mot de passe", "otp", "verification code", "security code", "code de vérification", "code secret";
- (c) a 4–6 digit run in a message that contains the bare word "code" (often a buzzer or door code);
- (d) while the sender has an open `pin_approve`, `setup` or `pin_reset` link: the first 4–6 digit run in any message (catches "yes 4821").

**Check**: one call per message, `auth.checkSecretExposure({ sender, candidates })`, carrying at most 3 candidates, 1 s in total, never retried. auth-security compares each candidate with the sender's own PIN hash and with any unexpired OTP for that sender, and answers per candidate `pin`, `otp`, `none` or `unavailable`.
- `none` means a comparison was made and did not match, or the sender has no PIN and no live OTP at all. Anything that prevents a comparison (limit reached, lookup failure, internal error) is `unavailable`, never `none`.
- The digits exist only in memory for that call. They are never logged, stored, queued or attached to errors or traces.
- The call is not a PIN attempt and can only make things stricter: it never approves or unlocks anything.
- Checked first, before anything else: no comparison is made, and the answer is `unavailable`, when: the PIN is LOCKED or RESET_REQUIRED; the sender has an open `setup` or `pin_reset` link (a PIN is about to be chosen, so anything typed now could become it); the sender is a WhatsApp BSUID not yet linked to a user. A 4th or later candidate in one message is not sent at all and is treated as `unavailable`.
- A 7–8 digit candidate cannot be a PIN or OTP: it is not sent, and is treated as `none`.
- Limit: 5 non-matching comparisons per user per rolling 24 h, counted across all of that user's sender ids (config). Each is written to `security_events` (a count, never the digits). At the limit the answer is `unavailable` and a risk signal is raised. Calls for a sender with no PIN and no live OTP do not count.

| Result | Stored and forwarded text | What happens next |
|--------|---------------------------|-------------------|
| `pin` | digits → `[REDACTED]` | auth-security sets RESET_REQUIRED (§7); emit `security.secret_exposed(kind: pin)`; agent sends `secret.exposed_warning` |
| `otp` | digits → `[REDACTED]` | auth-security cancels that code; emit `security.secret_exposed(kind: otp)`; agent sends `secret.otp_in_chat` (codes go only on the secure page; offers a new one). No re-verification |
| `none`, candidate (a), (c) or (d) | unchanged | nothing: it is an ordinary number |
| `none`, candidate (b) | digits → `[REDACTED]` | no reset; agent sends `secret.reminder` (never send PINs or passwords in chat) |
| `unavailable`, candidate (a), (c) or (d) | digits → `[REDACTED]` | no reset; agent sends `secret.number_hidden` and asks for the number again with a word, for example "unit 1250" (while a setup or PIN-reset link is open, `secret.reminder` instead: PINs are chosen only on the secure page) |
| `unavailable`, candidate (b) | digits → `[REDACTED]` | no reset; agent sends `secret.reminder` |
| the call itself failed or timed out, candidate (a), (c) or (d) | digits → `[REDACTED]` | no reset; `secret.number_hidden` |
| the call itself failed or timed out, candidate (b) | digits → `[REDACTED]` | fail safe: treated as `pin` (event + RESET_REQUIRED). Reaching the limit never causes a reset; only a failed call does |

- The gateway lists what it hid in `message.received.redactions` and stores the same list (kinds only: `pin`, `otp`, `card`, `other_secret`, `unchecked_number`), so the agent can pick the template without ever seeing the digits. Templates: `pin` and `card` → `secret.exposed_warning`; `otp` → `secret.otp_in_chat`; `other_secret` → `secret.reminder`; `unchecked_number` → `secret.number_hidden`.
- Normal use rarely needs an all-digit message anyway: customer-facing order refs carry a letter prefix (for example `D4821` delivery, `P4821` pickup, `B4821` booking) and pickup codes are 6-character letter+digit mixes without lookalikes (no 0/O, 1/I), for example `K7P2QX`.

## 16. Identifiers shown to people
- Order refs: prefix + 4–6 digits, unique per active period, mapped to the UUID internally.
- Pickup codes: 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, hashed at rest, single use, expire with the order. The code is sent only in the chat message when the order is ready (order-booking passes it once, in `order.ready`), is never shown on the tracking page, and is masked in the stored copy of that message.
