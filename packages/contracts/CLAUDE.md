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
- Versioning: add a new version alongside the old; never break a published version; deprecate with a date.
- No runtime dependencies besides zod. 100% of schemas have tests (valid + invalid fixtures).
- Changing anything here requires listing the affected producers and consumers in the PR.
