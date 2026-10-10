import { afterEach, expect, test, vi } from "vitest";
import { developmentWorkspace } from "../src/lib/development/config";
afterEach(() => vi.unstubAllEnvs());
test("local consultant workspace opens without credentials only during development", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("CRM_DEFER_AUTH", "true");
  expect(developmentWorkspace()).toBe(true);
  vi.stubEnv("CRM_DEFER_AUTH", "false");
  expect(developmentWorkspace()).toBe(false);
});
test("hosted builds never enable deferred authentication", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CRM_DEFER_AUTH", "true");
  expect(developmentWorkspace()).toBe(false);
});
