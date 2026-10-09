import { afterEach, expect, test, vi } from "vitest";
import { createLocalSession, localLoginEnabled, verifyLocalSession } from "../src/lib/auth/local";
afterEach(() => vi.unstubAllEnvs());
test("local sessions reject tampering and expiry", () => {
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("CRM_LOCAL_LOGIN", "true"); vi.stubEnv("CRM_LOCAL_SESSION_SECRET", "test-session-secret");
  const now = Date.now(), token = createLocalSession(now);
  expect(verifyLocalSession(token, now)).toBe(true);
  expect(verifyLocalSession(token + "x", now)).toBe(false);
  expect(verifyLocalSession(token, now + 8 * 60 * 60 * 1000)).toBe(false);
  expect(verifyLocalSession("fake", now)).toBe(false);
});
test("production always rejects local authentication", () => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("CRM_LOCAL_LOGIN", "true"); vi.stubEnv("CRM_LOCAL_SESSION_SECRET", "test-session-secret");
  expect(localLoginEnabled()).toBe(false); expect(verifyLocalSession(createLocalSession())).toBe(false);
});
