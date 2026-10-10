import { test, expect, type Page } from "@playwright/test";
async function openWorkspace(page: Page) {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/dashboard/);
}
test("customer creation, pipeline edits, timeline and search persist", async ({
  page,
}, info) => {
  await openWorkspace(page);
  const name = "Amelia " + info.project.name;
  await page.goto("/customers/new");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(
    page.getByText("Enter a customer name.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Customer name", { exact: true }).fill(name);
  await page
    .getByLabel("Email", { exact: true })
    .fill(info.project.name + "@example.test");
  await page.getByLabel("Tags (comma separated)").fill("family, Sri Lanka");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByLabel("Add activity note").fill("Discovery call confirmed");
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(
    page.getByText("Discovery call confirmed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit customer" }).click();
  await page.getByLabel("Lead status", { exact: true }).selectOption("quoted");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByText(/individual · quoted/i)).toBeVisible();
  await page.goto("/customers");
  await page.getByLabel("Search customers").fill(name);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("CSV imports validated rows and exports persisted data", async ({
  page,
}, info) => {
  await openWorkspace(page);
  await page.goto("/customers");
  await page.getByText("Import customers from CSV", { exact: true }).click();
  const name = "CSV " + info.project.name;
  await page
    .getByLabel("Customer CSV")
    .setInputFiles({
      name: "customers.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "name,email\n" + name + ",csv-" + info.project.name + "@example.test",
      ),
    });
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Imported 1 customers.");
  const response = await page.request.get("/customers/export");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain(name);
  await page
    .getByLabel("Customer CSV")
    .setInputFiles({
      name: "invalid.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("name,email\nInvalid Person,bad-email"),
    });
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Row 2:");
});
test("supplier linking, exact service prices and archiving persist", async ({
  page,
}, info) => {
  await openWorkspace(page);
  const supplier = "Garden Lodge " + info.project.name,
    service = "Double room " + info.project.name;
  await page.goto("/suppliers");
  await page.getByRole("button", { name: "Add supplier", exact: true }).click();
  await page.getByLabel("name *", { exact: true }).fill(supplier);
  await page
    .getByRole("button", { name: "Save supplier", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: supplier, exact: true }),
  ).toBeVisible();
  await page.goto("/services");
  await page.getByRole("button", { name: "Add service", exact: true }).click();
  await page.getByLabel("Service name *", { exact: true }).fill(service);
  await page.getByLabel("Cost price *", { exact: true }).fill("95.35");
  await page.getByLabel("Selling price *", { exact: true }).fill("125.99");
  await page.getByLabel("Tax percentage *", { exact: true }).fill("10.5");
  await page
    .getByRole("combobox", { name: "Supplier", exact: true })
    .selectOption({ label: supplier });
  await page.getByRole("button", { name: "Save service", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: service, exact: true }),
  ).toBeVisible();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: service, exact: true }) });
  await expect(card).toContainText("Cost: USD 95.35");
  await expect(card).toContainText("Selling: USD 125.99");
  await page
    .getByRole("button", { name: "Edit " + service, exact: true })
    .click();
  await page.getByLabel("Available for new documents").uncheck();
  await page.getByRole("button", { name: "Save service", exact: true }).click();
  await expect(card).toContainText("Archived");
  await page.goto("/suppliers");
  const supplierCard = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: supplier, exact: true }),
    });
  await supplierCard
    .getByRole("button", { name: "Delete supplier", exact: true })
    .click();
  await supplierCard
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(
    page.getByText(
      "This supplier is linked to services or bookings. Keep it for their history.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: supplier, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
