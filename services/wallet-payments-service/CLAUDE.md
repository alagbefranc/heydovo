# wallet-payments-service

## Purpose
The ONLY service that moves money. Double-entry ledger, wallet top-ups, holds, captures with fee/commission splits, payment links, refunds, chargebacks, vendor payouts (Stripe Connect), reconciliation. Read docs/ALGORITHMS.md §3, 6, 12, 13 and docs/SECURITY.md first. Write tests first for everything here.

## Owns (schema `wallet`)
- `ledger_accounts` (id, type, owner_type, owner_id, currency)
- `ledger_transactions` (id, kind, ref_type, ref_id, entry_key UNIQUE, idempotency_key UNIQUE, memo, created_at)
- `ledger_entries` (id, transaction_id, account_id, amount_cents signed) — deferred trigger: entries per transaction sum to 0; no UPDATE/DELETE (append-only)
- `holds` (id, user_id, ref_type, ref_id, amount_cents, approval_id, status held|captured|released|partially_released, expires_at)
- `payment_intents` (id, purpose topup|order_link, user_id, ref, amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, status, expires_at)
- `stripe_events` (event_id UNIQUE, type, processed_at)
- `payouts` (id, vendor_id, period, amount_cents, stripe_transfer_id, status)
- `limits` and `fraud_signals`

## Stripe
- Top-ups and pay-by-link: Stripe Checkout Sessions (card, Apple Pay, Google Pay) with metadata {purpose, userId, refType, refId}; link expiry aligned with our TTL (Checkout's minimum expiry applies [CONFIRM]).
- Webhooks: verify `Stripe-Signature`, dedupe by event id; handle checkout.session.completed/expired, payment_intent.succeeded/payment_failed, charge.refunded, charge.dispute.created/closed, account.updated, transfer.*, payout.*.
- Vendors: Stripe Connect accounts [CONFIRM Express vs Standard]; onboarding link from the vendor portal; weekly transfers.

## Key logic
- `hold` / `capture(splits)` / `release` / `refund` exactly as docs/ALGORITHMS.md §6; every call idempotent; every ledger post has a unique entry_key. Capture splits include the tax lines and, when the booked courier fee differs from the fee shown, the delivery subsidy line (a debit when higher, a credit when lower; §3, §6).
- `hold` from a user's wallet needs a PIN approval: call `auth.redeemApproval(approvalId, {userId, refType, refId, amountCents}, idempotencyKey)` first and hold only on a yes (docs/ALGORITHMS.md §8). Funds that arrive by payment link are placed in hold by this service itself on the verified Stripe event and need no approval.
- Balance = Σ entries for user_wallet (cache allowed, rebuilt in reconciliation).
- Limits, velocity and fraud checks before holds and top-ups; refunds above threshold need two staff approvals (admin-service supplies approvals).
- Daily reconciliation vs Stripe balance transactions; alert on mismatch.
- Payout Workflow (§13) with dispute buffer and reserves.

## Allowed callers
| Method | Allowed callers |
|--------|-----------------|
| `hold`, `capture`, `release`, `createPaymentLink` | order-booking-service |
| `refund` | order-booking-service (rule-based refunds; a dispute outcome carries staff approval ids); admin-service (always with staff approval ids). docs/ALGORITHMS.md §20 |
| `runPayouts`, `getLedger` | admin-service (payouts also run on this service's own weekly schedule) |
| `getBalance` | agent-orchestrator, mcp-connector-service, order-booking-service, user-service (account closing), admin-service |
| `createTopUpLink` | agent-orchestrator, mcp-connector-service, api-gateway for secure-pages (top-up page) |
| `createConnectOnboardingLink` | api-gateway for vendor-portal |

The table is enforced in two places. On Workers the calling Worker's own config decides which entrypoint it binds, and this service cannot see who is calling, so a check inside this service alone is not enough.
1. **Here**: one named `WorkerEntrypoint` class per caller, exposing only that caller's methods. Build them by composition; never extend a class that holds other callers' methods, because RPC exposes inherited methods. The default export has only `fetch`, for the Stripe webhook, and no RPC methods.
2. **In `infra/`**: one list of which Worker may bind which entrypoint of this service. CI reads every Worker's `wrangler.jsonc` and fails on any binding that is not on the list. Changing the list needs the same manual approval as a wallet change.

Rules for callers:
- From api-gateway, methods take proof, not ids. `createTopUpLink({linkToken, amountCents})`: this service has auth-security resolve the `topup` link and takes the user from the answer. `createConnectOnboardingLink({vendorJwt})`: this service calls `verifyVendorSession` and requires the owner role with 2FA. That method decides where payouts go, so treat it as carefully as a money method.
- From the agent and the MCP connector, `userId` always comes from the verified sender or the OAuth token, never from model output or tool arguments.
- The agent, the MCP connector and the web apps never reach `hold`, `capture`, `release`, `refund` or payouts directly. Staff reach refunds and payouts only through admin-service, with its role checks, approvals and audit log.
- Stripe webhooks arrive on this service's own public webhook route and are trusted only after signature verification.
- Never widen a row to unblock a flow. If a flow has no method, add a narrow one to `packages/contracts` first (ask, as for any contract change). These three are now defined (docs/CONTRACTS.md, "Added contracts"):
  - closing a wallet (docs/ALGORITHMS.md §6): `closeWallet` for user-service (the owner's own request, with a `privacy` link token as proof) and for admin-service (with a staff approval). It refunds only to the original top-up charges, so it cannot send money anywhere new; what cannot go back to a card becomes a `wallet_close_remainder` review item;
  - vendor statements for the portal's Earnings page: `getVendorStatement({vendorJwt, period, format})` for api-gateway (owner role; JSON or CSV);
  - the pay-link page fetching its Checkout URL: `getCheckoutUrl({linkToken})` for api-gateway (`pay_link` and `topup` links; a new Checkout session is created if the old one expired).

## Events
Publishes: payment.succeeded, payment.failed, wallet.topped_up, hold.created, hold.captured, hold.released, refund.issued, payout.sent, payout.failed, chargeback.opened.
Consumes: none for money movement (money-moving commands come by RPC, only from the callers in the table above); dispute.resolved for reserves.

## Must never
- Expose a method on an entrypoint whose caller is not in the allowed-caller table. Take a user or vendor id from api-gateway without proof. Store card data. Update or delete ledger rows. Post unbalanced transactions.

## Tests
Property-based tests: ledger always balances; no double post under retries/concurrency; holds never exceed balance; no wallet hold without a redeemed approval (missing, expired, reused, wrong amount, wrong user); capture splits add up to the hold (with the delivery subsidy line in both directions, so `delivery_payable` always equals the booked fee); each entrypoint exposes only its listed methods and nothing inherited; the default export has no RPC methods; gateway-facing methods reject a missing, expired or wrong-purpose token and a non-owner vendor session; refunds never exceed captured; webhook replay/forgery; reconciliation mismatch detection; payout reserves; limits.

## Added scope (designed 2026-11-27)
- Refund proof (docs/ALGORITHMS.md §20): rule-based refunds from order-booking need a reason kind and are bounded by the held or captured amount; any refund decided by a person needs staff approval ids, redeemed with auth-security before anything moves.
- `closeWallet`, `getVendorStatement` and `getCheckoutUrl` as in the allowed-caller notes above and docs/CONTRACTS.md.
- Chargebacks (docs/ALGORITHMS.md §21): record the case, reserve the disputed amount, `getChargebackCase`, `submitChargebackEvidence` with one staff approval, outcomes and ledger postings.
- Amounts paid and fees per vendor per quarter for the yearly seller report (docs/LAUNCH.md) [CONFIRM with the accountant].
- Erasure: answer `privacy.erasure_completed`; ledger and payment records stay (financial records).
- Added tests: a person-decided refund with no, one, two, repeated, expired or mismatched approvals; a rule-based refund above the captured amount; wallet closing (refunds only to original top-up charges, remainder becomes a review item, refused with open holds); statements only for the vendor's own owner; a Checkout URL only for a live `pay_link` or `topup` token; chargeback reserve, evidence submission and both outcomes.
