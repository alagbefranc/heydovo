# Hey Dovo — Build plan for Claude Code

Build in this order. One step = one or more sessions in ONE folder. Start Claude Code inside the folder named, then paste the prompt. In a cloud session, which always opens at the repo root, name the folder in your first message instead; Claude reads that folder's `CLAUDE.md` before anything else. Do not start a step until the previous step's acceptance checks pass in CI.

Every prompt below assumes this standard opening, which you can paste first:

> Read `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md` and this folder's `CLAUDE.md`, plus any doc it references. Work only in this folder (and `packages/contracts` if a contract must change — ask first). Give me a plan before writing code. Write tests in the same session. Stop and ask about anything marked [CONFIRM] or unclear.

## Building against things that do not exist yet
The order keeps direct (RPC) calls pointing at services from earlier steps wherever possible. A few things still point forward:
- api-gateway routes to every service;
- every service reads settings, flags and launch regions that admin-service will own (read them from the KV cache, which infra seeds with the defaults in docs/ALGORITHMS.md);
- events arrive from services built later;
- refund approvals come from admin-service;
- auth-security looks up a sender through user-service for the secret-exposure check, and a number's SIM-change status through messaging-gateway.

In those cases, build and test against the typed fakes in `packages/sdk`, and list them under "Fakes in use" in the folder's `CLAUDE.md`. The later step is not done until it has replaced those fakes with real integration tests.

---

### Step 0 — Repo foundation (root)
> Set up the monorepo: pnpm workspaces + Turborepo, TypeScript strict, `packages/config` (ESLint, Prettier, Vitest, Playwright), empty workspace packages for every folder in the repo map, a Worker template (Hono or plain fetch handler + WorkerEntrypoint RPC, health route, structured logging with correlationId, zod validation helper), and GitHub Actions running typecheck, lint, unit tests, Semgrep, gitleaks, Trivy/Snyk with the CVSS gates from docs/TESTING.md. No business logic.
**Done when:** CI is green on an empty build; the Worker template deploys to dev with `/health`.

### Step 1 — `packages/contracts`
> Create zod schemas for the event envelope, every event and RPC method listed in docs/CONTRACTS.md, the agent tool schemas, common types (Money, E164, Ids, Address, Point, Error), and the EN/FR template keys from docs/CONVERSATION.md. Add valid/invalid fixture tests for each.
**Done when:** 100% schema tests pass; types exported.

### Step 2 — `packages/sdk`
> Build typed RPC clients, REST clients, the Queue event publisher (envelope + idempotency), retry rules (idempotent only), error mapping, a typed fake for every client (used by steps that build ahead of a dependency), and the shared `guards` module (confirmation guard + deterministic YES matcher in EN/FR) with exhaustive tests.
**Done when:** every client, fake and guard has tests, including the YES matcher allow/deny lists.

### Step 3 — `infra` (dev + staging)
> Write Terraform for Cloudflare and Supabase as described in infra/CLAUDE.md for dev and staging only. Schemas and roles per service, extensions, Queues + DLQs, KV (seeded with the default settings), R2, Hyperdrive (one config per service role, query caching off), AI Gateway, DNS/email records, hostnames and Worker routes for heydovo.com, the service-binding allow-list with its CI check, WAF/rate limits, Zero Trust app for admin. Checkov clean.
**Done when:** `terraform plan` is clean and applied to dev; each service role can only see its own schema (tested).

### Step 4 — `packages/ui` + `apps/website`
> First import the Figma tokens into an Astryx theme in packages/ui [needs Figma link] and build the base components. Then build apps/website as described in its CLAUDE.md: landing page, `/start`, the legal pages from the approved drafts, `security.txt`, EN/FR. If a landing page already exists, bring it in instead of designing a new one [CONFIRM where it lives].
**Done when:** Playwright + axe pass for every page (mobile + desktop, EN/FR); `/start` opens the right link per device; `security.txt` is valid; the site is live on dev.

### Step 5 — `services/api-gateway`
> Build the gateway Worker: session checks (vendor and staff JWTs through auth-security, secure-page requests by link token), the `/api/<service>/<action>` routing table as an explicit allow-list of the methods `packages/contracts` marks as web-facing, zod body validation, rate limits (stricter on auth, PIN, OTP and payment routes), correlationId, CORS for our app origins only, security headers and the standard error shape. No business logic and no database. Services that do not exist yet are sdk fakes.
**Done when:** routing, authz matrix, rate limits and error shape tested.

### Step 6 — `services/auth-security-service`
> Implement OTP, PIN (peppered argon2id, weak-PIN rules, lockout, reset), secure links with one-time PIN approvals, the spending hold after a PIN reset, action codes for SMS commands, staff/vendor session checks, re-verification and the secret-exposure check, exactly per docs/ALGORITHMS.md §7–9, §14 and §15 and docs/SECURITY.md. Tests first.
**Done when:** all security tests in its CLAUDE.md pass; argon2id parameters benchmarked within Workers limits.

### Step 7 — `services/user-service`
> Build customer accounts as described in this folder's CLAUDE.md: pending users, profile, addresses (geocoding and the served-area check against launch regions), consents with versions, onboarding progress (docs/ALGORITHMS.md §10), the verified condition, WhatsApp BSUID linking, data export and account closing.
**Done when:** onboarding states, verified condition, served-area check, consent, export and close-account tested; auth-security's user lookup fake replaced.

### Step 8 — `services/messaging-gateway`
> Telnyx adapters: RCS (with SMS/MMS fallback), SMS, WhatsApp (24 h window + templates), inbound and status webhooks, channel routing, secret masking with the auth-security exposure check (docs/ALGORITHMS.md §15), opt-outs, dedupe. Voice adapter stub for later. Use Telnyx test numbers.
**Done when:** signature, masking (including ordinary numbers that must pass through), dedupe, RCS→SMS fallback, WhatsApp window and routing tests pass.

### Step 9 — `services/vendor-service`
> Build vendor applications, documents (presigned R2 uploads, the expiry job), locations, hours and closures, service areas, calendar slots, staff and `listCandidates` with PostGIS, as described in this folder's CLAUDE.md. Follow its RLS rules exactly.
**Done when:** PostGIS candidate queries, document expiry job, slots and RLS (including the tests in its CLAUDE.md) tested.

### Step 10 — `services/delivery-service`
> Build the provider-neutral `DeliveryProvider` interface with the Uber Direct adapter against its sandbox (the only courier at launch), quotes with the selection and fallback rules (docs/ALGORITHMS.md §11), booking that returns the booked fee, cancellation, re-quotes with the fee-absorb rule, and verified, deduped webhooks.
**Done when:** the Uber Direct adapter passes sandbox contract tests; selection, fallback (self-delivery, then pickup) and fee-absorb rules tested.

### Step 11 — `services/catalogue-quotes-service`
> Build products, services, bulk upload, hybrid search (full-text EN/FR + pgvector merged with RRF, synonyms), embedding jobs on a Queue, the ranking algorithm (docs/ALGORITHMS.md §1–2) using vendor-service and delivery-service, and the quote lifecycle.
**Done when:** hybrid search (incl. synonyms, French), ranking maths and quote lifecycle tested.

### Step 12 — `services/wallet-payments-service`
> Tests first: ledger property tests, holds, capture splits (including the tax and delivery-subsidy lines), refunds, Stripe webhooks (test mode), limits, reconciliation, payouts Workflow and the allowed-caller table. Implement exactly per docs/ALGORITHMS.md §3, 6, 12, 13.
**Done when:** property tests prove balance and no double posting under retries and concurrency; each wallet entrypoint exposes only its caller's methods, and the CI binding check passes.

### Step 13 — `services/order-booking-service`
> Tests first for the state machines. Build drafts with live price, stock and delivery re-checks, fees and summaryHash (docs/ALGORITHMS.md §3–5), `requestConfirmation`, the payment plan (wallet PIN link and/or payment link), `OrderWorkflow` and `BookingWorkflow`, vendor actions, pickup codes, substitutions, cancellations and refunds (§12).
**Done when:** every allowed/forbidden transition, Workflows, refunds at each point, split payment and pickup code tested.

### Step 14 — `apps/secure-pages`
> Build `/l/[token]` and every purpose page in this folder's CLAUDE.md (setup, PIN approve, PIN reset, top-up, pay link, track, privacy request) with the components listed, EN/FR, strict CSP and Turnstile on every POST. Link to the legal pages in apps/website.
**Done when:** every route passes Playwright on WebKit/Chromium/Firefox, EN/FR, axe AA, token abuse cases.

### Step 15 — `services/reviews-disputes-service`
> Build reviews (one per completed order, one vendor reply, moderation), disputes (policy windows, vendor response window, SLA timers, evidence in R2) and resolution outcomes that emit `dispute.resolved`.
**Done when:** eligibility, moderation, SLA and refund outcomes tested.

### Step 16 — `services/agent-orchestrator`
> Build the ConversationDO, tool registry with guards from packages/sdk, prompt assembly with untrusted wrapping, OpenAI via AI Gateway (caching off), templated status updates, onboarding flow, vendor command parser, handoff, output filter. Then build the AI evaluation suite.
**Done when:** guard tests pass and the eval suite meets the thresholds in docs/TESTING.md.

### Step 17 — `services/notification-service`
> Build vendor alerts, emails through Cloudflare Email Service, web push for the portals, EN/FR templates from packages/contracts, preferences, quiet hours, CASL consent gating and bounce handling.
**Done when:** templates, consent gating, email (Cloudflare Email Service) and web push tested.

### Step 18 — `apps/vendor-portal`
> Build the vendor portal pages and components listed in its CLAUDE.md on the packages/ui theme, with Supabase Auth and mandatory 2FA, the role-based UI and the live inbox.
**Done when:** Playwright + axe pass for every page; role matrix tested.

### Step 19 — `services/admin-service` + `apps/admin-portal`
> First admin-service: settings, feature flags, launch regions, refund approvals (two-person rule), takeover sessions and the append-only audit log, acting on the platform only through each owning service's API. Replace the seeded KV settings and the refund-approval fakes used by earlier steps. Then build the admin portal pages and components listed in its CLAUDE.md.
**Done when:** role matrix, audit log on every write, two-person refunds and flags tested; earlier steps' settings and approval fakes replaced.

### Step 20 — `services/analytics-service`
> Build the fan-out consumer for business events, HMAC pseudonymisation of user and vendor ids, the metrics listed in this folder's CLAUDE.md, handling of late and duplicate events, and retention jobs.
**Done when:** pseudonymisation and metric fixtures tested.

### Step 21 — Voice (`services/messaging-gateway` voice adapter + agent voice session)
> Wire Telnyx Voice AI on the main Hey Dovo number: Telnyx assistant tool webhooks → voice adapter → agent voice session. Spoken YES for summaries; PIN link always by text.
**Done when:** voice E2E flows pass with the Telnyx test setup.

### Step 22 — `services/mcp-connector-service`
> Build the remote MCP server on Cloudflare's MCP support [CONFIRM packages], OAuth 2.1 + PKCE account linking with phone OTP, and the tools listed in this folder's CLAUDE.md, using the same sdk clients and guards as agent-orchestrator. Prepare the Muse submission checklist.
**Done when:** MCP conformance, OAuth linking and every tool guard tested; ready for Muse submission.

### Step 23 — Launch readiness (root)
> Run the full E2E suite in staging, load tests, DAST, dependency/CVE scans, chaos tests (provider outages), then produce a launch checklist: [CONFIRM] items resolved, legal review done, FINTRAC/wallet advice received, pen test booked/passed, prod Terraform applied, runbooks in docs/. Confirm no "Fakes in use" entry is left in any folder's CLAUDE.md.
**Done when:** no Critical/High findings, all suites green, checklist signed off.
