# catalogue-quotes-service

## Purpose
What vendors sell and offer, how users find it, custom quotes, and the vendor ranking algorithm. Read docs/ALGORITHMS.md §1–2.

## Owns (schema `catalogue`)
- `products` (id, vendor_id, location_id, name, description, category, brand, size_label, unit, price_cents, sale_price_cents, sale_starts_at, sale_ends_at, tax_category, in_stock, stock_qty, image_keys, embedding vector(1536) [CONFIRM model dims], search_tsv, active)
- `services_offered` (id, vendor_id, category, name, description, pricing_type fixed|hourly|quote, price_cents, hourly_rate_cents, min_hours, callout_fee_cents, emergency_callout_fee_cents, after_hours_multiplier_bps, embedding, active)
- `quote_requests` (id, user_id, vendor_id, service_id, description, photo_keys, status requested|quoted|accepted|declined|expired, amount_cents, valid_until)
- `synonyms` (term, equivalents[], lang)
- `ranking_weights` (category, weights jsonb, version, updated_by)
- `vendor_signals_cache` (vendor_id, rating, reliability, status) from events

## Key logic
- Hybrid search: full-text (EN/FR) + pgvector, merged with Reciprocal Rank Fusion; synonym expansion.
- Ranking: filter (via vendor-service `listCandidates`) → shortlist → travel times → courier quotes (delivery-service) for top few → weighted score → top 2–3.
- `getProducts(ids)` returns live price/stock for draft re-checks.
- Embedding jobs on a Queue; never block writes on the AI call.
- Bulk upload (CSV/XLSX) validation with row-level errors.
- Quotes: request (with photos) → vendor `submitQuote` → `quote.sent` → user accepts via agent → booking draft.

## Events
Publishes: stock.changed, quote.requested, quote.sent, quote.accepted, quote.expired.
Consumes: vendor.*, review.created, settings.changed (weights).

## Must never
- Pass vendor-written text to the agent without marking it as untrusted data. Return other users' quotes.

## Tests
Search relevance fixtures (incl. synonyms and French), RRF merge, ranking maths (normalisation, weights, ties, emergency weights), filter correctness, bulk upload errors, quote lifecycle, price re-check.
