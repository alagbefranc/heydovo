# Hey Dovo — build pack for Claude Code

This is the Hey Dovo monorepo. Step 0 of `docs/BUILD_PLAN.md` (the repo foundation) is in place; every
app, service and package folder is still an empty placeholder with the instructions Claude Code needs to
build it correctly and keep the services separate.

## How to use
1. Create an empty Git repo and copy everything in this folder into its root.
2. Open `docs/BUILD_PLAN.md`. Build in that order.
3. For each step, open Claude Code inside the folder named in the step and paste the step's prompt. In a cloud session, which opens at the repo root, name the folder in your first message instead.
4. Search for `[CONFIRM]` and fill in or verify those items before the related step.

## What's inside
- `CLAUDE.md` — project-wide rules (loaded every session)
- `docs/ARCHITECTURE.md` — how all services and apps connect
- `docs/CONTRACTS.md` — every API, event and agent tool
- `docs/ALGORITHMS.md` — ranking, fees, ledger, state machines, PIN, links, refunds, payouts
- `docs/CONVERSATION.md` — how Dovo talks, rules, samples, prompt rules
- `docs/SECURITY.md` — security requirements
- `docs/TESTING.md` — testing and CVE/CVSS gates
- `docs/BUILD_PLAN.md` — build order with a ready-to-paste prompt per step
- `services/*/CLAUDE.md` — one per service
- `apps/*/CLAUDE.md` — one per web app
- `packages/*/CLAUDE.md`, `infra/CLAUDE.md`

The full product requirements live in the "Hey Dovo – PRD" doc. These files are the build-facing version of it.

## Working in the repo
Needs Node 22.12 or newer and pnpm 10 (`corepack enable` picks the pinned version).

```bash
pnpm install
```

```bash
pnpm check
```

`pnpm check` runs what CI runs on every push: formatting, typecheck, lint and unit tests. CI also runs a
secret scan (gitleaks), static analysis (Semgrep) and a dependency CVE scan with an SBOM (Trivy); Critical
and High findings block the merge (`docs/TESTING.md`).

- `packages/config` holds the shared TypeScript, ESLint, Prettier, Vitest and Playwright settings.
- `templates/worker` is the Worker every service starts from: health route, RPC entrypoint, structured
  logging with a correlationId, zod validation and the standard error shape.
- New dependencies are pinned to an exact version that is at least 7 days old (`pnpm-workspace.yaml`).
- The "Deploy dev" workflow deploys the Worker template and checks `/health`. It needs
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as secrets on a GitHub environment named `dev`.
