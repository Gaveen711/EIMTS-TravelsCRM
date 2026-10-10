import { describe, expect, it } from "vitest";
import {
  canAccess,
  canManage,
  isRole,
  permissions,
  roles,
} from "@/lib/auth/permissions";

describe("role authorization", () => {
  it("admin can manage every defined module", () => {
    for (const permission of permissions)
      expect(canManage("admin", permission)).toBe(true);
  });
  it("agents cannot access accounting, reports or administration", () => {
    for (const permission of [
      "invoices",
      "payments",
      "reports",
      "settings",
      "users",
    ] as const)
      expect(canAccess("agent", permission)).toBe(false);
    for (const permission of [
      "customers",
      "itineraries",
      "quotations",
      "bookings",
    ] as const)
      expect(canManage("agent", permission)).toBe(true);
  });
  it("accountants have read-only bookings and cannot manage sales or settings", () => {
    expect(canAccess("accountant", "bookings")).toBe(true);
    expect(canManage("accountant", "bookings")).toBe(false);
    expect(canManage("accountant", "invoices")).toBe(true);
    for (const permission of [
      "customers",
      "itineraries",
      "quotations",
      "settings",
      "users",
    ] as const)
      expect(canAccess("accountant", permission)).toBe(false);
  });
  it("rejects missing, forged and unknown roles", () => {
    for (const role of [null, undefined, "owner", "Admin", {}, "admin "])
      expect(isRole(role)).toBe(false);
    for (const role of roles) expect(isRole(role)).toBe(true);
  });
});
