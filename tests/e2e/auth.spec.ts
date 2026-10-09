import { test, expect } from "@playwright/test";

test("login is the first screen and renders within the viewport", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to your workspace" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("protected business routes reject unauthenticated requests", async ({ request }) => {
  for (const path of ["/dashboard", "/customers", "/itineraries", "/quotations", "/bookings", "/invoices", "/payments", "/settings", "/users"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/login");
  }
});

test("login fields expose validation errors", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(page.getByLabel("Email address")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter your password.", { exact: true })).toBeVisible();
});

test("password visibility and recovery navigation work", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
  await expect(page.getByRole("button", { name: "Send recovery link" })).toBeVisible();
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.getByLabel("Email address")).toHaveAttribute("aria-invalid", "true");
});

test("invalid callback and missing recovery session fail safely", async ({ page }) => {
  await page.goto("/auth/callback?next=//evil.test");
  await expect(page).toHaveURL(/\/login\?reason=recovery-expired/);
  await expect(page.getByText("This recovery link is invalid or expired. Request a new link.")).toBeVisible();
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill("strong-password-123");
  await page.getByLabel("Confirm password", { exact: true }).fill("strong-password-123");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("status")).toContainText(/configuration|missing or expired/);
});
