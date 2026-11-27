import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { baseTest, coverageThresholds } from "@heydovo/config/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: {
    ...baseTest,
    include: ["test/**/*.test.ts"],
    coverage: { thresholds: coverageThresholds.standard },
  },
});
