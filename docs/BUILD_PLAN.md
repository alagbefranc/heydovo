# Hey Dovo — Build plan for Claude Code

Build in this order. One step = one or more sessions in ONE folder. Start Claude Code inside the folder named, then paste the prompt. In a cloud session, which always opens at the repo root, name the folder in your first message instead; Claude reads that folder's `CLAUDE.md` before anything else. Do not start a step until the previous step's acceptance checks pass in CI.

Every prompt below assumes this standard opening, which you can paste first:

> Read `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md` and this folder's `CLAUDE.md`, plus any doc it references. Work only in this folder (and `packages/contracts` if a contract must change — ask first). Give me a plan before writing code. Write tests in the same session. Stop and ask about anything marked [CONFIRM] or unclear.

Each prompt has two parts: the main build, and "Also in this step", which lists the items added on 2026-11-27. Both parts are in scope, and "Done when" covers both. The design behind the added items is in docs/ALGORITHMS.md §17–24 and each folder's "Added scope".

## Building against things that do not exist yet
The order keeps direct (RPC) calls pointing at services from earlier steps wherever possible. A few things still point forward:
- api-gateway routes to every service;
- every service reads settings, flags and launch regions that admin-service will own (read them from the KV cache, which infra seeds with the defaults in docs/ALGORITHMS.md);
- events arrive from services built later;
- staff approvals are checked by auth-security from step 12 on, but the admin portal that creates them arrives in step 19;
- auth-security looks up a sender through user-service for the secret-exposure check, and a number's SIM-change status through messaging-gateway.

In those cases, build and test against the typed fakes in `packages/sdk`, and list them under "Fakes in use" in the folder's `CLAUDE.md`. The later step is not done until it has replaced those fakes with real integration tests.

## In every service step
These apply to each service without being repeated below:
- Low friction first (root CLAUDE.md, "Product principle"): a step that adds a code, a confirmation or a link must say why.
- Each calling Worker gets its own entry point. wallet-payments-service and auth-security-service follow their allowed-caller tables, and the CI check of bindings and Queue producers must pass.
- An erasure consumer and a daily retention job for the personal data the service holds, both tested (docs/ALGORITHMS.md §22).
- English and French for every message the step adds, as template keys in `packages/contracts`.
- Any new door for a person's words uses the shared masking module (docs/ALGORITHMS.md §23).

## The launch track
Work that is not code (legal drafts, provider approvals, tax and privacy sign-offs, accounts, monitoring, backups) is in docs/LAUNCH.md, with an owner and a start point for each. Two of them gate steps here: the legal drafts before step 4, and starting the provider approvals right after it.

---

### Step 0 — Repo foundation (root)
> Set up the monorepo: pnpm workspaces + Turborepo, TypeScript strict, `packages/config` (ESLint, Prettier, Vitest, Playwright), empty workspace packages for every folder in the repo map, a Worker template (Hono or plain fetch handler + WorkerEntrypoint RPC, health route, structured logging with correlationId, zod validation helper), and GitHub Actions running typecheck, lint, unit tests, Semgrep, gitleaks, Trivy/Snyk with the CVSS gates from docs/TESTING.md. No business logic.
**Done when:** CI is green on an empty build; the Worker template deploys to dev with `/health`.

### Step 1 — `packages/contracts`
> Create zod schemas for the event envelope, every event and RPC method listed in docs/CONTRACTS.md, the agent tool schemas, common types (Money, E164, Ids, Address, Point, Error), and the EN/FR template keys from docs/CONVERSATION.md. Add valid/invalid fixture tests for each.
>
> Also in this step:
> - Everything under "Added contracts" in docs/CONTRACTS.md, including `closeWallet`, `getVendorStatement`, `getCheckoutUrl`, staff approvals, blocks and the review, erasure and chargeback events.
> - Mark every RPC method `internal` or `web-facing`.
> - `actor.via` on vendor actions.
> - The vendor templates, each in a rich form (buttons) and a complete plain-text form that states the typed reply, and English and French copy for every new customer and vendor flow.

**Done when:** 100% schema tests pass; types exported; every method is marked internal or web-facing; every template key has English and French, and every vendor template has both forms.

### Step 2 — `packages/sdk`
> Build typed RPC clients, REST clients, the Queue event publisher (envelope + idempotency), retry rules (idempotent only), error mapping, a typed fake for every client (used by steps that build ahead of a dependency), and the shared `guards` module (confirmation guard + deterministic YES matcher in EN/FR) with exhaustive tests.
>
> Also in this step:
> - `guards`: forgiving matching for vendor commands and reply codes (docs/ALGORITHMS.md §17) and the cancel guard.
> - `masking`: the rules and decision table of docs/ALGORITHMS.md §15 as one shared module, with spoken-digit normalisation in English and French (§23).
> - The `checkSecretExposure` client never retries and never attaches its arguments to errors, logs or traces.

**Done when:** every client, fake and guard has tests, including the YES matcher allow/deny lists, the vendor command tables (case, accents, spacing, code before or after the word, code alone, French words, wrong characters) and every row of the §15 decision table.

### Step 3 — `infra` (dev + staging)
> Write Terraform for Cloudflare and Supabase as described in infra/CLAUDE.md for dev and staging only. Schemas and roles per service, extensions, Queues + DLQs, KV (seeded with the default settings), R2, Hyperdrive (one config per service role, query caching off), AI Gateway, DNS/email records, hostnames and Worker routes for heydovo.com, the service-binding allow-list with its CI check, WAF/rate limits, Zero Trust app for admin. Checkov clean.
>
> Also in this step:
> - The allow-list and its CI check cover Queue producers as well as service bindings, for wallet-payments-service and auth-security-service, entrypoint by entrypoint.
> - No role passwords or other secrets in Terraform state, plan output or CI logs: a rotation job outside Terraform sets them, state is remote, encrypted and locked, and CI scans plan output (docs/SECURITY.md, Infrastructure).
> - Monitoring baseline and alerts, uptime checks on every `/health`, log retention of 90 days at most.
> - Backups: point-in-time recovery where the plan allows, R2 versioning, and one rehearsed restore in staging.
> - Rotation runbooks for database role passwords and provider tokens.
> - Terraform as modules with per-environment variables, and GitHub environments dev, staging and prod, so production in step 23 is a new workspace, not new code.

**Done when:** `terraform plan` is clean and applied to dev; each service role can only see its own schema (tested); the CI check fails on an unlisted binding and on an unlisted Queue producer (tested); state and plan output contain no secrets (scanned); a restore has been rehearsed in staging; a test alert reaches the on-call contact.

**Before step 4:** the legal drafts are updated with the 2026-11-27 decisions and approved (docs/LAUNCH.md). The website cannot ship placeholder legal pages.

### Step 4 — `packages/ui` + `apps/website`
> First import the Figma tokens into an Astryx theme in packages/ui [needs Figma link] and build the base components. Then build apps/website as described in its CLAUDE.md: landing page, `/start`, the legal pages from the approved drafts, `security.txt`, EN/FR. If a landing page already exists, bring it in instead of designing a new one [CONFIRM where it lives].
>
> Also in this step:
> - Each legal page shows its version and effective date, and those versions are the ones user-service will record as consent.

**Done when:** Playwright + axe pass for every page (mobile + desktop, EN/FR); `/start` opens the right link per device; `security.txt` is valid; the site is live on dev; the legal pages carry the approved text and versions.

**Right after step 4:** start every provider approval in docs/LAUNCH.md the day the site is live (RCS, SMS sender, WhatsApp verification and templates, Stripe, Uber Direct, Supabase production). They take weeks and later steps wait on them.

### Step 5 — `services/api-gateway`
> Build the gateway Worker: session checks (vendor and staff JWTs through auth-security, secure-page requests by link token), the `/api/<service>/<action>` routing table as an explicit allow-list of the methods `packages/contracts` marks as web-facing, zod body validation, rate limits (stricter on auth, PIN, OTP and payment routes), correlationId, CORS for our app origins only, security headers and the standard error shape. No business logic and no database. Services that do not exist yet are sdk fakes.
>
> Also in this step:
> - A session token is forwarded only to auth-security and to the wallet's proof-based methods, never to any other service.
> - Routes for the `not_me`, `muse_link` and `clients` pages.

**Done when:** routing, authz matrix, rate limits and error shape tested; a test proves no internal method is routable and no other service ever receives a session token.

### Step 6 — `services/auth-security-service`
> Implement OTP, PIN (peppered argon2id, weak-PIN rules, lockout, reset), secure links with one-time PIN approvals, the spending hold after a PIN reset, action codes for SMS commands, staff/vendor session checks, re-verification and the secret-exposure check, exactly per docs/ALGORITHMS.md §7–9, §14 and §15 and docs/SECURITY.md. Tests first.
>
> Also in this step:
> - The allowed-caller table in this folder's CLAUDE.md, one entrypoint per caller.
> - Actions with a code and a button token, voided when the step ends by any door; the per-number command state (step-up, coded lock) (docs/ALGORITHMS.md §17).
> - Every block in docs/ALGORITHMS.md §18: "this wasn't me" freeze, `liftBlock` with the staff session as proof, the cap that cannot be lifted.
> - Staff approvals: `approveStaffAction` and `redeemStaffApprovals` (docs/ALGORITHMS.md §20).
> - Meta Muse linking rules (docs/ALGORITHMS.md §24) and `pepper_version` for pepper rotation.
> - "Fakes in use" lists user-service's lookup (until step 7) and messaging-gateway's `lookupNumber` (until step 8).

**Done when:** all security tests in its CLAUDE.md pass, including every row of the caller table, the command table and the block table; argon2id parameters benchmarked within Workers limits; both fakes are listed.

### Step 7 — `services/user-service`
> Build customer accounts as described in this folder's CLAUDE.md: pending users, profile, addresses (geocoding and the served-area check against launch regions), consents with versions, onboarding progress (docs/ALGORITHMS.md §10), the verified condition, WhatsApp BSUID linking, data export and account closing.
>
> Also in this step:
> - Erasure coordination: `user.closed`, tracking every service's `privacy.erasure_completed`, overdue review items, legal holds, the 30-day deadline (docs/ALGORITHMS.md §22).
> - Closing an account uses `wallet.closeWallet` with the owner's link token as proof.
> - No address or profile changes while the account is Frozen.

**Done when:** onboarding states, verified condition, served-area check, consent, export and close-account tested; erasure is tracked to completion and flagged when overdue; auth-security's user lookup fake replaced.

### Step 8 — `services/messaging-gateway`
> Telnyx adapters: RCS (with SMS/MMS fallback), SMS, WhatsApp (24 h window + templates), inbound and status webhooks, channel routing, secret masking with the auth-security exposure check (docs/ALGORITHMS.md §15), opt-outs, dedupe. Voice adapter stub for later. Use Telnyx test numbers.
>
> Also in this step:
> - `lookupNumber` (Telnyx Number Lookup), and swap auth-security's fake for the real call.
> - Stored copies of outbound messages mask pickup codes, reply codes and link tokens.
> - Vendor templates and buttons on WhatsApp and RCS; the plain-text form always states the typed reply and, where needed, the reply code, so an RCS message that falls back to SMS is still complete.
> - Masking covers captions, location labels, contact cards and button free text.
> - Erasure consumer and the 12-month retention job for message text and media; opt-outs kept as a hash.

**Done when:** signature, masking (including ordinary numbers that must pass through, and captions), dedupe, RCS→SMS fallback with the reply code present, WhatsApp window, vendor buttons and routing tests pass; no stored outbound text contains a pickup code, reply code or link token; `lookupNumber` works against the sandbox and auth-security's fake is gone; erasure and retention jobs tested.

### Step 9 — `services/vendor-service`
> Build vendor applications, documents (presigned R2 uploads, the expiry job), locations, hours and closures, service areas, calendar slots, staff and `listCandidates` with PostGIS, as described in this folder's CLAUDE.md. Follow its RLS rules exactly.
>
> Also in this step:
> - Staff phone verification by OTP, and the rules for verifying again (docs/ALGORITHMS.md §17).
> - Who gets alerts: the on-duty list per location and `getAlertRecipients`.
> - Pause and resume with `actor.via`, owner and manager only.
> - Seller details for CRA platform reporting, if the accountant confirms it applies (docs/LAUNCH.md): collected at onboarding, tax number encrypted and finance-only.

**Done when:** PostGIS candidate queries, document expiry job, slots and RLS (including the tests in its CLAUDE.md) tested; staff phone verification, alert recipients and role limits tested; the CRA question is answered in docs/LAUNCH.md and built or explicitly not needed.

### Step 10 — `services/delivery-service`
> Build the provider-neutral `DeliveryProvider` interface with the Uber Direct adapter against its sandbox (the only courier at launch), quotes with the selection and fallback rules (docs/ALGORITHMS.md §11), booking that returns the booked fee, cancellation, re-quotes with the fee-absorb rule, and verified, deduped webhooks.
>
> Also in this step:
> - Every quote reports when it expires; an expired quote is never reused; a re-quote is always fresh (docs/ALGORITHMS.md §19).
> - Confirm how long an Uber Direct quote is valid and record it in docs/OPEN_ITEMS.md.

**Done when:** the Uber Direct adapter passes sandbox contract tests; selection, fallback (self-delivery, then pickup) and fee-absorb rules tested; quote expiry and fresh re-quotes tested.

### Step 11 — `services/catalogue-quotes-service`
> Build products, services, bulk upload, hybrid search (full-text EN/FR + pgvector merged with RRF, synonyms), embedding jobs on a Queue, the ranking algorithm (docs/ALGORITHMS.md §1–2) using vendor-service and delivery-service, and the quote lifecycle.

**Done when:** hybrid search (incl. synonyms, French), ranking maths and quote lifecycle tested; quote requests and their photos are covered by erasure.

### Step 12 — `services/wallet-payments-service`
> Tests first: ledger property tests, holds, capture splits (including the tax and delivery-subsidy lines), refunds, Stripe webhooks (test mode), limits, reconciliation, payouts Workflow and the allowed-caller table. Implement exactly per docs/ALGORITHMS.md §3, 6, 12, 13.
>
> Also in this step:
> - No wallet hold without a PIN approval redeemed with auth-security (docs/ALGORITHMS.md §8).
> - A refund decided by a person carries staff approval ids, redeemed before anything moves; rule-based refunds are bounded by the held or captured amount (docs/ALGORITHMS.md §20).
> - `closeWallet`, `getVendorStatement`, `getCheckoutUrl`.
> - Chargebacks: the case, the reserve, evidence submission with a staff approval, both outcomes (docs/ALGORITHMS.md §21).
> - Amounts paid and fees per vendor per quarter, for the yearly seller report if it applies.

**Done when:** property tests prove balance and no double posting under retries and concurrency; each wallet entrypoint exposes only its caller's methods, and the CI binding check passes; a hold without a redeemed approval and a person-decided refund without valid approvals both fail; wallet closing, statements, Checkout URLs and chargebacks tested.

### Step 13 — `services/order-booking-service`
> Tests first for the state machines. Build drafts with live price, stock and delivery re-checks, fees and summaryHash (docs/ALGORITHMS.md §3–5), `requestConfirmation`, the payment plan (wallet PIN link and/or payment link), `OrderWorkflow` and `BookingWorkflow`, vendor actions, pickup codes, substitutions, cancellations and refunds (§12).
>
> Also in this step:
> - After a PIN reset, `getSpendAllowance` decides the split between wallet and payment link when the draft is built, so the summary already shows it.
> - The delivery subsidy line in both directions; the customer always pays the fee shown.
> - The pickup code leaves this service once, in `order.ready`, and is stored only as a hash.
> - One order state, several doors (docs/ALGORITHMS.md §17): `actor.via` on every vendor action, first action wins, and the state returned to a late or second actor says who acted, how and when.
> - Delivery quotes (docs/ALGORITHMS.md §19): the 15-minute quote against the 30-minute summary, re-quote at confirmation and at booking, the absorb cap per order, the over-cap decision by staff, booking anyway after the decision time.
> - Dispute-outcome refunds pass on the staff approval ids.

**Done when:** every allowed/forbidden transition, Workflows, refunds at each point, split payment (including after a PIN reset) and pickup code tested; two staff acting at once through different doors and a reply after timeout tested; every over-cap path tested; the pickup code appears in no stored field and no event except `order.ready`.

### Step 14 — `apps/secure-pages`
> Build `/l/[token]` and every purpose page in this folder's CLAUDE.md (setup, PIN approve, PIN reset, top-up, pay link, track, privacy request) with the components listed, EN/FR, strict CSP and Turnstile on every POST. Link to the legal pages in apps/website.
>
> Also in this step:
> - The PIN reset page ends with the notice that wallet spending is limited for 24 hours.
> - The tracking page never shows a pickup code.
> - New pages: Not me (one button), Muse link (OTP, then PIN, then what the client may do), Clients (list and unlink).
> - A PIN approve page opened for a Muse-started order shows the full summary and an explicit Approve step.
> - A clear Frozen state on every page.

**Done when:** every route passes Playwright on WebKit/Chromium/Firefox, EN/FR, axe AA, token abuse cases; tests prove the 24-hour notice is shown and that the tracking page never shows a pickup code for any order type or state; the three new pages tested.

### Step 15 — `services/reviews-disputes-service`
> Build reviews (one per completed order, one vendor reply, moderation), disputes (policy windows, vendor response window, SLA timers, evidence in R2) and resolution outcomes that emit `dispute.resolved`.
>
> Also in this step:
> - A resolution that refunds records the staff approval ids and carries them in `dispute.resolved`.

**Done when:** eligibility, moderation, SLA and refund outcomes tested; a refund outcome without the approvals its amount needs is refused.

### Step 16 — `services/agent-orchestrator`
> Build the ConversationDO, tool registry with guards from packages/sdk, prompt assembly with untrusted wrapping, OpenAI via AI Gateway (caching off), templated status updates, onboarding flow, vendor command parser, handoff, output filter. Then build the AI evaluation suite.
>
> Also in this step:
> - Vendor commands (docs/ALGORITHMS.md §17): forgiving matching from the sdk, a re-prompt for READY and other coded commands sent without their code, the command state read from auth-security (none kept in the Durable Object), an answer to every command including late ones, and the "which do you mean" question for a number that is both staff and customer.
> - "This wasn't me": the button and the link, never a typed command; how a Frozen account behaves (docs/ALGORITHMS.md §18).
> - The reply filter that lets real addresses, totals and refs through and blocks secret-looking and invented numbers (docs/ALGORITHMS.md §23).
> - `UNLINK` for Meta Muse clients.
> - English and French copy for every new flow, and evals for each (the list is in this folder's "Added scope").
> - Erasure and the 12-month retention job for conversation state, summaries and agent logs.

**Done when:** guard tests pass and the eval suite meets the thresholds in docs/TESTING.md, including the new flows in English and French; the reply filter tests pass (address with a unit number, postal code, totals, an invented number, digits after "PIN"); the dual-role routing table tested; erasure and retention tested.

### Step 17 — `services/notification-service`
> Build vendor alerts, emails through Cloudflare Email Service, web push for the portals, EN/FR templates from packages/contracts, preferences, quiet hours, CASL consent gating and bounce handling.
>
> Also in this step:
> - Vendor alerts with Accept / Decline and Mark ready buttons on WhatsApp and RCS, the typed reply always written out, and a reply code only where docs/ALGORITHMS.md §14 needs one.
> - Recipients from vendor-service's on-duty list, one action per recipient, a reminder at half the accept time.
> - The PIN-reset email, and the other security emails, each with a "This wasn't me" link.

**Done when:** templates, consent gating, email (Cloudflare Email Service) and web push tested; vendor alerts tested per channel (buttons, plain replies, a code only where needed); the PIN-reset email and its link tested.

### Step 18 — `apps/vendor-portal`
> Build the vendor portal pages and components listed in its CLAUDE.md on the packages/ui theme, with Supabase Auth and mandatory 2FA, the role-based UI and the live inbox.
>
> Also in this step:
> - Text and dashboard are the same orders: an action by text shows in the open dashboard at once; timelines say who did each step and how; the activity log lists text commands; the Security page shows when text commands are paused for a number.
> - Phone verification for text commands, and the on-duty list per location.
> - A short "Running orders by text" help page.
> - Statements through `wallet.getVendorStatement`, owner only.

**Done when:** Playwright + axe pass for every page; role matrix tested; an action by text appears in the open dashboard without a reload; two people acting at once handled; phone verification and the on-duty list tested.

### Step 19 — `services/admin-service` + `apps/admin-portal`
> First admin-service: settings, feature flags, launch regions, refund approvals (two-person rule), takeover sessions and the append-only audit log, acting on the platform only through each owning service's API. Replace the seeded KV settings and the refund-approval fakes used by earlier steps. Then build the admin portal pages and components listed in its CLAUDE.md.
>
> Also in this step:
> - Refund approvals are staff approvals recorded by auth-security from the staff member's own session; admin-service only passes the ids on (docs/ALGORITHMS.md §20).
> - The review queue, lifting a block and the "this wasn't me" cases (docs/ALGORITHMS.md §18).
> - Chargeback evidence: gather, store, submit (docs/ALGORITHMS.md §21).
> - The delivery subsidy review page and the over-cap decisions (docs/ALGORITHMS.md §19).
> - Erasure requests view; the yearly seller report if it applies (docs/LAUNCH.md).

**Done when:** role matrix, audit log on every write, two-person refunds and flags tested; earlier steps' settings and approval fakes replaced; a refund or a lift attempted without valid approvals fails; each review kind opens, is assigned and resolves; the subsidy report matches ledger fixtures; chargeback evidence submitted against Stripe test mode.

### Step 20 — `services/analytics-service`
> Build the fan-out consumer for business events, HMAC pseudonymisation of user and vendor ids, the metrics listed in this folder's CLAUDE.md, handling of late and duplicate events, and retention jobs.

**Done when:** pseudonymisation and metric fixtures tested, including net delivery subsidy and orders over the cap.

### Step 21 — Voice (`services/messaging-gateway` voice adapter + agent voice session)
> Wire Telnyx Voice AI on the main Hey Dovo number: Telnyx assistant tool webhooks → voice adapter → agent voice session. Spoken YES for summaries; PIN link always by text.
>
> Also in this step:
> - Mask transcripts and tool arguments in the voice adapter with the shared module, after normalising spoken digits in English and French (docs/ALGORITHMS.md §23).
> - The Telnyx assistant never asks for a PIN, OTP or card; recording off and Telnyx-side transcript retention at the minimum [CONFIRM Telnyx controls].

**Done when:** voice E2E flows pass with the Telnyx test setup; a PIN spoken on a call is masked before storage and forces a reset; nothing spoken on a call is stored unmasked.

### Step 22 — `services/mcp-connector-service`
> Build the remote MCP server on Cloudflare's MCP support [CONFIRM packages], OAuth 2.1 + PKCE account linking, and the tools listed in this folder's CLAUDE.md, using the same sdk clients and guards as agent-orchestrator. Prepare the Muse submission checklist.
>
> Also in this step:
> - Linking beyond phone OTP: OTP and the wallet PIN on our secure page, refused under any block, the owner told with "This wasn't me", and a 24-hour $50 cap for a new client (docs/ALGORITHMS.md §24).
> - No PIN, payment or top-up link is ever returned to Muse: Dovo texts it to the owner's phone and the tool returns a status.
> - Every string argument goes through the shared masking module.

**Done when:** MCP conformance, OAuth linking and every tool guard tested; no tool response contains a `heydovo.com/l/` link; linking is refused under each block; arguments are masked; ready for Muse submission.

### Step 23 — Launch readiness (root)
> Run the full E2E suite in staging, load tests, DAST, dependency/CVE scans, chaos tests (provider outages), then produce a launch checklist: [CONFIRM] items resolved, legal review done, FINTRAC/wallet advice received, pen test booked/passed, prod Terraform applied, runbooks in docs/. Confirm no "Fakes in use" entry is left in any folder's CLAUDE.md.
>
> Also in this step, check every line of docs/LAUNCH.md:
> - Privacy impact assessment signed, privacy officer named, processor terms in place, and the breach response runbook rehearsed once.
> - Production accounts and Terraform: accounts with named owners and 2FA, production applied through CI with manual approval, no secrets in state.
> - Backups: a timed restore drill that meets the recovery targets. Rotation: one full rotation rehearsed.
> - Monitoring live in production with a named on-call contact and a test alert.
> - Provider approvals complete; legal pages final; the CRA reporting answer acted on.

**Done when:** no Critical/High findings, all suites green, every line of docs/LAUNCH.md done or explicitly waived by you, checklist signed off.
