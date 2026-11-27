# reviews-disputes-service

## Purpose
Ratings and reviews after completed orders/jobs, vendor replies, and dispute cases with outcomes that drive refunds.

## Owns (schema `reviews`)
- `reviews` (id, ref_type, ref_id UNIQUE, user_id, vendor_id, rating 1–5, text, lang, status published|hidden, vendor_reply, vendor_replied_at, created_at)
- `disputes` (id, ref_type, ref_id, user_id, vendor_id, reason missing|wrong|damaged|spoiled|not_delivered|quality|no_show|other, description, evidence_keys, status open|awaiting_vendor|awaiting_customer|resolved|rejected, outcome full_refund|partial_refund|replacement|none, refund_cents, liable vendor|courier|platform, resolved_by, sla_due_at, timestamps)
- `dispute_messages` (dispute_id, author_type, text, at)

## Key logic
- Review prompt sent by the agent after COMPLETED; one review per order; vendor may reply once; moderation filter (abuse, personal data) → hidden pending review.
- Disputes: open within policy windows (24 h products, 7 days trades); vendor response window 48 h; SLA 3 business days; evidence photos in R2.
- Resolution emits `dispute.resolved {refundCents, liable}`; order-booking computes and requests the refund; vendor-liable amounts are charged to vendor payable.

## Events
Publishes: review.created, review.hidden, dispute.opened, dispute.updated, dispute.resolved.
Consumes: order.completed, booking.completed (eligibility), chargeback.opened.

## Tests
Eligibility windows, single review per order, moderation, SLA timers, outcome → refund event, access control (users see own, vendors see theirs).
