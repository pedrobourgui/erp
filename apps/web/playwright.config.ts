import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration (lote 10).
 *
 * The QA cycle that found the 78 bugs produced its scripts in a session
 * scratchpad, and they were gone by the next cycle. This config is what turns
 * them into a suite that runs before a merge instead of after a release.
 *
 * `pt-BR` and `America/Sao_Paulo` are not cosmetic: the whole FN-01/FN-02/VD-09
 * family only shows up when the browser and the server disagree about what day
 * it is, and the assertions read dates as the user sees them.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // Journeys mutate shared stock and cash sessions — running them at once
  // makes a balance assertion fail for reasons that have nothing to do with
  // the code under test.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: process.env.CI ? "retain-on-failure" : "off",
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
