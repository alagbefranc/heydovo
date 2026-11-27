# Worker template

The starting point for every Hey Dovo service (docs/BUILD_PLAN.md step 0). It holds no business logic.

## What you get
- `GET /health` and the standard error shape `{ error: { code, message, requestId, details? } }` for everything else.
- `InternalApi`, a named `WorkerEntrypoint` with one example RPC method (`ping`).
- `src/lib/logger.ts`: one JSON log line per entry, always with `service` and `correlationId`, with secret-looking fields redacted.
- `src/lib/correlation.ts`: reads `x-correlation-id` (only a well-formed UUID is accepted) or starts a new UUID v7.
- `src/lib/validate.ts`: `parseInput(schema, input)` for zod validation at every boundary; errors say where the input was wrong, never what was sent.
- Tests that run inside the Workers runtime (`pnpm test`).

## Starting a service from it
1. Copy `src/`, `test/`, `wrangler.jsonc`, `vitest.config.ts` and `tsconfig.json` into the service folder, and add the `dev`, `test` and `types` scripts and the dependencies from this `package.json`.
2. Rename the Worker (`name`, `SERVICE_NAME`) in `wrangler.jsonc`, then run `pnpm types`.
3. Replace `InternalApi.ping` with the service's real methods. Give each calling Worker its own entrypoint class with only the methods that caller may use. Build them by composition: RPC exposes inherited methods, so never extend another caller's class. Keep the default export HTTP-only.

## Commands
- `pnpm dev`: run locally with Wrangler.
- `pnpm test`: unit and integration tests in the Workers runtime.
- `pnpm types`: regenerate `worker-configuration.d.ts` after changing `wrangler.jsonc` (typecheck fails if it is stale).
- `pnpm deploy:dev`: deploy to the dev environment (CI does this in the "Deploy dev" workflow).
