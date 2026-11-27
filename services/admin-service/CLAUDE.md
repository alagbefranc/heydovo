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

## Added scope (designed 2026-11-27)
- Review queue (docs/ALGORITHMS.md §18): `review_items`, opened from `security.block_set`, `chargeback.opened`, `delivery.over_cap`, wallet closing remainders and overdue erasures, with deadlines and assignment.
- Lifting a block and approving a refund are done by the staff member's own session against auth-security (`liftBlock`, `approveStaffAction`); this service only records the review item and the audit entry, and passes approval ids on. It never handles a staff session token for an approval.
- Chargebacks (docs/ALGORITHMS.md §21): gather the evidence pack through each owning service's API, store it in R2, submit through the wallet.
- Delivery subsidy report: net of `delivery_subsidy_expense` by day and month, by city and vendor, orders over the cap, and the `deliveryFeeAdjustmentBps` and `deliveryAbsorbCapCents` settings (docs/ALGORITHMS.md §19).
- Erasure tracking view and legal holds (docs/ALGORITHMS.md §22).
- Yearly seller report and a copy per vendor, if the accountant confirms it applies (docs/LAUNCH.md).
- New settings: `deliveryAbsorbCapCents`, `deliveryFeeAdjustmentBps`, `overCapDecisionMinutes`, `refundTwoPersonThresholdCents`, `postResetCapCents`, `postResetHoldHours`, `simChangeHoldHours`, the command thresholds.
- Added tests: each review kind opens, is assigned and resolves; a lift or refund attempted through this service without valid approvals fails at auth-security or the wallet; the subsidy report matches ledger fixtures; evidence pack contents.
