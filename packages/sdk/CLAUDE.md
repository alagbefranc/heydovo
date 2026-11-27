# packages/sdk

## Purpose
Typed clients for calling services: Workers RPC over service bindings (internal) and REST (web apps via api-gateway). Adds correlationId, idempotency keys, timeouts, retries (only for safe/idempotent calls) and standard error mapping. Also a typed Queue publisher that wraps the event envelope, and a typed fake for every client so a step can be built and tested before the service it calls exists (docs/BUILD_PLAN.md, "Building against things that do not exist yet").

## Rules
- Generated or hand-written strictly from `packages/contracts`; validate responses in dev/test.
- Retries only for idempotent methods; never auto-retry a money command without the same idempotency key.
- The client for `auth.checkSecretExposure` never retries and never attaches its arguments to errors, logs or traces.
- Includes a shared `guards` module (confirmation guard, YES matcher) used by agent-orchestrator and mcp-connector-service so rules are never duplicated.
- Fakes validate their inputs and outputs against `packages/contracts`, so a fake cannot drift from the real contract. Fakes are for tests only and are never bundled into a deployed Worker.
- Tests for every client, every fake and the guards.
