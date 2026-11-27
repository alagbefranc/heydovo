# Hey Dovo — Contracts (APIs, events, agent tools)

The source of truth is `packages/contracts` (zod schemas + TypeScript types). This file is the human-readable map.
Change the schema first, version it, and keep old versions working until every consumer has moved.

## Conventions
- Internal sync calls: Workers RPC methods on each service's `WorkerEntrypoint`, called through service bindings with clients from `packages/sdk`.
- External (web apps): REST JSON through api-gateway at `/api/<service>/...`. Only methods the contract marks as web-facing get a route; every other RPC method is internal.
- Every call carries `correlationId`; every write carries `idempotencyKey`.
- Errors: `{ error: { code, message, requestId, details? } }`. Codes are UPPER_SNAKE, for example `INSUFFICIENT_FUNDS`, `SUMMARY_CHANGED`, `PIN_LOCKED`, `PIN_RESET_REQUIRED`, `PIN_RESET_HOLD`, `LINK_EXPIRED`, `VENDOR_CLOSED`, `NOT_SERVED`, `INVALID_TRANSITION`.
- Money: `{ amountCents: int, currency: "CAD" }`. Ids: UUID v7. Phones: E.164. Times: ISO 8601 UTC.
- Event type names: `<entity>.<past_tense>`; version lives in the envelope.

## Event envelope
```ts
{
  id: string;            // uuid v7
  type: string;          // e.g. "order.confirmed"
  version: number;       // schema version, starts at 1
  occurredAt: string;    // ISO UTC
  correlationId: string;
  idempotencyKey: string;
  actor: { kind: "user" | "vendor" | "staff" | "system" | "agent"; id?: string };
  data: Record<string, unknown>; // validated by the event's zod schema
}
```

## Events
| Event | Producer | Main consumers | Key data |
|-------|----------|----------------|----------|
| message.received | messaging-gateway | agent-orchestrator, analytics | fromE164 or fromBsuid, channel, type, textRedacted, redactions? (kinds only, never the digits), buttonId?, listRowId?, location?, mediaRefs, providerMessageId |
| message.send | agent, notification | messaging-gateway | toE164 or toBsuid, channel?, text (full plain-text version), buttons?, linkButton?, list?, locationRequest?, templateKey?, templateVars?, mediaRefs?, priority |
| message.delivered / message.failed | messaging-gateway | agent, notification | messageId, error? |
| messaging.opted_out / messaging.opted_in | messaging-gateway | user-service, notification | phoneE164, keyword |
| security.secret_exposed | messaging-gateway | auth-security, agent | phoneE164 or bsuid, kind (pin, otp, card) |
| handoff.requested / handoff.ended | agent-orchestrator | admin-service, notification | userId, reason, conversationId |
| user.registered / user.updated / user.verified / user.closed | user-service | agent, analytics, notification | userId, changedFields |
| consent.changed | user-service | notification, analytics | userId, kind, granted, version |
| auth.phone_verified | auth-security | user-service | userId, phoneE164 |
| pin.set / pin.reset | auth-security | user-service, agent, notification | userId, spendHoldUntil? |
| pin.verified | auth-security | order-booking | userId, linkId, approvalId, refType, refId, amountCents, summaryHash |
| pin.failed / pin.locked | auth-security | agent, notification, admin | userId, attemptsLeft |
| auth.reverify_required | auth-security | user-service, agent | userId, reason |
| vendor.applied / vendor.approved / vendor.paused / vendor.resumed / vendor.updated | vendor-service | catalogue, notification, admin, analytics | vendorId, status |
| vendor.document_expiring / vendor.document_expired | vendor-service | notification, catalogue | vendorId, docKind, expiresAt |
| stock.changed | catalogue | analytics | productId, inStock |
| quote.requested / quote.sent / quote.accepted / quote.expired | catalogue | agent, order-booking, notification | quoteId, userId, vendorId, amountCents |
| order.draft_created | order-booking | analytics | orderId, totals |
| order.awaiting_payment | order-booking | agent | orderId, method, linkUrl? |
| order.confirmed | order-booking | notification (vendor), agent, analytics | orderId, vendorId, fulfilment, totals |
| order.accepted / order.declined | order-booking | agent, analytics | orderId, reason? |
| order.substitution_proposed / order.item_refunded | order-booking | agent | orderId, items |
| order.ready | order-booking | agent | orderId, readyAt, pickupCode? (pickup orders only; never logged or stored by the consumer) |
| order.collected / order.delivered / order.completed | order-booking | agent, reviews, analytics | orderId |
| order.cancelled | order-booking | agent, notification, analytics | orderId, by, reason, refundCents |
| booking.confirmed / booking.on_the_way / booking.started / booking.final_quote_sent / booking.completed / booking.cancelled / booking.no_show | order-booking | agent, notification, reviews | bookingId, details |
| payment.succeeded / payment.failed | wallet | order-booking, agent | refType, refId, amountCents, method |
| wallet.topped_up | wallet | agent, analytics | userId, amountCents, balanceCents |
| hold.created / hold.captured / hold.released | wallet | order-booking, analytics | holdId, refId, amountCents |
| refund.issued | wallet | agent, notification, analytics | refType, refId, amountCents, destination |
| payout.sent / payout.failed | wallet | notification (vendor), admin | vendorId, amountCents, period |
| chargeback.opened | wallet | admin, reviews-disputes | userId, refId, amountCents |
| delivery.quoted / delivery.created / delivery.assigned / delivery.picked_up / delivery.delivered / delivery.cancelled / delivery.failed | delivery | order-booking, agent | deliveryId, orderId, provider, etaAt, trackingUrl |
| review.created / review.hidden | reviews-disputes | vendor-service (stats), catalogue, analytics | vendorId, rating |
| dispute.opened / dispute.updated / dispute.resolved | reviews-disputes | order-booking, admin, notification | disputeId, refId, outcome, refundCents, liable |
| settings.changed / flag.changed | admin-service | all (cache refresh) | key |

## Sync APIs (RPC methods)
- **user-service**: `getByPhone`, `getByBsuid`, `getById`, `createPending`, `updateProfile`, `addAddress` (geocodes, checks served area), `listAddresses`, `setDefaultAddress`, `recordConsent`, `getOnboarding`, `setOnboardingStep`, `exportData`, `closeAccount`.
- **auth-security-service**: `createSecureLink({purpose, userId, refType?, refId?, amountCents?, summaryHash?})`, `resolveLink(token)`, `startOtp(phone, purpose)`, `verifyOtp`, `setPin(token, pin, pinConfirm)`, `verifyPin(token, pin)`, `startPinReset`, `getSpendAllowance(userId)`, `redeemApproval(approvalId, bound, idempotencyKey)` (wallet only), `issueActionCode`, `verifyActionCode`, `verifyStaffSession(jwt)`, `verifyVendorSession(jwt)`, `requireReverification(userId, reason)`, `checkSecretExposure({sender, candidates})` (internal, on its own entrypoint bound only by messaging-gateway; `sender` is exactly one of `e164` or `bsuid`; answers per candidate `pin`, `otp`, `none` or `unavailable`, where a rate limit, lookup failure or internal error is `unavailable`, never `none`; docs/ALGORITHMS.md §15).
- **vendor-service**: `apply`, `getVendor`, `updateProfile`, `getUploadUrl`, `reviewDocument`, `setStatus`, `listCandidates({point, kind, category?, fulfilment?, at})`, `getAvailability(vendorId, range)`, `holdSlot`, `releaseSlot`, `getStaffByPhone(phoneE164)`, `getPayoutAccount`.
- **catalogue-quotes-service**: `searchProducts({query, userPoint, fulfilment, limit})`, `searchServices({need, category?, userPoint, at, emergency})`, `getProducts(ids)` (current price/stock), `upsertProduct`, `bulkUpload`, `upsertService`, `createQuoteRequest`, `submitQuote`, `acceptQuote`, `getRankingWeights(category)`.
- **order-booking-service**: `createDraft({userId, vendorId, items, fulfilment, addressId?, deliveryQuoteId?})`, `updateDraft`, `requestConfirmation(draftId, summaryHash)`, `createBookingDraft`, `requestBookingConfirmation`, `getStatus(refId)`, `cancel(refId, by, reason)`, `switchFulfilment`; vendor actions `accept`, `decline`, `proposeSubstitution`, `markReady`, `verifyPickupCode`, `updateBookingStatus`, `submitFinalQuote`.
- **wallet-payments-service**: `getBalance(userId)`, `createTopUpLink(userId, amountCents)`, `hold({userId, refType, refId, amountCents, approvalId, idempotencyKey})`, `capture(holdId, splits)`, `release(holdId)`, `createPaymentLink({userId, refType, refId, amountCents})`, `refund({refType, refId, amountCents, reason, idempotencyKey})`, `getLedger(filter)` (admin), `runPayouts(period)` (Workflow), `createConnectOnboardingLink(vendorId)`. Each method is exposed only to the callers in the allowed-caller table in `services/wallet-payments-service/CLAUDE.md`. From api-gateway, `createTopUpLink` and `createConnectOnboardingLink` take proof (a `topup` link token, a vendor session JWT) instead of ids.
- **messaging-gateway**: `lookupNumber(phoneE164)` (auth-security only; reports a recent SIM change or port [CONFIRM availability]).
- **delivery-service**: `quote({pickup, dropoff, orderValueCents, readyAt})` (best quote + alternatives), `book({orderId, quoteId})` (returns the booked `feeCents`), `cancel(deliveryId)`, `get(deliveryId)`.
- **reviews-disputes-service**: `createReview`, `replyToReview`, `hideReview`, `openDispute`, `addDisputeMessage`, `resolveDispute`.
- **admin-service**: settings, flags, launch regions, audit log, refund approvals, takeover messages (see its CLAUDE.md).

## Agent tools (OpenAI function tools → service calls)
Every tool has a strict JSON schema in `packages/contracts/src/agent-tools`. The orchestrator enforces the guard column in code, never the model.

| Tool | Calls | Guard |
|------|-------|-------|
| get_profile | user.getByPhone | — |
| save_onboarding_field | user.setOnboardingStep / addAddress | onboarding only |
| send_setup_link | auth.createSecureLink(setup) | onboarding only |
| search_products | catalogue.searchProducts | verified user |
| search_services | catalogue.searchServices | verified user |
| get_delivery_quote | delivery.quote | verified user |
| create_order_draft / update_order_draft | order.createDraft / updateDraft | verified user |
| create_booking_draft | order.createBookingDraft | verified user |
| request_quote | catalogue.createQuoteRequest | verified user |
| confirm_order | order.requestConfirmation | summary shown in this conversation, same summaryHash, shown < 30 min ago, latest user turn is a deterministic YES |
| confirm_booking | order.requestBookingConfirmation | same as confirm_order |
| get_balance | wallet.getBalance | verified user |
| create_topup_link | wallet.createTopUpLink | verified user |
| track | order.getStatus | own orders only |
| cancel | order.cancel | own orders only; shows the refund amount first; then the confirm button for that message (WhatsApp/RCS) or, on SMS, `YES <code>` with the one-time code from that message |
| switch_fulfilment | order.switchFulfilment | before vendor accepts |
| open_dispute | reviews.openDispute | own orders only |
| leave_review | reviews.createReview | completed orders only |
| update_address / set_language | user.* | verified user |
| handoff_to_human | emits handoff.requested | always allowed |

No tool moves money directly. `confirm_order` only starts the PIN or payment-link step. `get_balance` and `create_topup_link` are the only wallet methods the agent can reach.
