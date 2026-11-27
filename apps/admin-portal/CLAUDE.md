# apps/admin-portal

## Purpose
Internal control centre for Hey Dovo staff. Next.js on Workers + Astryx (`packages/ui`). Behind Cloudflare Zero Trust Access + Supabase Auth with 2FA + roles. Talks only to admin-service via api-gateway.

## Pages
Overview dashboard, Live orders & bookings, Conversations + human takeover, Users, Vendors & approvals (document review), Disputes, Ledger & refunds (two-person approvals), Payouts, Settings (service fee, commission, ranking weights, wallet limits, link TTLs, timeouts), Feature flags, Launch regions map, Service health, Staff & roles, Audit log.

## Components
Reuse AppShell, StatCard, DataTable, Charts from `packages/ui`, plus ConversationViewer, TakeoverComposer, ApprovalQueue, DocumentReviewer, LedgerTable, RefundDialog (reason + second approver), RankingWeightsEditor, FeatureFlagToggle, RegionMapEditor, HealthStatusGrid, AuditLogTable, RoleManager.

## Rules
- Every write shows a confirm step and a reason field; all writes audited.
- PII shown only to roles that need it; masked by default with reveal + audit.

## Tests
Playwright per page, role matrix, two-person refund flow, flag toggles, takeover send/receive, audit entries appear.
