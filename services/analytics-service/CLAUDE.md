# analytics-service

## Purpose
Collects events into a pseudonymised warehouse and serves metrics to the admin portal.

## Owns
- Schema `analytics` (or Analytics Engine datasets): facts keyed by HMAC-pseudonymised user and vendor ids. No names, phone numbers, addresses or message text.

## Metrics
Onboarding funnel and drop-off per step, time to first order, orders and bookings per day/week, GMV, revenue (service fees + commission), average order value, repeat rate, delivery cost ratio, vendor accept and on-time rates, agent handoff rate, share of requests completed without a human, time from request to confirmation, PIN lockouts, refunds and disputes rate.

## Events
Consumes: all business events (fan-out subscription). Publishes: none.

## Must never
- Store personal data or allow re-identification in reports.

## Tests
Pseudonymisation, metric calculations on fixtures, late/duplicate events, retention jobs.
