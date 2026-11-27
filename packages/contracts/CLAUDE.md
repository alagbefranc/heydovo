# packages/contracts

## Purpose
Single source of truth for every shape that crosses a boundary: RPC inputs/outputs, events, agent tool schemas, message templates, shared types.

## Layout
- `src/common/` Money, Ids, E164, Address, Point, Locale, Pagination, Error
- `src/events/` one file per event (zod schema + type + version), plus the envelope
- `src/rpc/<service>/` input/output schemas per method
- `src/agent-tools/` OpenAI tool JSON schemas generated from zod (strict mode)
- `src/templates/` message/email templates EN + FR with typed variables
- `src/index.ts` exports

## Rules
- zod for runtime validation; export inferred TS types.
- Every RPC method is marked `internal` (the default) or `web-facing`. api-gateway routes only web-facing methods.
- Versioning: add a new version alongside the old; never break a published version; deprecate with a date.
- No runtime dependencies besides zod. 100% of schemas have tests (valid + invalid fixtures).
- Changing anything here requires listing the affected producers and consumers in the PR.

## Added scope (designed 2026-11-27)
- Everything under "Added contracts" in docs/CONTRACTS.md: the new RPC methods, events and templates, each method marked `internal` or `web-facing`.
- Every vendor template has two forms with the same variables: rich (buttons) and complete plain text that states the typed reply, in English and French.
- `actor` on vendor actions carries `via` (portal, sms, rcs, whatsapp).
