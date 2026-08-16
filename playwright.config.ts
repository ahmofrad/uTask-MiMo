import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const port = new URL(baseURL).port || "3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: ".auth/admin.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run start",
    url: baseURL,
    env: {
      PORT: port,
      AUTH_URL: baseURL,
      NEXTAUTH_URL: baseURL,
      AUTH_TRUST_HOST: "true",
      // The full suite's API traffic from one IP exceeds the shared per-IP
      // rate-limit tier, which made WBS specs flaky with 429s. Rate limiting
      // is not exercised by e2e, so bypass it on the test server only.
      RATE_LIMIT_DISABLED: "true",
    },
    // Never silently reuse an unrelated/stale server. Opt in only when the
    // caller deliberately started the matching build and selected BASE_URL.
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "true",
    timeout: 60000,
  },
});
