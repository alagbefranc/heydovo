# Hey Dovo — Testing and vulnerability management

**Rule: nothing ships untested.** Every page, component, endpoint, event, tool and service gets end-to-end and security tests before merge. Whoever builds it writes its tests in the same session. Missing tests fail CI.

## Test layers (every service and app)
1. **Unit** (Vitest): all logic. Coverage ≥ 90% for wallet, auth, order state, ranking; ≥ 80% elsewhere.
2. **Contract**: every RPC method and event validated against `packages/contracts` (producer and consumer sides).
3. **Integration**: each Worker run locally with Wrangler (Miniflare) against a Supabase test database and local Queues/KV/R2/DO.
4. **E2E**: full journeys across all services in staging.

## E2E coverage required
- Every page in website, secure-pages, vendor-portal and admin-portal tested with Playwright on mobile and desktop (Chrome, Safari/WebKit, Firefox), English and French, with axe accessibility checks (WCAG 2.2 AA).
- Every chat flow end to end with a simulated Telnyx channel (RCS, SMS fallback, WhatsApp): onboarding, product order (delivery + pickup), service booking, emergency, low balance + pay-by-link, split payment, PIN success, wrong PIN + lockout, expired link, cancellation at each state, substitution, refund, dispute, human takeover, STOP/START, French conversation, an ordinary number sent on its own (house number, buzzer code: passes through, no PIN reset), a real PIN or OTP typed in chat (masked, PIN reset or code cancelled), voice (Telnyx simulator).
- External integrations against sandboxes/test numbers: Telnyx (RCS, SMS, WhatsApp, Voice AI), Stripe test mode (incl. webhooks), the Uber Direct sandbox, OpenAI via AI Gateway.
- **AI evaluation suite**: hundreds of scripted conversations asserting the agent calls the right tools, always shows a summary before charging, never skips YES/PIN, refuses prompt-injection attempts (including injections hidden in product names, reviews and photos' captions), stays in language, and hands off when it should. Runs on every prompt/model change; pass rate threshold 100% on safety cases, ≥ 95% on task cases.
- **Failure tests**: provider outages, webhook retries/duplicates, out-of-order events, double-tap YES, two PIN submissions, network timeouts mid-payment → no double charge, no lost order, ledger always balanced.
- **Load tests** (k6): messaging gateway, agent, orders, wallet; before launch and before major releases.

## Known vulnerability testing (CVE + CVSS)
- Dependency and container/image scanning on every commit (Snyk or Trivy + Dependabot) against the CVE database; each finding scored with CVSS.
- **Gates**: Critical (9.0–10.0) and High (7.0–8.9) block merge and deploy. Medium (4.0–6.9) fixed within 14 days. Low (0.1–3.9) within 30 days. Exceptions need a written risk acceptance.
- Infrastructure-as-code scanning (Checkov) for Terraform and Wrangler configs; SBOM generated for every build.
- SAST (Semgrep or CodeQL) and secret scanning (gitleaks) on every pull request.
- DAST (OWASP ZAP) on every page and API in staging, covering OWASP Top 10, API Top 10 and LLM Top 10.
- Security E2E tests: PIN brute force + lockout, link replay/expiry/tampering, webhook signature forgery and replay, IDOR/access control between users, vendors and staff, SQL injection, XSS, CSRF, rate limits, prompt injection.
- Third-party penetration test before launch and yearly; responsible disclosure channel (security.txt on heydovo.com, served by apps/website).
- Daily re-scan of deployed images/dependencies for newly published CVEs, with alerts.

## CI/CD pipeline
Pull request → typecheck, lint, unit, contract, SAST, secret and dependency scans → integration tests → deploy to staging → E2E, DAST, AI evals → manual approval for wallet/auth/payment changes → production with gradual rollout and automatic rollback on failed health checks or error-rate spikes.

## Test data
Synthetic only. Never real customer data outside production. Stripe test cards, provider sandboxes, fake phone numbers in the reserved ranges.
