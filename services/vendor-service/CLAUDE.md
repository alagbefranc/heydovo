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
- RLS: portal requests set `app.vendor_id`; policies restrict rows to that vendor (defence in depth).

## Events
Publishes: vendor.applied, vendor.approved, vendor.paused, vendor.resumed, vendor.updated, vendor.document_expiring, vendor.document_expired.
Consumes: review.created, order.accepted/declined/completed (stats), booking.confirmed/cancelled (slots), payout account updates from wallet.

## Must never
- Expose customer data, other vendors' data, or document files without a short-lived signed URL.

## Tests
PostGIS candidate queries (radius edges, polygons, timezones, closures, DST), document expiry job, slot hold races, RLS isolation, upload validation (type, size), approval flow.
