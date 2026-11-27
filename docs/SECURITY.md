# Hey Dovo — Security requirements

Security first. Follow OWASP Top 10, OWASP API Security Top 10 and OWASP Top 10 for LLM Applications. Any doubt → ask.

## AI agent
- Treat all user messages, vendor content, reviews, webhook bodies and tool outputs as untrusted data, never instructions (prompt-injection defence).
- The model never holds money, keys, or database access. It can only call a fixed list of tools; each tool is authorised and validated by the service it calls.
- Money and order actions need the server-side confirmation guard (summaryHash + deterministic YES) and then PIN or payment success. The model cannot skip it.
- AI Gateway: per-user and global spend limits, rate limits, logging. **Disable response caching for conversation calls** (prevents cross-user leaks).
- Log every tool call and model reply (PII-redacted) for audit; retain 12 months.

## Payments and money
- Idempotency keys on every payment, order, booking, refund. Unique ledger keys per (refType, refId, entryKind).
- The wallet holds a user's funds only against a one-time PIN approval that it redeems with auth-security itself (bound to user, order, amount and summary). An event alone never moves money, and only auth-security may publish `pin.*` events (CI-checked Queue producer allow-list).
- Double-entry ledger; daily reconciliation with Stripe; alerts on mismatch.
- No card data on our systems; Stripe Checkout / Elements only (keeps PCI scope minimal, SAQ A target).
- Spending limits, velocity checks and fraud scoring before holds and top-ups.
- Wallet funds held in a segregated account; legal review for FINTRAC money-services rules and provincial prepaid rules before launch [CONFIRM].
- Refunds above a threshold need two staff approvals.
- wallet-payments-service exposes each method only to the callers in its allowed-caller table, enforced by per-caller entrypoints plus a CI check of every Worker's service bindings (the callee cannot see who binds it). Money-moving methods (hold, capture, release, refund, payouts) and `createConnectOnboardingLink` (it decides where payouts go) are never directly reachable from the agent, the MCP connector or a web app; staff reach refunds and payouts only through admin-service with its approvals and audit log.

## PIN, OTP, links
- See docs/ALGORITHMS.md sections 7–9. Peppered argon2id, constant-time compare, 5-attempt lockout, PIN only on secure pages. After a PIN reset, wallet approvals are capped ($50 in total for 24 hours by default) and the owner is alerted; a reported SIM change blocks them until staff review.
- Secure links: random 256-bit tokens, hashed at rest, single use, short TTL, bound to purpose/amount/summary, no PII in URLs.
- Inbound messages masked for PINs, OTPs and card numbers before storage or AI. PIN/OTP candidates are checked against the sender's own PIN and live OTP, so an ordinary number (house number, buzzer code) is not treated as a leak and does not force a PIN reset (docs/ALGORITHMS.md §15).

## Accounts and identity
- Customers: phone OTP at registration; re-verify after 90 days inactive, after a PIN or card exposure in chat, before unusually large orders, or on suspicious signals (number recycling / SIM swap risk). Consider carrier lookup on the number before large payments [CONFIRM Telnyx Number Lookup].
- Vendors and staff: Supabase Auth, strong passwords, mandatory 2FA, session timeouts, role-based access (owner, manager, staff / owner, support, finance, ops).
- Admin portal behind Cloudflare Zero Trust Access in addition to app login.
- SMS sender numbers can be faked. By SMS, the commands that cost money or stop a store (READY for a delivery order, PAUSE, a cancellation that costs the customer money) count only with the one-time reply code from our own message to that phone. Low-risk commands (YES, NO, RESUME) stay plain to keep the conversation smooth: each is confirmed back to the registered phone, and an unusual pattern switches that number to codes for an hour. WhatsApp verifies the sender; RCS [CONFIRM] (docs/ALGORITHMS.md §14).

## Platform
- TLS everywhere (HSTS); encryption at rest (Supabase, R2).
- Secrets only in Cloudflare Secrets Store / Wrangler secrets; rotate regularly; never logged.
- Webhooks verified by signature/secret and timestamp (replay protection), deduped by provider event id: Telnyx messaging, RCS, WhatsApp and voice (Ed25519 signature + timestamp) [CONFIRM headers], Stripe (Stripe-Signature), Uber Direct [CONFIRM].
- Cloudflare WAF managed rules, bot protection, rate limiting on all public routes; Turnstile on secure pages and portal logins; API Shield schema validation on the api-gateway.
- Least privilege: each Worker gets only the bindings it needs; each DB role only its schema; RLS on vendor-facing tables.
- RLS through Hyperdrive: set the scope with `set_config(name, value, true)` inside the same short transaction as the queries that need it. There are two scopes: `app.vendor_id` for portal requests, or `app.scope = 'internal'` for a service's own named cross-vendor paths (for example `listCandidates`, the document expiry job, `getStaffByPhone`, admin review). Hyperdrive resets a connection when it returns to the pool, so a session-level `SET` does not reach the next query. Policy shape: `vendor_id = nullif(current_setting('app.vendor_id', true), '')::uuid OR current_setting('app.scope', true) = 'internal'`, so nothing set means no rows (the `nullif` matters: an unset custom setting can read back as an empty string, which would otherwise raise an error). Only one internal data module per service may set `app.scope`, and portal handlers cannot import it (lint rule + test). Tables use `FORCE ROW LEVEL SECURITY` (a table's owner skips RLS otherwise), and every query still filters by vendor id itself. This applies to every service that holds vendor-scoped rows, not only vendor-service.
- Vendor tables are never granted to `anon` or `authenticated`, and service schemas are not exposed through Supabase's auto-generated API. If the vendor portal uses Supabase Realtime, the service sends Broadcast messages on a vendor-scoped private channel; never table subscriptions, which are checked against the browser's own database role and never see `app.vendor_id`.
- Hyperdrive query caching is off for every service config. The cache matches on the query, not on who is asking, and by default can return results more than a minute old (60 s, plus a 15 s stale window). That is unsafe for balances, PIN and lockout state, order state, idempotency checks and any tenant-scoped read. Turn it on only for a named public read path (for example catalogue search) through its own cache-enabled config.
- Strict security headers on web apps: CSP (no inline scripts; allow only self, Stripe, Turnstile), X-Frame-Options DENY (except Stripe frames), Referrer-Policy no-referrer on secure pages, Permissions-Policy minimal. `apps/website` runs on `www.heydovo.com`, a separate browser origin from the secure pages on `heydovo.com/l/*`, and may additionally allow the Cloudflare Web Analytics script; secure pages and portals may not. No app registers a service worker. Secure pages use no cookies or web storage (the link token is the only credential) and send `Cache-Control: no-store`.
- R2 objects private; access via short-lived signed URLs; uploads scanned for type and size, images re-encoded.
- Input validation with zod at every boundary; parameterised SQL only.
- Dependencies: pinned versions, lockfile, Dependabot, CVE scanning (see docs/TESTING.md).

## Privacy (PIPEDA, Quebec Law 25, CASL)
- Collect the minimum; purpose-limited use; consent recorded with version and timestamp.
- Main database in Canada (Supabase). Cloudflare edge processing disclosed in the Privacy Policy.
- Vendors see only first name, items and the address needed; never customer phone numbers. Couriers get only what delivery requires (disclosed).
- Retention: conversations 12 months then delete/anonymise; financial records 7 years [CONFIRM].
- Access, correction, deletion, portability requests handled within 30 days; breach notification process to OPC and users.
- CASL: express consent for marketing (unticked by default), sender identification and unsubscribe in every marketing message; honour STOP immediately.

## Logging
- Structured JSON logs with correlationId; no PINs, OTPs, tokens, full card numbers, full addresses or message bodies in logs (use redacted forms).
- Audit log (append-only) for every admin action and every money movement.

## Added requirements (designed 2026-11-27; details in docs/ALGORITHMS.md §17–24)

### Approvals, callers and blocks
- A refund decided by a person carries staff approval ids that the wallet redeems with auth-security itself: one below the two-person threshold, two from different staff members at or above it. Rule-based refunds are bounded by the held or captured amount and go only back to the payer (§20).
- auth-security has its own allowed-caller table (its CLAUDE.md), enforced like the wallet's: per-caller entrypoints plus the CI check of service bindings.
- auth-security owns every block (PIN lock, reset required, post-reset cap, SIM-change block, Frozen, vendor command locks). Staff lift a block only through `liftBlock`, which verifies the staff session itself; the post-reset cap cannot be lifted (§18).
- "This wasn't me" is a button on WhatsApp and RCS, and a secure link on SMS and email. It is never a typed command.

### Every door for a person's words is masked
- Captions, location labels, contact cards, voice transcripts and tool arguments from Telnyx Voice AI, and every string argument from Meta Muse go through the same masking as a text message (§23). One shared module, no second implementation.
- The reply filter allows real addresses, totals and refs and still blocks secret-looking and invented numbers (§23).

### Meta Muse
- Linking needs phone OTP and the wallet PIN on our secure page, is refused while any block is active, and starts with a 24-hour $50 cap. PIN, payment and top-up links are texted to the owner's own phone and never returned to Muse (§24).

### Infrastructure
- No database role password, API token or other secret may appear in Terraform state, plan output or CI logs. Role passwords and Hyperdrive origin credentials are set by a rotation job outside Terraform (or by write-only arguments where the provider has them [CONFIRM]); Terraform holds only names and ids. State is remote, encrypted, locked and readable by CI and two named people only. A CI check scans plan output for secret-shaped values.
- Rotation: database role passwords and provider API tokens every 90 days and at once after any suspected leak; webhook secrets yearly; the PIN pepper on a planned schedule using `pepper_version` (docs/ALGORITHMS.md §7). Each rotation has a runbook, and one full rotation is rehearsed before launch.
- Backups: Supabase point-in-time recovery on every production database [CONFIRM plan]; R2 versioning for vendor documents and evidence; a restore is rehearsed in staging at step 3 and again as a timed drill before launch against the recovery targets [CONFIRM targets; default: lose at most 5 minutes of data, be back within 4 hours].
- Monitoring from step 3: error rate and latency per Worker, Queue backlog and dead-letter depth, Workflow failures, webhook signature failures, payment and payout failures, ledger and courier reconciliation mismatches, AI Gateway spend, message delivery failure rate, security events (locks, freezes, step-ups) and uptime checks on every `/health`. Alerts go to a named on-call contact [CONFIRM tool and who is on call].

### Privacy operations
- Erasure reaches every service and is tracked to completion; retention jobs delete conversations after 12 months (§22).
- Before launch (docs/LAUNCH.md): a privacy impact assessment covering transfers outside Canada and Quebec (OpenAI, Telnyx, Stripe, Uber, Cloudflare), a named privacy officer, data processing terms with each processor, a breach response runbook (who decides, notifying the OPC, Quebec's CAI and the people affected, the incident register), rehearsed once as a tabletop exercise.
