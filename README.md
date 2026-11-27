# Hey Dovo — build pack for Claude Code

This folder is the starting skeleton for the Hey Dovo monorepo. It contains no code yet, only the
instructions Claude Code needs to build each part correctly and keep the services separate.

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
