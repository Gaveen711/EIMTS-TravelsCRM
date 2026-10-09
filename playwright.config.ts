import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3300", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3300",
    url: "http://127.0.0.1:3300/login",
    reuseExistingServer: false,
    env: { CRM_LOCAL_LOGIN: "false", CRM_TEST_DIST_DIR: ".next-crm-tests" },
    timeout: 120_000,
  },
});
