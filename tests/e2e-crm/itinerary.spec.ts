import sharp from "sharp";
import { test, expect } from "@playwright/test";
test("saved itinerary photos, safe public sharing, duplication and PDF export", async ({
  page,
  request,
}, info) => {
  test.setTimeout(120000);
  const companyName = "Travel Consultants " + info.project.name;
  await page.goto("/settings");
  await page.getByLabel("Company name", { exact: true }).fill(companyName);
  await page
    .getByRole("button", { name: "Save company settings", exact: true })
    .click();
  await expect(
    page.getByText("Company settings saved.", { exact: true }),
  ).toBeVisible();
  await page.goto("/itineraries/new");
  await expect(
    page.locator("form").getByText(companyName, { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Customer", { exact: true })
    .selectOption("de000000-0000-4000-8000-000000000001");
  const title = "Photo journey " + info.project.name + " " + Date.now();
  await page.getByLabel("Trip title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await page.getByLabel("Destination photo library").selectOption("sigiriya");
  await expect(
    page.locator('img[src="/itinerary-photos/sigiriya.jpg"]'),
  ).toBeVisible();
  const png = await sharp({
    create: {
      width: 16,
      height: 16,
      channels: 4,
      background: { r: 21, g: 60, b: 50, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Upload your own photo")
    .setInputFiles({ name: "journey.png", mimeType: "image/png", buffer: png });
  await expect(page.getByLabel("Cover photo URL")).toHaveValue(
    /\/api\/itineraries\/photos\//,
  );
  await page.getByRole("button", { name: "Pricing", exact: true }).click();
  await page.getByRole("button", { name: /Add custom price line/ }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("Private guided journey");
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Unit selling price", { exact: true }).fill("123.45");
  await page.getByLabel("Unit cost (internal)", { exact: true }).fill("91.23");
  await page.getByLabel("Tax percent", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Save itinerary", exact: true })
    .click();
  await expect(page).toHaveURL(/\/itineraries\/[a-f0-9-]{36}$/);
  const itineraryUrl = page.url();
  await expect(
    page.locator("main").getByText(companyName, { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: title, exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("USD 271.59", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create share link", exact: true })
    .click();
  const shared = page.locator('a[href^="/share/"]');
  await expect(shared).toBeVisible();
  const sharePath = await shared.getAttribute("href");
  const publicResponse = await request.get(sharePath!);
  expect(publicResponse.ok()).toBe(true);
  const html = await publicResponse.text();
  expect(html).toContain("Private guided journey");
  expect(html).toContain(companyName);
  expect(html).not.toContain("91.23");
  const sharedPhoto = html.match(/\/share\/[a-f0-9-]+\/photo\/[a-f0-9-]+\.png/);
  expect(sharedPhoto).not.toBeNull();
  const photo = await request.get(sharedPhoto![0]);
  expect(photo.ok()).toBe(true);
  expect(photo.headers()["content-type"]).toBe("image/png");
  const pdf = await request.get(itineraryUrl + "/pdf");
  expect(pdf.ok()).toBe(true);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const pdfBytes = await pdf.body();
  expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdfBytes.toString("latin1")).toContain(companyName);
  await page
    .getByRole("button", { name: "Revoke sharing", exact: true })
    .click();
  expect((await request.get(sharePath!)).status()).toBe(404);
  expect((await request.get(sharedPhoto![0])).status()).toBe(404);
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page).toHaveURL(/\/itineraries\/[a-f0-9-]{36}\/edit$/);
  expect(page.url()).not.toBe(itineraryUrl + "/edit");
  await expect(page.getByLabel("Trip title", { exact: true })).toHaveValue(
    title + " (copy)",
  );
});
