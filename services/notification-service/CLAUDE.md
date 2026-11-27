# notification-service

## Purpose
Messages outside the customer's chat thread: vendor alerts (new order, reminders, payouts, document expiry), emails (receipts, statements, vendor/admin account emails), web push for portals, and admin alerts.

## Owns (schema `notify`)
- `notification_log` (id, recipient_type, recipient_id, channel sms|email|push, template_key, status, provider_id, at)
- `preferences` (recipient, channel, kind, enabled), `push_subscriptions` (portal user, endpoint, keys)

## Channels
- RCS/SMS or WhatsApp to vendors via `message.send` (messaging-gateway, Telnyx). Vendor alerts carry Accept / Decline buttons on WhatsApp and RCS and say exactly what to reply by text (plain YES / NO). A one-time reply code from `auth.issueActionCode` is added only where docs/ALGORITHMS.md §14 requires one.
- Email via **Cloudflare Email Service** from Workers [CONFIRM sending limits]. From addresses: receipts@, vendors@, security@, no-reply@heydovo.com. SPF, DKIM, DMARC in Cloudflare DNS. Supabase Auth emails routed through the same provider.
- Inbound mail (support@, privacy@, vendors@) is handled by Cloudflare Email Routing (configured in infra), not here.
- Web Push for vendor/admin portals (new order sound + push).

## Rules
- Templates in EN/FR from `packages/contracts/src/templates`, versioned.
- CASL: marketing only with express consent; every marketing message identifies Hey Dovo and has an unsubscribe. Transactional messages are allowed without marketing consent.
- Never send PINs, wallet-spending codes or full card details by any channel.
- Bounces and complaints tracked; repeated bounces disable that address.

## Events
Consumes: order.confirmed (vendor alert), order.* reminders, booking.*, payout.sent/failed, vendor.document_expiring/expired, vendor.approved, refund.issued (email receipt), dispute.*, pin.locked, pin.reset (email alert if an email is on file), handoff.requested (staff alert), consent.changed, messaging.opted_out.
Publishes: message.send.

## Tests
Template rendering (EN/FR, missing vars fail), consent gating, quiet hours, email headers (SPF/DKIM alignment in staging), push delivery, idempotency, vendor alerts (buttons on WhatsApp/RCS, plain replies by text, a reply code only where §14 requires one), PIN-reset email alert.
