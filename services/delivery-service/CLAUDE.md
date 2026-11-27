# delivery-service

## Purpose
Courier delivery behind one internal interface. Provider at launch: Uber Direct only. The interface stays provider-neutral so a second courier or in-house drivers can be added later (feature flag). We hold the Uber Direct business account; vendors need no courier accounts. Read docs/ALGORITHMS.md §11.

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
Adapters: `UberDirectAdapter` (https://developer.uber.com/docs/deliveries/overview), `InHouseAdapter` (later).

## Key logic
- Quotes, selection rule and fallbacks (§11). With Uber Direct as the only provider, no coverage or an outage falls back to vendor self-delivery if enabled, then to offering pickup. Re-quote if expired; never charge the user more than the summary (platform absorbs). `book` returns the booked `feeCents` so order-booking can pass any difference to the ledger as a delivery subsidy.
- Book on `order.ready` (or schedule at ready_by where supported); cancel if the order is cancelled before pickup.
- Webhooks verified [CONFIRM Uber Direct signing method], deduped, mapped to our statuses.
- Share only the data couriers need (first name, address, delivery notes; phone only if the provider requires it, as disclosed in the Privacy Policy).
- Production access: build against the Uber Direct sandbox and apply for Uber Direct production access early [CONFIRM approval and timeline].

## Events
Publishes: delivery.quoted, delivery.created, delivery.assigned, delivery.picked_up, delivery.delivered, delivery.cancelled, delivery.failed.
Consumes: none directly (order-booking calls `book`/`cancel`).

## Tests
Uber Direct adapter contract tests against its sandbox, selection rule cases (written against the interface with fake providers, so a second provider can be added later), timeout and outage fallback to self-delivery and pickup, quote expiry + fee absorb, webhook verification/dedupe/out-of-order, cancellation.
