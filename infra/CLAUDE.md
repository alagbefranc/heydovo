# infra

## Purpose
Everything needed to create and deploy environments (dev, staging, prod) as code.

## Contents
- Terraform for **Cloudflare**: Workers (one per service + apps), service bindings, Queues + dead-letter queues, Durable Object namespaces, Workflows, KV, R2 buckets (private), Hyperdrive configs (one per service role, query caching disabled; a separate cache-enabled config only for a named public read path), AI Gateway, Secrets Store entries (names only), WAF + rate-limit rules, Turnstile widgets, Zero Trust Access app for the admin portal, DNS for heydovo.com (incl. SPF/DKIM/DMARC), hostnames and routes (`heydovo.com/l/*` → secure-pages; `www.heydovo.com/*` → website; every other apex path that is not an API route → a redirect rule to `www`, no Worker; vendor-portal and admin-portal each on their own hostname [CONFIRM names]; Web Analytics automatic injection off for the zone), Email Routing rules (support@, privacy@, vendors@), spend limits/alerts.
- Terraform for **Supabase**: project in a Canadian region [CONFIRM availability], schemas + one role per service with grants only to its schema, extensions (postgis, vector, pg_trgm), RLS enabled, Auth settings (2FA required for vendor/staff, email via Cloudflare Email Service).
- `wrangler.jsonc` per Worker (bindings least-privilege).
- GitHub Actions: pipeline in docs/TESTING.md, environment protection rules, manual approval for prod and for wallet/auth changes.
- Service-binding allow-list: one file listing which Worker may bind which entrypoint of wallet-payments-service and auth-security-service (from the wallet's allowed-caller table; `checkSecretExposure` only for messaging-gateway and mcp-connector-service). A CI job reads every Worker's `wrangler.jsonc` and fails on any binding to those services that is not on the list. Changing the list needs the wallet/auth manual approval. The list also names `redeemApproval` (wallet only), `lookupNumber` on messaging-gateway (auth-security only) and the action-code methods (notification-service and agent-orchestrator), and it covers Queue producer bindings for sensitive events: `pin.*` and `auth.*` only from auth-security; `payment.*`, `hold.*`, `refund.*` and `payout.*` only from wallet-payments-service.

## Rules
- No secrets in Terraform state or code; reference secrets by name.
- Checkov must pass. Plan output reviewed before apply. Prod changes only through CI.
- Domain heydovo.com is registered at Cloudflare (nameservers already on Cloudflare).
- Seed the KV settings cache with the defaults from docs/ALGORITHMS.md and the root CLAUDE.md ("Business constants") until admin-service owns settings (docs/BUILD_PLAN.md step 19).

## Added scope (designed 2026-11-27)
- The allow-list and its CI check cover service bindings and Queue producers for both wallet-payments-service and auth-security-service, entrypoint by entrypoint (their allowed-caller tables).
- No secrets in Terraform state, plan output or CI logs (docs/SECURITY.md, Infrastructure): role passwords and Hyperdrive credentials are set by a rotation job outside Terraform; remote, encrypted, locked state; a CI scan of plan output for secret-shaped values.
- Monitoring baseline for dev and staging: the alerts listed in docs/SECURITY.md, uptime checks on every `/health`, log retention of 90 days at most.
- Backups: point-in-time recovery where the plan allows, R2 versioning for documents and evidence, and one rehearsed restore in staging.
- Rotation job and runbooks for database role passwords and provider tokens.
- Terraform is written as modules with per-environment variables, so production (docs/BUILD_PLAN.md step 23, docs/LAUNCH.md) is a new workspace, not new code. GitHub environments dev, staging and prod with their own secrets and required reviewers.
- AI Gateway and log retention settings match docs/ALGORITHMS.md §22.
