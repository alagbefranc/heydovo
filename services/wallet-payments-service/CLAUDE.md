# wallet-payments-service

## Purpose
The ONLY service that moves money. Double-entry ledger, wallet top-ups, holds, captures with fee/commission splits, payment links, refunds, chargebacks, vendor payouts (Stripe Connect), reconciliation. Read docs/ALGORITHMS.md §3, 6, 12, 13 and docs/SECURITY.md first. Write tests first for everything here.

## Owns (schema `wallet`)
- `ledger_accounts` (id, type, owner_type, owner_id, currency)
- `ledger_transactions` (id, kind, ref_type, ref_id, entry_key UNIQUE, idempotency_key UNIQUE, memo, created_at)
- `ledger_entries` (id, transaction_id, account_id, amount_cents signed) — deferred trigger: entries per transaction sum to 0; no UPDATE/DELETE (append-only)
- `holds` (id, user_id, ref_type, ref_id, amount_cents, status held|captured|released|partially_released, expires_at)
- `payment_intents` (id, purpose topup|order_link, user_id, ref, amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, status, expires_at)
- `stripe_events` (event_id UNIQUE, type, processed_at)
- `payouts` (id, vendor_id, period, amount_cents, stripe_transfer_id, status)
- `limits` and `fraud_signals`

## Stripe
- Top-ups and pay-by-link: Stripe Checkout Sessions (card, Apple Pay, Google Pay) with metadata {purpose, userId, refType, refId}; link expiry aligned with our TTL (Checkout's minimum expiry applies [CONFIRM]).
- Webhooks: verify `Stripe-Signature`, dedupe by event id; handle checkout.session.completed/expired, payment_intent.succeeded/payment_failed, charge.refunded, charge.dispute.created/closed, account.updated, transfer.*, payout.*.
- Vendors: Stripe Connect accounts [CONFIRM Express vs Standard]; onboarding link from the vendor portal; weekly transfers.

## Key logic
- `hold` / `capture(splits)` / `release` / `refund` exactly as docs/ALGORITHMS.md §6; every call idempotent; every ledger post has a unique entry_key.
- Balance = Σ entries for user_wallet (cache allowed, rebuilt in reconciliation).
- Limits, velocity and fraud checks before holds and top-ups; refunds above threshold need two staff approvals (admin-service supplies approvals).
- Daily reconciliation vs Stripe balance transactions; alert on mismatch.
- Payout Workflow (§13) with dispute buffer and reserves.

## Events
Publishes: payment.succeeded, payment.failed, wallet.topped_up, hold.created, hold.captured, hold.released, refund.issued, payout.sent, payout.failed, chargeback.opened.
Consumes: none for money movement (commands come by RPC from order-booking and admin-service only); dispute.resolved for reserves.

## Must never
- Accept a money command from the agent or a web app directly (only order-booking-service and admin-service, verified by service binding identity). Store card data. Update or delete ledger rows. Post unbalanced transactions.

## Tests
Property-based tests: ledger always balances; no double post under retries/concurrency; holds never exceed balance; capture splits add up to the hold; refunds never exceed captured; webhook replay/forgery; reconciliation mismatch detection; payout reserves; limits.
