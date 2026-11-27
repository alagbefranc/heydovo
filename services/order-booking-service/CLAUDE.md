# order-booking-service

## Purpose
Owns every order (delivery or pickup) and every trade booking from draft to completion. Orchestrates payment (wallet-payments) and delivery (delivery-service) with Cloudflare Workflows. Read docs/ALGORITHMS.md §3–5, 12 first.

## Owns (schema `orders`)
- `orders` (id, ref UNIQUE e.g. D4821, user_id, vendor_id, location_id, fulfilment delivery|pickup, status, subtotal_cents, tax_cents, tax_breakdown, delivery_fee_cents, service_fee_cents, total_cents, commission_bps, summary_hash, summary_shown_at, payment_plan jsonb {walletCents, linkCents}, delivery_address snapshot, delivery_quote_id, pickup_code_hash, ready_by, accept_deadline, idempotency_key UNIQUE, correlation_id, timestamps)
- `order_items` (id, order_id, product_id, name_snapshot, qty, unit_price_cents, status ok|substituted|refunded, substitute_of)
- `bookings` (id, ref UNIQUE e.g. B4821, user_id, vendor_id, service_id, quote_id, slot_start, slot_end, emergency, address snapshot, status, callout_fee_cents, final_amount_cents, final_summary_hash, photos, notes)
- `status_events` (ref_type, ref_id, from, to, actor, reason, at)
- `idempotency_keys` (key, request_hash, response, expires_at)

## Key logic
- One transition module per state machine; reject anything else (`INVALID_TRANSITION`).
- Drafts: re-check live prices/stock (catalogue) and delivery quote; compute fees (§3); compute summaryHash (§4).
- `requestConfirmation`: verify hash + freshness → decide payment plan → ask auth-security for a PIN link (wallet part) and/or wallet for a payment link (remaining) → AWAITING_PAYMENT.
- On `pin.verified` (bound ref, amount, hash must match) → `wallet.hold` → on success, plus `payment.succeeded` for any link part → CONFIRMED → start `OrderWorkflow`.
- `OrderWorkflow`: notify vendor → wait accept (timeout → auto-cancel + release) → wait ready → book delivery or issue pickup code → wait delivered/collected → `wallet.capture` with splits → COMPLETED.
- `BookingWorkflow`: hold call-out fee → slot booked → status updates → final quote (new summary + YES + PIN if more) → capture → COMPLETED.
- Cancellations and refunds per §12; send `refundCents` in `order.cancelled`; wallet executes.
- Vendor actions (portal or text via agent): accept, decline, substitution, ready, pickup code check, booking status, final quote.

## Events
Publishes: order.* and booking.* (see docs/CONTRACTS.md).
Consumes: pin.verified, payment.succeeded, payment.failed, delivery.*, quote.accepted, dispute.resolved.

## Must never
- Move money itself, confirm without a matching PIN/payment event, or charge more than the shown summary.

## Tests
Every allowed and forbidden transition, Workflow timeouts and retries, price change between summary and confirm, duplicate/out-of-order events, split payment, pickup code, substitution, every cancellation point with correct refund amount, booking final-quote path.
