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
- Double-entry ledger; daily reconciliation with Stripe; alerts on mismatch.
- No card data on our systems; Stripe Checkout / Elements only (keeps PCI scope minimal, SAQ A target).
- Spending limits, velocity checks and fraud scoring before holds and top-ups.
- Wallet funds held in a segregated account; legal review for FINTRAC money-services rules and provincial prepaid rules before launch [CONFIRM].
- Refunds above a threshold need two staff approvals.
- wallet-payments-service accepts each method only from the callers in its allowed-caller table. Money-moving methods (hold, capture, release, refund, payouts) are never reachable from the agent, the MCP connector or a web app.

## PIN, OTP, links
- See docs/ALGORITHMS.md sections 7–9. Peppered argon2id, constant-time compare, 5-attempt lockout, PIN only on secure pages.
- Secure links: random 256-bit tokens, hashed at rest, single use, short TTL, bound to purpose/amount/summary, no PII in URLs.
- Inbound messages masked for PINs, OTPs and card numbers before storage or AI. PIN/OTP candidates are checked against the sender's own PIN and live OTP, so an ordinary number (house number, buzzer code) is not treated as a leak and does not force a PIN reset (docs/ALGORITHMS.md §15).

## Accounts and identity
- Customers: phone OTP at registration; re-verify after 90 days inactive, after a secret exposure, before unusually large orders, or on suspicious signals (number recycling / SIM swap risk). Consider carrier lookup on the number before large payments [CONFIRM Telnyx Number Lookup].
- Vendors and staff: Supabase Auth, strong passwords, mandatory 2FA, session timeouts, role-based access (owner, manager, staff / owner, support, finance, ops).
- Admin portal behind Cloudflare Zero Trust Access in addition to app login.

## Platform
- TLS everywhere (HSTS); encryption at rest (Supabase, R2).
- Secrets only in Cloudflare Secrets Store / Wrangler secrets; rotate regularly; never logged.
- Webhooks verified by signature/secret and timestamp (replay protection), deduped by provider event id: Telnyx messaging, RCS, WhatsApp and voice (Ed25519 signature + timestamp) [CONFIRM headers], Stripe (Stripe-Signature), Uber Direct [CONFIRM].
- Cloudflare WAF managed rules, bot protection, rate limiting on all public routes; Turnstile on secure pages and portal logins; API Shield schema validation on the api-gateway.
- Least privilege: each Worker gets only the bindings it needs; each DB role only its schema; RLS on vendor-facing tables.
- RLS through Hyperdrive: set the tenant id (for example `app.vendor_id`) with `set_config(name, value, true)` inside the same short transaction as the queries that need it. Hyperdrive resets a connection when it returns to the pool, so a session-level `SET` does not reach the next query. Policies fail closed when the setting is missing, tables use `FORCE ROW LEVEL SECURITY` (a table's owner skips RLS otherwise), and every query still filters by tenant id itself.
- Hyperdrive query caching is off for every service config. The cache matches on the query, not on who is asking, and can return results up to a minute old. That is unsafe for balances, PIN and lockout state, order state, idempotency checks and any tenant-scoped read. Turn it on only for a named public read path (for example catalogue search) through its own cache-enabled config.
- Strict security headers on web apps: CSP (no inline scripts; allow only self, Stripe, Turnstile), X-Frame-Options DENY (except Stripe frames), Referrer-Policy no-referrer on secure pages, Permissions-Policy minimal.
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
