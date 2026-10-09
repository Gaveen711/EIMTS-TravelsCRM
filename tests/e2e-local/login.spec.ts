import { test, expect } from "@playwright/test";
test("temporary admin signs in, persists and signs out", async ({ page }) => {
  await page.goto("/dashboard"); await expect(page).toHaveURL(/login/);
  await page.getByLabel("Username").fill("admin"); await page.getByLabel("Password", {exact:true}).fill("wrong");
  await page.getByRole("button", {name:"Sign in to your workspace"}).click(); await expect(page.getByRole("status")).toContainText("Check your username");
  await page.getByLabel("Password", {exact:true}).fill("2001"); await page.getByRole("button", {name:"Sign in to your workspace"}).click();
  await expect(page).toHaveURL(/dashboard/); await expect(page.getByRole("heading", {name:"Welcome, Admin."})).toBeVisible();
  await page.reload(); await expect(page.getByRole("heading", {name:"Welcome, Admin."})).toBeVisible();
  await page.getByRole("button", {name:"Sign out"}).click(); await expect(page).toHaveURL(/login/);
  await page.goto("/dashboard"); await expect(page).toHaveURL(/login/);
});
