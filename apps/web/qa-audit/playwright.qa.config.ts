import { defineConfig, devices } from "@playwright/test";

/**
 * Config for the UX/UI QA audit cycle.
 *
 * Separate from `playwright.config.ts` (the merge-gate journeys) because this
 * suite is read-only observation across every screen, not a set of journeys —
 * it can run fully parallel, and it points at the audit port.
 */
const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json", { outputFile: "qa-results.json" }]],
  outputDir: "./artifacts",
  use: {
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "off",
    screenshot: "off",
    video: "off",
    actionTimeout: 15_000,
    deviceScaleFactor: 2,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
