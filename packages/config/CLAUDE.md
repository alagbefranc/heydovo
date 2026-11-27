# packages/config

Shared TypeScript (strict), ESLint, Prettier, Vitest and Playwright configs used by every app and service. Changing a rule here affects the whole repo: run the full CI locally first (`pnpm check` at the root).

## What it exports
- `@heydovo/config/tsconfig/base.json` (strict settings for every package) and `tsconfig/worker.json` (adds the Workers runtime types).
- `@heydovo/config/eslint`: one flat config for the whole repo, used by the root `eslint.config.mjs`. Type-aware `strictTypeChecked` rules, `no-console` (logs go through the structured logger) and `eqeqeq`.
- `@heydovo/config/prettier`: used by the root `prettier.config.mjs`. Markdown is not reformatted (`.prettierignore`).
- `@heydovo/config/vitest`: `baseTest` settings and the coverage floors from docs/TESTING.md (`standard` 80%, `critical` 90% for wallet, auth, order state and ranking).
- `@heydovo/config/playwright`: the browser and device matrix (Chromium, Firefox and WebKit on desktop; Chromium and WebKit on mobile) and the two locales.

## Rules
- A package with no tests has no `test` script. `passWithNoTests` stays false, so a `test` script with no tests fails CI on purpose. Add the script together with the first code.
- TypeScript is pinned to 6.0.x: `typescript-eslint` does not support TypeScript 7 yet. Move both together.
- `@playwright/test` is pinned to the version whose browsers are installed in the build environment. Change it only together with the browsers.
