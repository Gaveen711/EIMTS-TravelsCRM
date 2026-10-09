import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
 testDir:"./tests/e2e-crm", fullyParallel:false, workers:1, reporter:"list",
 use:{baseURL:"http://127.0.0.1:3100",trace:"retain-on-failure"},
 projects:[{name:"desktop-crm",use:{...devices["Desktop Chrome"]}},{name:"mobile-crm",use:{...devices["iPhone 13"],defaultBrowserType:"chromium"}}],
 webServer:[
  {command:"tsx tests/support/supabase-fixture.ts",url:"http://127.0.0.1:3101/health",timeout:120000,reuseExistingServer:false},
  {command:"next dev --hostname 127.0.0.1 --port 3100",url:"http://127.0.0.1:3100/login",timeout:120000,reuseExistingServer:false,env:{NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:3101",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test_fixture",NEXT_PUBLIC_APP_URL:"http://127.0.0.1:3100",CRM_LOCAL_LOGIN: "false", CRM_TEST_DIST_DIR:".next-crm-tests"}}
 ]
});
