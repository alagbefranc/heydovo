/**
 * Shared Vitest settings. Spread into a package's own `defineConfig({ test: { ...baseTest } })`.
 * A package with no tests must not define a `test` script: missing tests fail CI on purpose.
 */
export const baseTest = {
  passWithNoTests: false,
  restoreMocks: true,
  unstubEnvs: true,
  unstubGlobals: true,
};

/** Coverage floors from docs/TESTING.md. Use `critical` for wallet, auth, order state and ranking. */
export const coverageThresholds = {
  standard: { lines: 80, functions: 80, branches: 80, statements: 80 },
  critical: { lines: 90, functions: 90, branches: 90, statements: 90 },
};
