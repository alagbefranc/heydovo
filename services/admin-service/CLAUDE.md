# admin-service

## Purpose
Backend for the admin portal. Reads and acts on the platform by calling each owning service's API; owns only platform settings, flags, launch regions, approvals and the audit log.

## Owns (schema `admin`)
- `settings` (key, value jsonb, version, updated_by, updated_at) — service fee, commission defaults, ranking weights pointers, wallet limits, link TTLs, accept timeout, refund thresholds
- `feature_flags` (key, enabled, rules jsonb {cities, percentage, providers})
- `launch_regions` (id, name, polygon geography, active)
- `refund_approvals` (id, ref, amount_cents, requested_by, approved_by, status) — two-person rule above threshold
- `takeover_sessions` (conversation/user, staff_id, started_at, ended_at)
- `audit_log` (id, actor, action, target_type, target_id, before, after, ip, at) — append-only

## Capabilities
Dashboards (from analytics + live service queries), users, vendors and approvals (document review), live orders/bookings (cancel, reassign vendor, rebook delivery), conversations + human takeover (sends `message.send`), disputes, ledger and refunds, payout runs, settings, flags, service health grid (`/health` of each Worker), staff roles.

## Access
Cloudflare Zero Trust Access in front of the portal + Supabase Auth with mandatory 2FA + role checks (owner, support, finance, ops). Least privilege per role.

## Events
Publishes: settings.changed, flag.changed, handoff.ended (when staff end takeover).
Consumes: handoff.requested, dispute.*, chargeback.opened, payout.failed, health alerts.

## Must never
- Write to another service's schema. Skip the audit log. Let one person approve a large refund alone.

## Tests
Role matrix for every endpoint, audit entries for every write, two-person approval, flag evaluation rules, settings validation and cache refresh.
