import { describe, expect, it } from "vitest";
import { canAccess, canManage, isRole, permissions, roles } from "@/lib/auth/permissions";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, safeNextPath } from "@/lib/auth/validation";

describe("role authorization", () => {
  it("admin can manage every defined module", () => {
    for (const permission of permissions) expect(canManage("admin", permission)).toBe(true);
  });
  it("agents cannot access accounting, reports or administration", () => {
    for (const permission of ["invoices", "payments", "reports", "settings", "users"] as const)
      expect(canAccess("agent", permission)).toBe(false);
    for (const permission of ["customers", "itineraries", "quotations", "bookings"] as const)
      expect(canManage("agent", permission)).toBe(true);
  });
  it("accountants have read-only bookings and cannot manage sales or settings", () => {
    expect(canAccess("accountant", "bookings")).toBe(true);
    expect(canManage("accountant", "bookings")).toBe(false);
    expect(canManage("accountant", "invoices")).toBe(true);
    for (const permission of ["customers", "itineraries", "quotations", "settings", "users"] as const)
      expect(canAccess("accountant", permission)).toBe(false);
  });
  it("rejects missing, forged and unknown roles", () => {
    for (const role of [null, undefined, "owner", "Admin", {}, "admin "]) expect(isRole(role)).toBe(false);
    for (const role of roles) expect(isRole(role)).toBe(true);
  });
});

describe("auth input validation", () => {
  it("validates login credentials without rejecting existing shorter passwords", () => {
    expect(loginSchema.safeParse({ email: "staff@example.test", password: "existing" }).success).toBe(true);
    for (const input of [null, {}, { email: "invalid", password: "hello" }, { email: "a@example.test", password: "" }])
      expect(loginSchema.safeParse(input).success).toBe(false);
  });
  it("validates recovery email and matching new passwords", () => {
    expect(forgotPasswordSchema.safeParse({ email: "staff@example.test" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ password: "long-password-123", confirmPassword: "long-password-123" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ password: "long-password-123", confirmPassword: "different-password" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "short", confirmPassword: "short" }).success).toBe(false);
  });
});

describe("post-login redirects", () => {
  it.each([undefined, "https://evil.test", "//evil.test", "/\\evil.test", "/%2fexample.test", "/%5cevil.test", "/login", "/auth/callback", "/reset-password", "/bad%", "/a\r\nb"])("rejects unsafe redirect %s", (input) => {
    expect(safeNextPath(input)).toBe("/dashboard");
  });
  it("preserves local module destinations", () => {
    expect(safeNextPath("/customers?page=2")).toBe("/customers?page=2");
    expect(safeNextPath("/customers/../auth/callback")).toBe("/dashboard");
    expect(safeNextPath("/customers/%2e%2e/login")).toBe("/dashboard");
  });
});
