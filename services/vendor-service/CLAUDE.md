# vendor-service

## Purpose
Vendor businesses (stores and trades): applications, verification documents, locations, hours, service areas, availability calendars, staff, payout account reference, and fast candidate lookup by location.

## Owns (schema `vendors`)
- `vendors` (id, kind product|service, legal_name, display_name, business_number, gst_hst_number, status applied|under_review|approved|paused|rejected|closed, commission_bps_override, stripe_connect_account_id, rating_avg, rating_count, accept_rate, on_time_rate, created_at)
- `vendor_locations` (id, vendor_id, address fields, geom geography(Point), timezone, pickup_enabled, delivery_enabled, self_delivery_enabled, delivery_radius_m, service_area geography(MultiPolygon), pickup_hold_minutes, paused)
- `vendor_hours` (location_id, weekday, opens, closes), `vendor_closures` (location_id, starts_at, ends_at, reason)
- `vendor_documents` (id, vendor_id, kind id|business_reg|licence_electrical|licence_gas|licence_plumbing|insurance_liability|other, r2_key, expires_at, status pending|approved|rejected|expired, reviewed_by)
- `vendor_staff` (id, vendor_id, auth_user_id, phone_e164, phone_verified, role owner|manager|staff, location_ids)
- `vendor_calendar_slots` (vendor_id, starts_at, ends_at, status free|held|booked, hold_expires_at), `calendar_links` (Google/Outlook sync tokens, encrypted)

## Key logic
- Application → document upload (presigned R2) → admin review → `approved`. Trades need valid licence(s) for their categories and liability insurance (≥ $2M [CONFIRM]).
- Daily job: document expiry reminders at 30/7/1 days; auto-pause the affected category on expiry → `vendor.document_expired`.
- `listCandidates(point, kind, category, fulfilment, at)`: PostGIS filter (`ST_DWithin` for delivery radius, `ST_Covers` for service areas), open-at-time check in the vendor's timezone, status approved, docs valid. Returns vendor/location ids + straight-line distance. Use GiST indexes.
- Slots: `holdSlot` (short hold during confirmation), `releaseSlot`, booked on `booking.confirmed`.
- Stats (rating, accept, on-time) updated from review.created and order events.
- `getStaffByPhone` for vendor text commands (verified numbers only).
- RLS (defence in depth; every query still filters by vendor id itself), exactly as docs/SECURITY.md, Platform: each portal request runs its queries in one short transaction that starts with `select set_config('app.vendor_id', $1, true)`. This service's own cross-vendor paths (`listCandidates`, the document expiry job, `getStaffByPhone`, admin review, stats consumers) run with `set_config('app.scope', 'internal', true)` instead, set only by one internal data module that portal handlers cannot import. Never rely on a session-level `SET`: Hyperdrive resets a connection when it returns to the pool. Policies use `nullif(current_setting('app.vendor_id', true), '')::uuid`, so nothing set means no rows and no error. Tables use `FORCE ROW LEVEL SECURITY`, are never granted to `anon` or `authenticated`, and this service's Hyperdrive config has query caching off.

## Events
Publishes: vendor.applied, vendor.approved, vendor.paused, vendor.resumed, vendor.updated, vendor.document_expiring, vendor.document_expired.
Consumes: review.created, order.accepted/declined/completed (stats), booking.confirmed/cancelled (slots), payout account updates from wallet.

## Must never
- Expose customer data, other vendors' data, or document files without a short-lived signed URL.

## Tests
PostGIS candidate queries (radius edges, polygons, timezones, closures, DST), document expiry job, slot hold races, RLS isolation (portal scope sees only its own vendor; nothing set returns no rows and no error, including right after another transaction used the connection; internal scope is reachable only from the internal data module; the service role cannot bypass the policies; the interleaved-requests test runs in staging through real Hyperdrive, because local Hyperdrive is a direct connection), upload validation (type, size), approval flow.
