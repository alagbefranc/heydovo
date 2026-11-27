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
- Before a reset, look up the number for a recent SIM change or port (Telnyx Number Lookup, through messaging-gateway, which owns the Telnyx integration [CONFIRM availability in Canada]). If the lookup reports one: wallet approvals are blocked completely for `config.simChangeHoldHours` (default 72 [CONFIRM]), a risk signal is raised and staff review the account. If the lookup is unavailable, the standard 24-hour cap applies. How blocks end and who may lift them: §18.
- The pepper can be rotated: `pins.pepper_version` records which pepper a hash used, and a successful verify with an old version re-hashes with the current one.
- PIN never travels through chat, logs, analytics, AI or email. Only the secure page posts it, over TLS, directly to auth-security.

## 8. Secure links (auth-security-service)
- Token: 32 random bytes, base64url. Store only `sha256(token)`.
- Bound to: purpose (setup, pin_approve, pin_reset, topup, pay_link, track, privacy, not_me, muse_link, clients), userId, and for approvals refType + refId + amountCents + summaryHash.
- TTL: pin_approve 10 min; setup, pin_reset, topup, muse_link, clients 30 min; not_me 72 hours; track 7 days (read-only). Single use (except track).
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
From a verified vendor staff phone only: `YES` accept · `NO <reason>` decline · `READY` · `PICKED <pickup code>` · `PAUSE` / `RESUME` · `HELP`. Text and the dashboard are two views of the same orders: a command by text shows in the dashboard at once, and the other way round.

Keep it low-friction (docs/CONVERSATION.md, guiding principle). On WhatsApp and RCS every alert carries buttons (Accept / Decline, Mark ready, Pause store), and a tap is all it takes. By typed text, most commands are one plain word:
- `YES` and `NO <reason>` are plain. `YES D4821` names the order; if the vendor has exactly one pending order, `YES` / `NO` without a ref applies to it; otherwise ask which.
- `RESUME`, `HELP`, and `READY` for a pickup order are plain too.
- Every command is answered with a short confirmation to the registered phone ("D4821 accepted"), so the real vendor sees at once if someone else sent it.

An SMS sender number can be faked. So by SMS, and only for the commands that cost money or stop the store, a command counts only with the one-time reply code from our own message to that phone:
- `READY` for a delivery order, because it books a courier that the platform pays for. The acceptance confirmation says exactly what to send: "D4821 accepted. When it is ready, reply READY 4F9."
- `PAUSE`, because it stops the store. We answer "Reply PAUSE 9CX to confirm" and act only on that reply.
- `PICKED <pickup code>` already needs the customer's pickup code.
- Codes are 3 characters from the pickup-code alphabet (§16) and come from auth-security (`issueActionCode` / `verifyActionCode`): bound to the phone, the action and the order, single use, hashed at rest, valid until the step ends (10 min for PAUSE).
- 5 wrong codes from a number within an hour → coded commands by SMS from that number are off for an hour (the dashboard, WhatsApp and plain commands still work), and the vendor owner and staff are alerted.
- Unusual plain commands by SMS (for example three declines in a row within 30 minutes, or repeated commands for refs that are not pending) → every command from that number needs a code for the next hour, and the owner and staff are alerted.
- WhatsApp verifies the sender, so taps and typed commands there never need a code. RCS: the same once Telnyx confirms the sender of an inbound RCS message is verified [CONFIRM]; until then the two coded commands on RCS follow the SMS rule. A message that fell back to SMS follows the SMS rule.

Customer cancellations follow the same idea (docs/CONTRACTS.md, `cancel` tool). After the refund amount is shown, the confirm button or a plain YES is enough when the refund is the full amount. Only when cancelling would cost the customer money (the refund is less than they paid) does a cancellation by SMS need `YES <code>` with the code from that message.

Matching rules, the full command table, buttons, late replies, staff phones and who gets which message: §17.

## 15. Secret masking (messaging-gateway, with a check by auth-security)
The same rules apply to captions, voice transcripts and Meta Muse tool arguments: §23.

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

## 17. Vendor orders by text and in the dashboard (order-booking-service, agent-orchestrator, auth-security-service, notification-service)
§14 lists the commands. This section says how typed text, buttons and the dashboard work as one.

**One order state, several doors.** order-booking owns every order's state. The dashboard, a typed command and a button tap all end in the same RPC (`accept`, `decline`, `markReady`, `verifyPickupCode`; `pauseLocation` / `resumeLocation` on vendor-service) with `actor {kind: vendor, staffId, via: portal | sms | rcs | whatsapp}` and an idempotency key.
- Text covers the frequent actions: accept, decline, ready, picked, pause, resume, help. Substitutions, booking status updates and final quotes are dashboard-only at launch [CONFIRM whether any should also work by text].
- First action wins. The transition module decides. A second action on a step that is already finished gets `INVALID_TRANSITION` with the current state, and the person is told what happened: "D4821 was already accepted by Ama at 3:42 pm" (`vendor.already_done`).
- A late reply is always answered, never ignored: "D4821 was cancelled at 3:50 pm because it was not accepted in time" (`vendor.late_reply`).
- `status_events` records `via` and the staff member for every vendor action. The dashboard's order timeline shows it ("Accepted by Ama · by text · 3:42 pm"), and each staff member's activity log lists their text commands.

**Actions (auth-security).** Every message that invites a vendor action creates one action record per recipient phone: `{id, phoneE164, action, refType, refId, codeHash, buttonTokenHash, expiresAt, usedAt, voidedAt}`. `issueActionCode` returns the code and the button token once; `verifyActionCode` accepts either.
- `code`: 3 characters (§14). It is written in the message only when the step needs one by SMS (§14 and the table below). For those steps it is in the plain-text form even when the rich form has buttons, because an RCS message can fall back to SMS. For every other step the plain-text form just says the plain word to reply.
- `buttonToken`: 128 random bits, carried as the button id (`va:<token>`) on WhatsApp and RCS. A tap counts only with a live token for that phone, so a button on an old alert cannot act on anything.
- When a step ends by any door (dashboard, text, timeout, customer cancellation), every open action for that order and step is voided. auth-security does this from the `order.*` and `booking.*` events. In the gap before the event arrives, order-booking's transition check still refuses the second action.

**Forgiving matching (packages/sdk `guards`, used by agent-orchestrator).** People type on phones.
- Ignore case, accents, extra spaces and punctuation: `ready 4f9`, `READY-4F9` and `Ready: 4 F 9.` all match.
- The code may come before or after the word. A message that is only a live code is enough: the code already names the action and the order.
- English and French words: YES/OUI, NO/NON, READY/PRÊT, PICKED/REMIS, PAUSE, RESUME/REPRENDRE, HELP/AIDE [CONFIRM the French vendor words with a native speaker].
- The code alphabet has no 0/O and no 1/I/L, so there is nothing to mix up. A typed code with a character outside the alphabet is a wrong code.
- Anything that is not a command is not guessed at: answer with the short help text.

**Re-prompt instead of rejecting.** A coded command sent without its code (`READY` for a delivery order, `PAUSE`, or any command during a step-up hour) is not an error and does not count as a wrong code. Answer with exactly what to send: "To mark D4821 ready, reply READY 4F9." This issues a fresh code and voids the old one. At most 3 re-prompts per order per hour; after that, point to the dashboard.

**What each command needs**

| Command | WhatsApp, and RCS once its sender is confirmed as verified | SMS (and RCS until confirmed) | SMS during a step-up hour | SMS during a coded-command lock |
|---------|-------------------------------------------------------------|-------------------------------|---------------------------|---------------------------------|
| YES / NO | button or plain word | plain word | code | plain word (off if a step-up hour is also running) |
| READY, pickup order | button or plain word | plain word | code | plain word (off if a step-up hour is also running) |
| READY, delivery order | button or plain word | code | code | off |
| PAUSE | button, then a confirm tap | code | code | off |
| RESUME | button or plain word | plain word | code | plain word (off if a step-up hour is also running) |
| PICKED + pickup code | the customer's pickup code | the customer's pickup code | the customer's pickup code | the customer's pickup code |
| HELP | always | always | always | always |

- "Off" is answered once with `vendor.sms_locked`: "Text commands are paused for this number until 4:15 pm. Use the dashboard or WhatsApp."
- 5 wrong pickup codes for one order → `PICKED` by text is off for that order, and staff are alerted.
- PAUSE and RESUME: owner and manager only. Accept, decline, ready and picked: any staff member assigned to that location.
- Where the state lives: auth-security keeps the per-number command state (`command_guards`: step-up until, coded-command lock until, wrong-code count). agent-orchestrator asks `auth.getCommandPolicy(phoneE164)` before acting on a vendor text, and reports each plain decline and each command for a ref that is not pending with `auth.recordCommandSignal`. The thresholds are auth-security config (three declines in a row within 30 minutes; five commands for refs that are not pending within an hour). The ConversationDO keeps no security state of its own.

**A number that is both staff and customer.** A vendor staff member can also order groceries from the same phone. A message goes to the vendor parser only when it is a vendor button tap, carries a live vendor code or an order ref of that vendor, or is a vendor-only word (READY, PICKED, PAUSE, RESUME). A bare YES or NO goes to the vendor side when the number has a pending vendor order and no customer summary waiting, to the customer side in the opposite case, and when both are waiting Dovo asks which, with two buttons. Everything else is an ordinary customer conversation.

**Staff phones (vendor-service).** A staff member adds their mobile in the dashboard while signed in with 2FA; auth-security texts an OTP to that phone (`startOtp`, purpose `vendor_staff_phone`); entering it in the dashboard sets `phone_verified`. One verified number belongs to one staff member at one vendor at a time [CONFIRM whether one person may work for two vendors]. Verify again when the number changes, after 90 days without a command, and after a staff-phone freeze (§18). Removing a staff member or their number voids their open actions at once.

**Who gets which message.**
- New order or booking: the on-duty list of the order's location (dashboard, Notification settings). Default: the owner and that location's managers; other staff opt in. Each recipient gets their own action record. A reminder goes to the same list at half the accept time. New-order alerts ignore quiet hours while the location is open.
- Security messages (wrong codes, step-up, coded-command lock, store paused or resumed, payout account changed): the owner and the staff member whose number is involved, plus a review item for Hey Dovo staff when a lock or a step-up fires.
- Payouts and statements: owner. Document expiry: owner and managers.

**WhatsApp.** Outside the 24-hour window a vendor alert must be an approved template (services/messaging-gateway/CLAUDE.md lists them); inside it, an interactive message. A Decline tap is followed by a short reason list (Out of stock / Too busy / Closing soon / Other).

## 18. Blocks, "this wasn't me" and staff review (auth-security-service, admin-service)
auth-security owns every block on spending or commands, so there is one place to see them and one way to lift them.

| Block | Set when | What it stops | How it ends |
|-------|----------|---------------|-------------|
| LOCKED | 5 wrong PINs | wallet approvals | the owner: OTP + new PIN |
| RESET_REQUIRED | the PIN was exposed in chat (§15) | wallet approvals | the owner: OTP + new PIN |
| Post-reset cap | any PIN reset (§7) | wallet approvals above $50 in total | after 24 hours. Staff cannot shorten it |
| SIM-change block | the number lookup reports a recent SIM change or port (§7) | all wallet approvals | after 72 hours it becomes the post-reset cap; staff may lift it earlier after the identity check [CONFIRM] |
| Frozen | the owner says "this wasn't me"; staff; a lost chargeback (§21) | wallet approvals, PIN reset, address and profile changes, new Muse links. Orders by payment link still work | staff only, after the identity check |
| Step-up hour | unusual plain commands by SMS (§14) | plain commands by SMS (a code is needed) | after 1 hour; staff may lift it earlier |
| Coded-command lock | 5 wrong codes in an hour (§14) | coded commands by SMS | after 1 hour; staff may lift it earlier |
| Staff phone frozen | a vendor says "this wasn't me" | every text command from that number | the staff member verifies the phone again in the dashboard, or staff lift it |

**"This wasn't me."** Messages about a security-relevant change give the person a way to say it was not them: PIN changed, a Muse client linked, store paused or resumed by text, payout account changed, a coded-command lock.
- On WhatsApp and RCS: a "This wasn't me" button. On SMS and in the email copy: a link to a secure page with one button (link purpose `not_me`, valid 72 hours, single use). The link proves they hold the phone or the mailbox. There is no typed command, because a typed "not me" could be faked to freeze somebody else.
- Customer: the account is Frozen at once, open approval links and approvals are voided, the conversation is handed to staff, and a `not_me` review item is opened.
- Vendor: that staff phone is frozen, the owner is alerted, and a review item is opened.
- A freeze only makes things stricter, so it needs no PIN.

**Review queue (admin-service).** `review_items (id, kind, subject_type, subject_id, opened_by, reason, status open|in_review|resolved, assignee, sla_due_at, resolution, created_at, resolved_at)`. Kinds: `sim_change`, `not_me`, `vendor_command_lock`, `exposure_limit`, `chargeback`, `delivery_over_cap`, `wallet_close_remainder`, `erasure_overdue`. Default SLA: `not_me` and `sim_change` 4 business hours [CONFIRM]; `chargeback` 3 days before Stripe's evidence deadline; `delivery_over_cap` 10 minutes.

**Lifting a block.** Staff lift a block from its review item. The request carries the staff member's own session straight to auth-security (`liftBlock`), which verifies the session and role itself, requires a reason and the result of the identity check, writes `security_events` and emits `security.block_lifted`. Lifting Frozen, or a SIM-change block before its 72 hours, needs a second staff member (§20). The post-reset cap cannot be lifted. Every lift is in the admin audit log, and the owner is told by text and email.

**Identity check** [CONFIRM the list with operations and the lawyer]: things the phone alone cannot prove, for example the amount and card last four digits of the latest top-up, a recent order, and a link sent to the email on file.

## 19. Delivery quotes: validity, re-quote and the absorb cap (delivery-service, order-booking-service)
An Uber Direct quote lives for a short time (about 15 minutes [CONFIRM]); a summary can be confirmed for 30 minutes (§4); and the courier is booked when the order is ready, often later still. So the fee is checked three times.
1. **Draft.** Get a quote. Fee shown = quote fee adjusted by `config.deliveryFeeAdjustmentBps` (default 0), rounded half up. Store the quote id and when it expires.
2. **Confirmation** (`requestConfirmation`). If the quote has expired, get a new one. If the new fee shown would be higher than the old one by more than `config.deliveryAbsorbCapCents` (default 500 = $5.00 [CONFIRM]) → `SUMMARY_CHANGED`, and the user gets a new summary with the new fee. Otherwise the fee shown stays.
3. **Booking** (`order.ready`). Create the delivery with a fresh quote. The user's fee never changes at this point.
   - Booked fee no more than the fee shown plus the cap → book. The difference goes through `delivery_subsidy_expense` (§3, §6).
   - Over the cap → re-quote up to 2 more times over 5 minutes, since prices move. Still over → do not book automatically: open a `delivery_over_cap` review item and tell the customer there is a short delay. Staff choose: approve the higher fee (audited), switch to vendor self-delivery if enabled, or offer the customer pickup with the delivery fee refunded. If nobody decides within `config.overCapDecisionMinutes` (default 10), book anyway so the order is not left waiting, and flag it [CONFIRM].
- A lower booked fee is kept (§3).
- [CONFIRM] Booking the courier when the vendor accepts, with a scheduled pickup time, would fix the fee earlier, at the risk of courier waiting fees when the vendor is late. Default: book at ready.

## 20. Who may refund, and the proof it carries (wallet-payments-service, auth-security-service)
A refund always goes back to where the money came from (the user's wallet, or the card that paid) and never exceeds what was held or captured for that order.

| Refund | Decided by | Proof the wallet requires |
|--------|-----------|---------------------------|
| Rule-based: a cancellation under §12, vendor decline, auto-cancel, a delivery the courier reports as failed, a refused substitution | order-booking | the order ref and a reason kind. Bounded by the held or captured amount, idempotent per (ref, reason, item) |
| Decided by a person: a dispute outcome, goodwill, anything outside the §12 rules | staff | staff approval ids: one below `config.refundTwoPersonThresholdCents` [CONFIRM value], two from different staff members at or above it |

**Staff approvals.** A staff member approves in the admin portal. That request goes through api-gateway straight to auth-security (`approveStaffAction`), which verifies the session itself (2FA, role finance or support) and records an approval bound to the staff member, the action (`refund`, `lift_block`, `chargeback_evidence`, `delivery_over_cap`), the ref and the amount. It is valid for 24 hours and single use. admin-service (or order-booking, for a dispute outcome) passes only the approval ids on. The wallet calls `auth.redeemStaffApprovals(ids, {action, refType, refId, amountCents}, idempotencyKey)`; auth-security says yes only if every id is live, bound to exactly this refund, from different staff members, and enough of them for the amount. admin-service never handles a staff session token for an approval, so a fault in admin-service cannot mint one.

## 21. Chargebacks (wallet-payments-service, admin-service)
1. Stripe `charge.dispute.created` → the wallet records the case, emits `chargeback.opened`, and reserves the disputed amount: for a disputed top-up, that much of the user's balance cannot be spent, and if the balance is lower the account is Frozen (§18) [CONFIRM policy].
2. admin-service opens a `chargeback` review item, due 3 days before Stripe's evidence deadline.
3. Evidence pack, gathered by admin-service through each owning service's API and stored in R2 (private): the order summary and the user's confirmation; the PIN approval record (approval id and time) or the paid Checkout session; the consent versions (terms, privacy, refunds); when the phone was verified; delivery proof from the courier or the verified pickup code; the redacted conversation excerpt; refunds already given. Only what the case needs.
4. A finance staff member reviews it and submits through `wallet.submitChargebackEvidence({caseId, evidenceKeys, approvalIds})` with one staff approval (§20). The wallet sends it to Stripe.
5. Outcome (`charge.dispute.closed`): won → release the reserve. Lost → post `chargeback_loss`, recover from the reserve where there is a balance, and apply the account policy [CONFIRM, for example no more top-ups by card, payment links only].

## 22. Deleting a user's data, and keeping nothing too long (every service; user-service coordinates)
**Erasure.** A deletion request or a closed account ends with `user.closed {userId, mode}`. Every service that holds personal data consumes it, erases or anonymises its part, and answers `privacy.erasure_completed {userId, service}`. user-service tracks the answers against the table below and the 30-day deadline. An answer still missing after 7 days opens an `erasure_overdue` review item.

| Service | Erase | Keep, and why |
|---------|-------|---------------|
| user-service | name, addresses, preferences, BSUID links | a tombstone with the user id and closing date; consent records (proof of consent) |
| messaging-gateway | message text, media keys, contact_channels | opt-outs as a hash of the number (STOP must keep working); message metadata without text until it ages out |
| agent-orchestrator | Durable Object state, summaries and agent logs for that user | nothing |
| auth-security | PIN hash, links, OTPs, approvals, actions | security events without personal detail (fraud prevention) |
| order-booking | names and address snapshots, once the dispute and chargeback windows have passed | order, amounts and status history under the user id only (financial records) |
| wallet-payments | nothing personal is stored beyond ids | ledger and payment records (financial records) |
| delivery | drop-off snapshots and courier notes | delivery id, fee, status |
| reviews-disputes | the link between a review and its author (the text stays, shown as from a former customer, unless it holds personal data); dispute messages | dispute outcome |
| notification | log entries, push subscriptions, email address | nothing |
| mcp-connector | linked clients and tokens, revoked at once | nothing |
| analytics | nothing by name: the pseudonym can no longer be linked once user-service erases the user | pseudonymised facts |
| R2 | photos and evidence tied to the user, once the dispute and chargeback windows have passed | nothing |

- A legal hold (an open dispute, chargeback or fraud review) pauses erasure of the affected records only, and the user is told [CONFIRM with the lawyer].
- Before closing: a zero wallet balance or `closeWallet` started (§6), and no open orders.
- Outside our systems: ask processors to delete where their terms allow (Telnyx message logs, the Stripe customer, OpenAI and AI Gateway logs) [CONFIRM each provider's controls].

**Retention.** Each service runs a daily job for its own data, and tests it.
- Conversations (message text, media, agent logs, AI Gateway logs, Durable Object history): 12 months from the message, then deleted.
- OTPs, used or expired links, and actions: 30 days. Security events: 24 months [CONFIRM].
- Logs and traces (Workers Logs, Logpush, Sentry): 90 days at most. They already hold no secrets and no message bodies.
- Financial records: 7 years [CONFIRM]. Vendor documents: until 12 months after the vendor closes [CONFIRM].
- Backups age out on the provider's schedule; erased data can remain in a backup until then, and the Privacy Policy says so.

## 23. Masking beyond chat text, and the reply filter
The detection rules and decision table of §15 live in one shared module (packages/sdk `masking`), used at every door a person's words come through. The exposure check (`auth.checkSecretExposure`) may be called by messaging-gateway and mcp-connector-service only.
- **Captions and other text fields.** An image or document caption, a location label, a contact card and any free text on a button reply are masked exactly like a message body.
- **Photos.** A photo can show a card or a written PIN. Photos stay in R2 (private) and go to the model only for repairs and order problems; the model is told never to read numbers out of a photo. No OCR at launch [CONFIRM].
- **Voice** (step 21). Everything Telnyx Voice AI passes to us, transcript text and tool arguments, is masked in the voice adapter before it is stored or forwarded. Spoken digits are normalised first, in English and French ("four eight two one", "quatre huit deux un"). A match is handled as in §15. The Telnyx assistant is instructed never to ask for a PIN, an OTP or a card number; call recording is off, and Telnyx-side transcript retention is set to the minimum [CONFIRM Telnyx controls].
- **Meta Muse** (step 22). Every string argument of every tool call is masked in mcp-connector before it is logged or passed on. The sender is the linked user.

**Reply filter (agent-orchestrator).** It applies to model-written text only; templates are code and are not filtered. It has to stop a leaked secret without breaking ordinary numbers.
- Build an allow-set for the turn: digits found in the user's own messages that passed §15 as ordinary numbers, in tool results (addresses, refs, totals, times, distances) and in the user's saved profile.
- Always allowed by shape: money (`$34.47`, `34,47 $`), times and dates, order refs (a letter, then digits), quantities with a unit (`500 g`, `2 x`), and Hey Dovo's own number.
- A standalone run of 4 to 8 digits passes only if it is in the allow-set or has an allowed shape. Digits right after a secret word (pin, nip, otp, code, password) are blocked whatever they are.
- Other phone numbers, third-party emails and URLs off the allow-list stay blocked.
- On a block: regenerate once, telling the model what was removed. Blocked again → send `error.generic` and offer a human. Never send a reply with a hole in it.

So "Deliver to 1250 Main St, unit 4821?" passes, and "your PIN is 4821" never does.

## 24. Linking Meta Muse (mcp-connector-service, auth-security-service, secure-pages)
- Linking happens on our secure page, never inside Muse: phone OTP, then the wallet PIN. Both are needed, so a stolen code alone cannot link an account. A user with no PIN yet finishes onboarding first.
- No linking while the account is LOCKED, RESET_REQUIRED, Frozen, under a SIM-change block, or inside the 24 hours after a PIN reset.
- When a client is linked, the owner is told by text and email, with "This wasn't me" (§18). For the first 24 hours, wallet approvals started from that client count against the same $50 cap as after a PIN reset.
- Tokens: short-lived access tokens, rotating refresh tokens, scopes `read` (search, track, balance) and `order` (drafts, confirm, cancel, top-up). Unused for 90 days → revoked. The owner can list and unlink clients on a secure page, or by texting UNLINK.
- Links never go to Muse. `confirm_order`, `confirm_booking` and `create_topup_link` make Dovo text the PIN, payment or top-up link to the owner's own phone, and return only a status ("I sent a confirmation link to the phone ending in 21. It expires in 10 minutes."). The secure page shows the summary again; approving there with the PIN, or paying, is the explicit YES of golden rule 8. A "yes" given inside Muse is never consent on its own.
- `cancel` from Muse: a cancellation with a full refund can be confirmed in Muse. One that would cost the customer money is confirmed through a texted link.

