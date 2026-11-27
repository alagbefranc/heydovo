# Hey Dovo — Architecture

## Big picture
```
Customer (RCS / SMS / WhatsApp / phone call / Meta Muse)
   │                                   │
Telnyx — one Hey Dovo number           Meta Muse
(RCS + SMS/MMS fallback,               (MCP client)
 WhatsApp, Voice AI)                   │
   │                                   │
   ▼                                   ▼
messaging-gateway ───────────────  mcp-connector-service
   │  Queue: message.received          │
   ▼                                   ▼
agent-orchestrator (Durable Object per user, OpenAI via AI Gateway, tool calling)
   │  tools = typed RPC calls over service bindings
   ▼
user · auth-security · vendor · catalogue-quotes · order-booking ·
wallet-payments · delivery · reviews-disputes
   │  events on Cloudflare Queues
   ▼
notification-service · analytics-service · agent-orchestrator (status updates)

Web apps → api-gateway Worker (behind Cloudflare WAF) → services
  secure-pages  (customers, opened from chat links: onboarding, PIN, pay, track)
  vendor-portal (vendors; Supabase Auth + 2FA)
  admin-portal  (staff; Cloudflare Zero Trust Access + Supabase Auth + 2FA) → admin-service

Public website (static, no API calls)
  website       (heydovo.com: landing page, /start entry link, legal pages, security.txt)

Every service → Supabase Postgres (Canada), its own schema + role, via Hyperdrive
```

## Services
Each service = one Worker + one Postgres schema + one DB role + its own tests, migrations and Wrangler config.

| # | Service | Owns (data) | Main job |
|---|---------|-------------|----------|
| 0 | api-gateway | none (routing config) | Single entry for web apps: auth checks, rate limits, routing |
| 1 | messaging-gateway | channel config, inbound/outbound message log | Telnyx adapters (RCS/SMS, WhatsApp, voice), webhook verification, secret masking |
| 2 | agent-orchestrator | conversation state (DO), prompts, tool registry, agent logs | AI conversation, tool calling, confirmation guard, handoff, vendor text commands |
| 3 | user-service | users, addresses, consents, onboarding progress, preferences | Customer accounts, geocoding, consent, privacy requests |
| 4 | auth-security-service | OTP challenges, PIN hashes, secure links, staff roles | OTP, PIN, secure links, staff/vendor auth checks, re-verification |
| 5 | vendor-service | vendors, locations, hours, documents, staff, calendars | Vendor onboarding, verification, availability, candidate lookup (PostGIS) |
| 6 | catalogue-quotes-service | products, services, quotes, ranking weights, synonyms | Search, quotes, vendor ranking |
| 7 | order-booking-service | orders, items, bookings, status history | Order/booking lifecycles; orchestrates payment + delivery |
| 8 | wallet-payments-service | ledger, wallets, holds, payment intents, payouts | The ONLY service that moves money |
| 9 | delivery-service | deliveries, quotes, provider config | DoorDash Drive / Uber Direct (in-house later) behind one interface |
| 10 | notification-service | notification log, preferences, push subscriptions | Alerts outside the chat: vendor SMS, email, web push, admin alerts |
| 11 | reviews-disputes-service | reviews, disputes, dispute messages | Ratings, vendor replies, dispute cases and outcomes |
| 12 | mcp-connector-service | linked MCP accounts | Public MCP endpoint for Meta Muse |
| 13 | admin-service | settings, flags, launch regions, audit log, refund approvals | Admin portal backend; never writes other schemas |
| 14 | analytics-service | pseudonymised event warehouse | Metrics and funnels; no personal data in reports |

## Communication rules
- **Sync** (needs an answer now): Workers RPC over service bindings, using typed clients from `packages/sdk`. Schemas from `packages/contracts`.
- **Async** (something happened): publish an event to Cloudflare Queues. Names and payloads are in `packages/contracts` and `docs/CONTRACTS.md`.
- **Envelope** for every event: `{ id, type, version, occurredAt, correlationId, idempotencyKey, actor, data }`.
- Consumers are idempotent: store processed event ids; repeats are no-ops. Failures retry, then go to a dead-letter queue with an alert.
- Every request and event carries a `correlationId` so one customer action can be traced across services.
- Long, multi-step, retryable processes (order and booking lifecycles, payouts) run in Cloudflare Workflows owned by the responsible service.
- No service reads or writes another service's schema. Each DB role can only reach its own schema.

## Key flows
### Inbound message
1. Telnyx webhook → messaging-gateway verifies the signature, masks secrets (PIN/OTP candidates are checked with auth-security, docs/ALGORITHMS.md §15), stores only the redacted message, acks fast and processes the rest async.
2. Publishes `message.received` → agent-orchestrator routes to the Durable Object for that phone number.
3. If the sender is a registered vendor staff number → deterministic vendor command parser (no AI).
4. Otherwise the agent loads context and calls OpenAI with tools; replies go out as `message.send`.

### Product order (delivery, wallet)
1. Agent: `catalogue.searchProducts` (ranked, nearest first) → `delivery.quote` → `order.createDraft` (returns summary, totals, summaryHash).
2. Agent sends the summary. User replies YES (deterministic check) → `order.requestConfirmation`.
3. order-booking asks auth-security for a PIN link bound to orderId + amount + summaryHash → agent sends the link.
4. User enters PIN on secure-pages → `pin.verified` → order-booking calls `wallet.hold` → order CONFIRMED → `order.confirmed`.
5. Vendor accepts (portal or YES by text) → `order.accepted` → prepares → `order.ready`.
6. order-booking calls `delivery.book` → `delivery.assigned` → `delivery.picked_up` → `delivery.delivered`.
7. `order.completed` → order-booking calls `wallet.capture` → ledger splits fee, commission, delivery cost, tax, vendor payable.
8. Agent texts updates at each step (templated, EN/FR).

### Pay-by-link and split payment
Wallet short → order-booking calls `wallet.createPaymentLink(remaining)` (Stripe Checkout) → agent sends link → Stripe webhook → `payment.succeeded` → order confirmed. If the wallet covers part, the wallet part is held after PIN and the rest is charged by link; the order confirms only when both succeed.

### Pickup
Same as delivery up to `order.ready` (no delivery quote). User gets address, map link and a one-time pickup code. Vendor enters the code (portal or `PICKED <code>` by text) → `order.collected` → `order.completed`.

### Service booking (trades)
Triage questions → `catalogue.searchServices` (emergencies rank by fastest arrival) → user picks → `order.createBookingDraft` → summary → YES → PIN → call-out fee held → `booking.confirmed` → on_the_way → started → vendor submits final quote → user YES (+ PIN if more funds needed) → done → capture → payout → review prompt.

### Onboarding
Unknown number → user-service creates a pending user → agent collects language, name, address (geocoded, served-area check) → auth-security creates a setup link → secure page: OTP, terms + privacy acceptance, CASL choice (unticked), PIN set, optional email → user-service emits `user.verified` → optional wallet top-up.

### Voice
Calls to the Hey Dovo number go to Telnyx Voice AI, which handles speech; its tool webhooks call messaging-gateway's voice adapter, which forwards to the same agent-orchestrator tools. Spoken YES confirms a summary; the PIN link is always texted. Never charge on voice alone.

### Meta Muse
mcp-connector-service exposes MCP tools that call the same service APIs, with the same confirmation and PIN rules. Accounts link through OAuth with phone OTP.

## Storage
- Supabase Postgres (Canada): schema per service, role per service, RLS as defence in depth. PostGIS, pgvector, full-text search (English + French). Through Hyperdrive, query caching is off unless a read path is named as cacheable, and RLS settings are transaction-local (docs/SECURITY.md, Platform).
- R2: product images, repair photos, vendor documents (private; short-lived signed URLs). Cloudflare Images for resizing.
- KV: config and feature-flag cache. Durable Objects: live conversation state.
- Analytics Engine + Logpush: metrics and logs. Sentry: errors.

## Failure handling
- RCS unavailable for a recipient → Telnyx automatic SMS/MMS fallback. Telnyx outage → queue outbound messages with retries and alert; optional second SMS provider later behind the same adapter interface.
- Courier down or no coverage → other provider → vendor self-delivery → offer pickup.
- OpenAI down → fallback model via AI Gateway → templated apology + human handoff.
- Provider webhook retries → dedupe on provider event id.
- Payment retries can never double-charge (idempotency keys + unique ledger keys per order and entry type).
- Feature flags switch off a channel, city, provider or category without a redeploy.

## Environments
`dev`, `staging`, `prod`, each with separate Cloudflare resources, Supabase projects, Stripe accounts (test/live) and provider sandboxes. Never use production data outside production.
