# order-booking-service

## Purpose
Owns every order (delivery or pickup) and every trade booking from draft to completion. Orchestrates payment (wallet-payments) and delivery (delivery-service) with Cloudflare Workflows. Read docs/ALGORITHMS.md §3–5, 12 first.

## Owns (schema `orders`)
- `orders` (id, ref UNIQUE e.g. D4821, user_id, vendor_id, location_id, fulfilment delivery|pickup, status, subtotal_cents, tax_cents, tax_breakdown, delivery_fee_cents, service_fee_cents, total_cents, commission_bps, summary_hash, summary_shown_at, payment_plan jsonb {walletCents, linkCents}, delivery_address snapshot, delivery_quote_id, delivery_booked_fee_cents, pickup_code_hash, ready_by, accept_deadline, idempotency_key UNIQUE, correlation_id, timestamps)
- `order_items` (id, order_id, product_id, name_snapshot, qty, unit_price_cents, status ok|substituted|refunded, substitute_of)
- `bookings` (id, ref UNIQUE e.g. B4821, user_id, vendor_id, service_id, quote_id, slot_start, slot_end, emergency, address snapshot, status, callout_fee_cents, final_amount_cents, final_summary_hash, photos, notes)
- `status_events` (ref_type, ref_id, from, to, actor, reason, at)
- `idempotency_keys` (key, request_hash, response, expires_at)

## Key logic
- One transition module per state machine; reject anything else (`INVALID_TRANSITION`).
- Drafts: re-check live prices/stock (catalogue) and delivery quote; compute fees (§3); compute summaryHash (§4).
- `requestConfirmation`: verify hash + freshness → decide payment plan → ask auth-security for a PIN link (wallet part) and/or wallet for a payment link (remaining) → AWAITING_PAYMENT. After a PIN reset the wallet part is limited: ask `auth.getSpendAllowance(userId)` when building the draft and plan anything above it as a payment link, so the summary already shows the split (docs/ALGORITHMS.md §7).
- On `pin.verified` (bound ref, amount, hash must match) → `wallet.hold` with the `approvalId` from the event (wallet redeems it with auth-security; the event alone moves nothing) → on success, plus `payment.succeeded` for any link part → CONFIRMED → start `OrderWorkflow`.
- `OrderWorkflow`: notify vendor → wait accept (timeout → auto-cancel + release) → wait ready → book delivery or issue pickup code → wait delivered/collected → `wallet.capture` with splits → COMPLETED. Splits carry the tax lines, the delivery fee shown and the booked courier fee returned by `delivery.book`; any difference between the two becomes the delivery subsidy line, and the user always pays exactly the fee shown (docs/ALGORITHMS.md §3, §6).
- `BookingWorkflow`: hold call-out fee → slot booked → status updates → final quote (new summary + YES + PIN if more) → capture → COMPLETED.
- Cancellations and refunds per §12: call `wallet.release` / `wallet.refund` by RPC. `order.cancelled` carries `refundCents` for information only; wallet never moves money from an event.
- Vendor actions (portal or text via agent): accept, decline, substitution, ready, pickup code check, booking status, final quote.

## Events
Publishes: order.* and booking.* (see docs/CONTRACTS.md).
Consumes: pin.verified, payment.succeeded, payment.failed, delivery.*, quote.accepted, dispute.resolved.

## Must never
- Move money itself, confirm without a matching PIN/payment event, or charge more than the shown summary.

## Tests
Every allowed and forbidden transition, Workflow timeouts and retries, price change between summary and confirm, duplicate/out-of-order events, split payment, pickup code, substitution, every cancellation point with correct refund amount, booking final-quote path.

## Added scope (designed 2026-11-27)
- One state, several doors (docs/ALGORITHMS.md §17): every vendor action takes `actor {kind, staffId, via}`; `status_events` gains `via` and `staff_id`; first action wins, and the loser gets `INVALID_TRANSITION` with the current state, who acted, how and when, so the caller can answer a late reply.
- Delivery quotes (docs/ALGORITHMS.md §19): re-quote at confirmation and at booking, the absorb cap, `delivery.over_cap`, `decideDeliveryOverCap` with a staff approval, and booking anyway after the decision time.
- The pickup code leaves this service once, in `order.ready` for pickup orders; only its hash is stored.
- A dispute-outcome refund passes the staff approval ids from `dispute.resolved` to the wallet (docs/ALGORITHMS.md §20).
- Erasure consumer: names and address snapshots after the dispute and chargeback windows (docs/ALGORITHMS.md §22).
- Added tests: two staff acting at once through different doors, a reply after timeout, the over-cap paths (re-quote succeeds, staff approve, self-delivery, pickup offer, nobody decides), the split payment after a PIN reset, the pickup code absent from every stored field and every event except `order.ready`.
