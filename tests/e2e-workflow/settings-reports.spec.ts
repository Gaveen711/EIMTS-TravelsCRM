import { test, expect } from "@playwright/test";
import sharp from "sharp";
test("company settings persist, billing choices load and reports export", async ({
  page,
  request,
}, info) => {
  test.setTimeout(150000);
  await page.goto("/settings");
  const company = "Ceylon Travel " + info.project.name;
  await page.getByLabel("Company name", { exact: true }).fill(company);
  await page
    .getByLabel("Company email", { exact: true })
    .fill("consultant@example.com");
  await page
    .getByLabel("Quotation terms", { exact: true })
    .fill("Travel plans subject to availability.");
  await page
    .getByRole("button", { name: "Save company settings", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Company settings saved.");
  await page.reload();
  await expect(page.getByLabel("Company name", { exact: true })).toHaveValue(
    company,
  );
  const png = await sharp({
    create: { width: 32, height: 32, channels: 4, background: "#146753" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("PNG, JPEG or WebP, up to 2 MB")
    .setInputFiles({ name: "company.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload logo", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Company logo uploaded.");
  const logo = await request.get("/settings/logo");
  expect(logo.status()).toBe(200);
  expect(logo.headers()["content-type"]).toContain("image/png");
  await page.goto("/invoices/new");
  await expect(
    page.getByLabel("Customer", { exact: true }).locator("option"),
  ).toContainText(["Choose customer", "Amelia Carter"]);
  await page.goto("/quotations/new");
  await expect(
    page.getByLabel("Terms and conditions", { exact: true }),
  ).toHaveValue("Travel plans subject to availability.");
  await page
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: "Amelia Carter" });
  await page
    .getByLabel("Description", { exact: true })
    .fill("Branded airport transfer");
  await page.getByLabel("Destination", { exact: true }).fill("Sri Lanka");
  await page.getByLabel("Unit selling price", { exact: true }).fill("50.00");
  await page
    .getByRole("button", { name: "Save quotation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/quotations\/[a-f0-9-]+$/);
  const brandedPdf = await request.get(page.url() + "/pdf");
  expect(brandedPdf.status()).toBe(200);
  expect((await brandedPdf.body()).toString("latin1")).toContain(
    "/Subtype /Image",
  );
  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  await page
    .getByRole("button", { name: "Mark accepted", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Convert to booking", exact: true })
    .click();
  await expect(page).toHaveURL(/\/bookings\/[a-f0-9-]+$/);
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "Business reports", exact: true }),
  ).toBeVisible();
  const csv = await request.get("/reports/export?currency=USD");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("Outstanding");
  await expect(
    page.getByRole("heading", { name: "Issued revenue", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
  await expect(page.locator(".recharts-surface")).toHaveCount(2);
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  await expect(page.locator(".recharts-surface").nth(1)).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/reports-" + info.project.name + ".png",
    fullPage: true,
    caret: "initial",
  });
  await page.goto("/dashboard");
  await expect(page.locator(".recharts-surface")).toHaveCount(2);
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  await expect(page.locator(".recharts-surface").nth(1)).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/dashboard-" + info.project.name + ".png",
    fullPage: true,
    caret: "initial",
  });
});
