# packages/sdk

## Purpose
Typed clients for calling services: Workers RPC over service bindings (internal) and REST (web apps via api-gateway). Adds correlationId, idempotency keys, timeouts, retries (only for safe/idempotent calls) and standard error mapping. Also a typed Queue publisher that wraps the event envelope.

## Rules
- Generated or hand-written strictly from `packages/contracts`; validate responses in dev/test.
- Retries only for idempotent methods; never auto-retry a money command without the same idempotency key.
- Includes a shared `guards` module (confirmation guard, YES matcher) used by agent-orchestrator and mcp-connector-service so rules are never duplicated.
- Tests for every client and the guards.
