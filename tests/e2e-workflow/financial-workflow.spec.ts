import { test, expect as baseExpect, type Page } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20000 });
test.use({ actionTimeout: 20000, navigationTimeout: 30000 });
async function pdf(page: Page, url: string) {
  const response = await page.request.get(url);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
}
async function insideViewport(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2,
    ),
  ).toBe(true);
}
test("consultant completes itinerary → quotation → booking → invoice → partial and final payment", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/itineraries/new");
  await expect(
    page.getByRole("heading", { name: "Create itinerary", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: "Amelia Carter" });
  await page
    .getByLabel("Trip title", { exact: true })
    .fill("Cultural Sri Lanka " + test.info().project.name);
  await page.getByLabel("Destination", { exact: true }).fill("Sri Lanka");
  await page.getByLabel("Start date", { exact: true }).fill("2040-06-15");
  await page.getByLabel("Adults", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Pricing", exact: true }).click();
  await page.getByRole("button", { name: /Add custom price line/ }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("Private cultural tour");
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Unit selling price", { exact: true }).fill("125.99");
  await page.getByLabel("Unit cost (internal)", { exact: true }).fill("95.35");
  await page.getByLabel("Line discount", { exact: true }).fill("10.00");
  await page.getByLabel("Tax percent", { exact: true }).fill("10.5");
  await page
    .getByRole("button", { name: "Save itinerary", exact: true })
    .click();
  await expect(page).toHaveURL(/\/itineraries\/[a-f0-9-]+$/);
  const itineraryUrl = page.url();
  await pdf(page, itineraryUrl + "/pdf");
  await page
    .getByRole("button", { name: "Create quotation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/quotations\/[a-f0-9-]+$/);
  await expect(
    page.getByText("Private cultural tour", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("$267.39", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("2040-06-15", { exact: true }).first(),
  ).toBeVisible();
  const quoteUrl = page.url();
  await pdf(page, quoteUrl + "/pdf");
  await page.getByRole("button", { name: "Email PDF", exact: true }).click();
  await expect(
    page.getByText(
      "Email is not configured. Download the PDF and send it manually.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mark accepted", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark accepted", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Convert to booking", exact: true })
    .click();
  await expect(page).toHaveURL(/\/bookings\/[a-f0-9-]+$/);
  await expect(page.getByText("$190.70", { exact: true })).toBeVisible();
  await page.getByLabel("Traveler name", { exact: true }).fill("Amelia Carter");
  await page.getByLabel("Nationality", { exact: true }).fill("British");
  await page.getByLabel("Passport number", { exact: true }).fill("TEST12345");
  await page.getByRole("button", { name: "Add traveler", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove traveler Amelia Carter" }),
  ).toBeVisible();
  await page
    .getByLabel("Confirmation for Private cultural tour", { exact: true })
    .selectOption("confirmed");
  await page
    .getByLabel("Reference for Private cultural tour", { exact: true })
    .fill("SUP-2040-01");
  await page
    .getByRole("combobox", { name: "Booking status", exact: true })
    .selectOption("confirmed");
  await page
    .getByRole("button", { name: "Save confirmations", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Booking status", exact: true }),
  ).toHaveValue("confirmed");
  await page
    .getByRole("button", { name: "Generate invoice", exact: true })
    .click();
  await expect(page).toHaveURL(/\/invoices\/[a-f0-9-]+$/);
  const invoiceUrl = page.url();
  await page
    .getByRole("button", { name: "Issue invoice", exact: true })
    .click();
  await expect(
    page.getByText(
      "Issued invoices are locked. Adjustments use a credit note or void.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await page.goto(invoiceUrl + "/edit");
  await expect(page).toHaveURL(invoiceUrl);
  await page.getByLabel("Payment amount (USD)", { exact: true }).fill("100.00");
  await page
    .getByLabel("Payment reference", { exact: true })
    .fill("DEPOSIT-001");
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect(page.getByText("Partially paid", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Payment amount (USD)", { exact: true }),
  ).toHaveValue("167.39");
  await page
    .getByLabel("Payment reference", { exact: true })
    .fill("BALANCE-001");
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record payment", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("DEPOSIT-001", { exact: false })).toBeVisible();
  await expect(page.getByText("BALANCE-001", { exact: false })).toBeVisible();
  await pdf(page, invoiceUrl + "/pdf");
  await insideViewport(page);
  await page.reload();
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
});
test("custom quotation validates money and sent documents remain locked", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/quotations/new");
  await page
    .getByRole("button", { name: "Save quotation", exact: true })
    .click();
  await expect(
    page.getByText("Choose a customer.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: "Amelia Carter" });
  await page
    .getByLabel("Description", { exact: true })
    .fill("Airport transfer");
  await page.getByLabel("Unit selling price", { exact: true }).fill("42.123");
  await page
    .getByRole("button", { name: "Save quotation", exact: true })
    .click();
  await expect(
    page.getByText("Use a positive amount with up to 2 decimal places.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Unit selling price", { exact: true }).fill("42.12");
  await page.getByLabel("Unit cost", { exact: true }).fill("25.00");
  await page
    .getByRole("button", { name: "Save quotation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/quotations\/[a-f0-9-]+$/);
  await expect(page.getByText("$42.12", { exact: true }).first()).toBeVisible();
  const quoteUrl = page.url();
  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mark accepted", exact: true }),
  ).toBeVisible();
  await page.goto(quoteUrl + "/edit");
  await expect(page).toHaveURL(quoteUrl);
  await insideViewport(page);
});
