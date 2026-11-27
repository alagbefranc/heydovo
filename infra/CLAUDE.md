# infra

## Purpose
Everything needed to create and deploy environments (dev, staging, prod) as code.

## Contents
- Terraform for **Cloudflare**: Workers (one per service + apps), service bindings, Queues + dead-letter queues, Durable Object namespaces, Workflows, KV, R2 buckets (private), Hyperdrive configs (one per service role, query caching disabled; a separate cache-enabled config only for a named public read path), AI Gateway, Secrets Store entries (names only), WAF + rate-limit rules, Turnstile widgets, Zero Trust Access app for the admin portal, DNS for heydovo.com (incl. SPF/DKIM/DMARC), Worker routes on heydovo.com (`/l/*` → secure-pages; everything not owned by another Worker → website), Email Routing rules (support@, privacy@, vendors@), spend limits/alerts.
- Terraform for **Supabase**: project in a Canadian region [CONFIRM availability], schemas + one role per service with grants only to its schema, extensions (postgis, vector, pg_trgm), RLS enabled, Auth settings (2FA required for vendor/staff, email via Cloudflare Email Service).
- `wrangler.jsonc` per Worker (bindings least-privilege).
- GitHub Actions: pipeline in docs/TESTING.md, environment protection rules, manual approval for prod and for wallet/auth changes.

## Rules
- No secrets in Terraform state or code; reference secrets by name.
- Checkov must pass. Plan output reviewed before apply. Prod changes only through CI.
- Domain heydovo.com is registered at Cloudflare (nameservers already on Cloudflare).
- Seed the KV settings cache with the defaults from docs/ALGORITHMS.md and the root CLAUDE.md ("Business constants") until admin-service owns settings (docs/BUILD_PLAN.md step 19).
