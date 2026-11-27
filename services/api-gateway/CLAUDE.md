# api-gateway

## Purpose
Single entry point (`/api/*`) for the three web apps that call the API: secure-pages, vendor-portal and admin-portal. `apps/website` is static and does not call it. Thin: authenticate, authorise by role, rate-limit, validate, route to the owning service over service bindings. No business logic, no database.

## Responsibilities
- Verify sessions: vendor and staff JWTs (Supabase Auth) via auth-security-service; secure-page requests via link token.
- Map routes `/api/<service>/<action>` to RPC methods; validate bodies with zod from `packages/contracts`.
- Rate limits per IP, per user, per route (Workers rate limiting binding). Stricter on auth, PIN, OTP, payment routes.
- Add `correlationId` to every request; return standard error shape.
- CORS only for our app origins. Security headers on responses.

## Must never
- Hold business rules, call third-party APIs, or touch any database.

## Tests
Routing table coverage, authz matrix (vendor A cannot reach vendor B; staff roles), rate-limit behaviour, schema rejection, error shape.
