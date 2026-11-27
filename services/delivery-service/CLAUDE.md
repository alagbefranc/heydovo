# delivery-service

## Purpose
Courier delivery behind one internal interface. Providers: DoorDash Drive and Uber Direct now; in-house drivers later (feature flag). We hold one business account per provider; vendors need no courier accounts. Read docs/ALGORITHMS.md §11.

## Owns (schema `delivery`)
- `quotes` (id, provider, pickup snapshot, dropoff snapshot, fee_cents, eta_at, expires_at, provider_quote_id)
- `deliveries` (id, order_id UNIQUE, provider, provider_delivery_id, quote_id, status, fee_cents, tracking_url, courier_first_name, eta_at, created_at, updated_at)
- `provider_events` (provider_event_id UNIQUE, delivery_id, type, payload_redacted, at)
- `provider_config` (provider, enabled, regions, priority)

## Interface
```ts
interface DeliveryProvider {
  quote(req: QuoteRequest): Promise<Quote>;
  create(req: CreateRequest): Promise<Delivery>;
  cancel(id: string): Promise<void>;
  get(id: string): Promise<Delivery>;
}
```
Adapters: `DoorDashDriveAdapter` (https://developer.doordash.com/en-US/api/drive/), `UberDirectAdapter` (https://developer.uber.com/docs/deliveries/overview), `InHouseAdapter` (later).

## Key logic
- Parallel quotes, selection rule, fallbacks (§11). Re-quote if expired; never charge the user more than the summary (platform absorbs). `book` returns the booked `feeCents` so order-booking can pass any difference to the ledger as a delivery subsidy.
- Book on `order.ready` (or schedule at ready_by where supported); cancel if the order is cancelled before pickup.
- Webhooks verified [CONFIRM DoorDash and Uber Direct signing methods], deduped, mapped to our statuses.
- Share only the data couriers need (first name, address, delivery notes; phone only if the provider requires it, as disclosed in the Privacy Policy).
- Production access: DoorDash Drive production access is currently restricted with no timeline; build against sandboxes; apply for Uber Direct in parallel.

## Events
Publishes: delivery.quoted, delivery.created, delivery.assigned, delivery.picked_up, delivery.delivered, delivery.cancelled, delivery.failed.
Consumes: none directly (order-booking calls `book`/`cancel`).

## Tests
Adapter contract tests against sandboxes, selection rule cases, timeout/fallback, quote expiry + fee absorb, webhook verification/dedupe/out-of-order, cancellation.
