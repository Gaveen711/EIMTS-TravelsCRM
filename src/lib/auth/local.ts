import { createHmac, timingSafeEqual } from "node:crypto";
export const localCookie = "crm-local-admin";
export function localLoginEnabled() { return process.env.NODE_ENV === "development" && process.env.CRM_LOCAL_LOGIN === "true" && Boolean(process.env.CRM_LOCAL_SESSION_SECRET); }
export function createLocalSession(now = Date.now()) {
  const expiry = String(now + 8 * 60 * 60 * 1000);
  return `${expiry}.${createHmac("sha256", process.env.CRM_LOCAL_SESSION_SECRET!).update(expiry).digest("hex")}`;
}
export function verifyLocalSession(value?: string, now = Date.now()) {
  if (!localLoginEnabled() || !value) return false;
  const [expiry, signature, extra] = value.split(".");
  if (extra || !/^\d+$/.test(expiry) || !/^[a-f0-9]{64}$/.test(signature || "") || Number(expiry) <= now || Number(expiry) > now + 8 * 60 * 60 * 1000) return false;
  const expected = createHmac("sha256", process.env.CRM_LOCAL_SESSION_SECRET!).update(expiry).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
