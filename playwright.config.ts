import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e-workflow",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3400", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "next dev --hostname 127.0.0.1 --port 3400",
    url: "http://127.0.0.1:3400/dashboard",
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      CRM_DEFER_AUTH: "true",
      CRM_LOCAL_DATA_DIR: `.crm-test-data/workflow-${Date.now()}`,
      CRM_TEST_DIST_DIR: ".next-crm-tests",
    },
  },
});
