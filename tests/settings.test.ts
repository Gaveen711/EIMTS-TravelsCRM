import { describe, it, expect } from "vitest";
import { settingsSchema } from "@/lib/settings/schema";
const settings = {
  company_name: "Emerald Isle Travels",
  email: "sales@example.test",
  phone: "",
  address: "",
  tax_id: "",
  bank_details: "",
  default_currency: "USD",
  quotation_terms: "",
  invoice_terms: "",
  email_subject: "",
  email_body: "",
  tax_rates: [{ name: "VAT", rate: "7.1250" }],
  quotation_format: "QT-{year}-{sequence}",
  invoice_format: "INV-{year}-{sequence}",
  credit_format: "CN-{year}-{sequence}",
};
describe("Business settings validation", () => {
  it("preserves exact decimal tax rates as strings rather than converting them into floats", () => {
    const result = settingsSchema.parse(settings);
    expect(result.tax_rates).toEqual([{ name: "VAT", rate: "7.1250" }]);
  });
  it("rejects out-of-range tax rates and precision that financial documents cannot represent", () => {
    for (const rate of ["100.0001", "-1", "7.12501", "NaN"])
      expect(
        settingsSchema.safeParse({
          ...settings,
          tax_rates: [{ name: "VAT", rate }],
        }).success,
      ).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...settings,
        tax_rates: [{ name: "", rate: "10" }],
      }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...settings,
        tax_rates: [{ name: "Maximum", rate: "100.0000" }],
      }).success,
    ).toBe(true);
  });
  it("rejects formats that omit required placeholders, reorder them or exceed the database bound", () => {
    for (const invoice_format of [
      "INV-{sequence}",
      "INV-{sequence}-{year}",
      "INV-{year}-{counter}",
      "X".repeat(81) + "-{year}-{sequence}",
    ])
      expect(
        settingsSchema.safeParse({ ...settings, invoice_format }).success,
      ).toBe(false);
  });
  it("prevents invoice and credit-note numbering collisions in their shared database namespace", () => {
    expect(
      settingsSchema.safeParse({
        ...settings,
        credit_format: settings.invoice_format,
      }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...settings,
        credit_format: "EIT-CREDIT-{year}-{sequence}",
      }).success,
    ).toBe(true);
  });
});
