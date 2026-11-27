# Hey Dovo — Build plan for Claude Code

Build in this order. One step = one or more sessions in ONE folder. Start Claude Code inside the folder named, then paste the prompt. Do not start a step until the previous step's acceptance checks pass in CI.

Every prompt below assumes this standard opening, which you can paste first:

> Read `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md` and this folder's `CLAUDE.md`, plus any doc it references. Work only in this folder (and `packages/contracts` if a contract must change — ask first). Give me a plan before writing code. Write tests in the same session. Stop and ask about anything marked [CONFIRM] or unclear.

---

### Step 0 — Repo foundation (root)
> Set up the monorepo: pnpm workspaces + Turborepo, TypeScript strict, `packages/config` (ESLint, Prettier, Vitest, Playwright), empty workspace packages for every folder in the repo map, a Worker template (Hono or plain fetch handler + WorkerEntrypoint RPC, health route, structured logging with correlationId, zod validation helper), and GitHub Actions running typecheck, lint, unit tests, Semgrep, gitleaks, Trivy/Snyk with the CVSS gates from docs/TESTING.md. No business logic.
**Done when:** CI is green on an empty build; the Worker template deploys to dev with `/health`.

### Step 1 — `packages/contracts`
> Create zod schemas for the event envelope, every event and RPC method listed in docs/CONTRACTS.md, the agent tool schemas, common types (Money, E164, Ids, Address, Point, Error), and the EN/FR template keys from docs/CONVERSATION.md. Add valid/invalid fixture tests for each.
**Done when:** 100% schema tests pass; types exported.

### Step 2 — `packages/sdk`
> Build typed RPC clients, REST clients, the Queue event publisher (envelope + idempotency), retry rules (idempotent only), error mapping, and the shared `guards` module (confirmation guard + deterministic YES matcher in EN/FR) with exhaustive tests.
**Done when:** every client and guard has tests, including the YES matcher allow/deny lists.

### Step 3 — `infra` (dev + staging)
> Write Terraform for Cloudflare and Supabase as described in infra/CLAUDE.md for dev and staging only. Schemas and roles per service, extensions, Queues + DLQs, KV, R2, Hyperdrive, AI Gateway, DNS/email records for heydovo.com, WAF/rate limits, Zero Trust app for admin. Checkov clean.
**Done when:** `terraform plan` is clean and applied to dev; each service role can only see its own schema (tested).

### Step 4 — `services/api-gateway`
**Done when:** routing, authz matrix, rate limits and error shape tested.

### Step 5 — `services/auth-security-service`
> Implement OTP, PIN (peppered argon2id, weak-PIN rules, lockout, reset), secure links, staff/vendor session checks, re-verification, exactly per docs/ALGORITHMS.md §7–9 and docs/SECURITY.md. Tests first.
**Done when:** all security tests in its CLAUDE.md pass; argon2id parameters benchmarked within Workers limits.

### Step 6 — `services/user-service`
**Done when:** onboarding states, verified condition, served-area check, consent, export and close-account tested.

### Step 7 — `services/messaging-gateway`
> Telnyx adapters: RCS (with SMS/MMS fallback), SMS, WhatsApp (24 h window + templates), inbound and status webhooks, channel routing, secret masking, opt-outs, dedupe. Voice adapter stub for later. Use Telnyx test numbers.
**Done when:** signature, masking, dedupe, RCS→SMS fallback, WhatsApp window and routing tests pass.

### Step 8 — `services/vendor-service`
**Done when:** PostGIS candidate queries, document expiry job, slots and RLS tested.

### Step 9 — `services/catalogue-quotes-service`
**Done when:** hybrid search (incl. synonyms, French), ranking maths and quote lifecycle tested.

### Step 10 — `packages/ui` + `apps/vendor-portal`
> First import the Figma tokens into an Astryx theme in packages/ui [needs Figma link], then build the vendor portal pages and components listed in its CLAUDE.md.
**Done when:** Playwright + axe pass for every page; role matrix tested.

### Step 11 — `services/wallet-payments-service`
> Tests first: ledger property tests, holds, capture splits, refunds, Stripe webhooks (test mode), limits, reconciliation, payouts Workflow. Implement exactly per docs/ALGORITHMS.md §3, 6, 12, 13.
**Done when:** property tests prove balance and no double posting under retries and concurrency.

### Step 12 — `services/order-booking-service`
**Done when:** every allowed/forbidden transition, Workflows, refunds at each point, split payment and pickup code tested.

### Step 13 — `apps/secure-pages`
**Done when:** every route passes Playwright on WebKit/Chromium/Firefox, EN/FR, axe AA, token abuse cases.

### Step 14 — `services/agent-orchestrator`
> Build the ConversationDO, tool registry with guards from packages/sdk, prompt assembly with untrusted wrapping, OpenAI via AI Gateway (caching off), templated status updates, onboarding flow, vendor command parser, handoff, output filter. Then build the AI evaluation suite.
**Done when:** guard tests pass and the eval suite meets the thresholds in docs/TESTING.md.

### Step 15 — `services/delivery-service`
**Done when:** both adapters pass sandbox contract tests; selection, fallback and fee-absorb rules tested.

### Step 16 — `services/notification-service`
**Done when:** templates, consent gating, email (Cloudflare Email Service) and web push tested.

### Step 17 — `services/reviews-disputes-service`
**Done when:** eligibility, moderation, SLA and refund outcomes tested.

### Step 18 — `services/admin-service` + `apps/admin-portal`
**Done when:** role matrix, audit log on every write, two-person refunds and flags tested.

### Step 19 — `services/analytics-service`
**Done when:** pseudonymisation and metric fixtures tested.

### Step 20 — Voice (`services/messaging-gateway` voice adapter + agent voice session)
> Wire Telnyx Voice AI on the main Hey Dovo number: Telnyx assistant tool webhooks → voice adapter → agent voice session. Spoken YES for summaries; PIN link always by text.
**Done when:** voice E2E flows pass with the Telnyx test setup.

### Step 21 — `services/mcp-connector-service`
**Done when:** MCP conformance, OAuth linking and every tool guard tested; ready for Muse submission.

### Step 22 — Launch readiness (root)
> Run the full E2E suite in staging, load tests, DAST, dependency/CVE scans, chaos tests (provider outages), then produce a launch checklist: [CONFIRM] items resolved, legal review done, FINTRAC/wallet advice received, pen test booked/passed, prod Terraform applied, runbooks in docs/.
**Done when:** no Critical/High findings, all suites green, checklist signed off.
