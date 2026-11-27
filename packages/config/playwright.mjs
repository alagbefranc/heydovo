import { devices } from "@playwright/test";

/**
 * Shared Playwright settings (docs/TESTING.md): every page on mobile and desktop,
 * in Chromium, WebKit and Firefox. Spread into an app's own `defineConfig`.
 */
export const basePlaywright = {
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 15"] } },
  ],
};

/** The two launch languages. Each page test runs once per locale. */
export const locales = Object.freeze(["en", "fr"]);
