import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e-crm",
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop-crm", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-crm",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "next dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/dashboard",
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      CRM_DEFER_AUTH: "true",
      CRM_LOCAL_DATA_DIR: `.crm-test-data/catalog-${Date.now()}`,
      CRM_TEST_DIST_DIR: ".next-crm-tests",
    },
  },
});
