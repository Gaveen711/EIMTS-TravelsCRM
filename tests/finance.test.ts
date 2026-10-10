import { describe, it, expect } from "vitest";
import {
  calculateTotals,
  formatDocumentNumber,
  quotationSchema,
  lineSchema,
} from "@/lib/finance/schema";
const item = {
  description: "Private tour",
  quantity: "1.005",
  unit_price_minor: 101,
  cost_minor: 50,
  discount_minor: 2,
  tax_rate: "7.1250",
};
describe("Exact financial arithmetic", () => {
  it("rounds decimal quantity and tax half up exactly like PostgreSQL", () => {
    expect(calculateTotals([item])).toMatchObject({
      subtotal_minor: 102,
      discount_minor: 2,
      tax_minor: 7,
      total_minor: 107,
      cost_minor: 50,
    });
  });
  it("handles fractional minor units without floating point errors", () => {
    expect(
      calculateTotals([
        {
          ...item,
          quantity: "0.5",
          unit_price_minor: 1,
          cost_minor: 1,
          discount_minor: 0,
          tax_rate: "100",
        },
      ]),
    ).toMatchObject({
      subtotal_minor: 1,
      tax_minor: 1,
      total_minor: 2,
      cost_minor: 1,
    });
  });
  it("rejects excess discounts, unsafe amounts and malformed decimals", () => {
    expect(() => calculateTotals([{ ...item, discount_minor: 103 }])).toThrow(
      /Discount/,
    );
    expect(() =>
      calculateTotals([
        { ...item, quantity: "2", unit_price_minor: Number.MAX_SAFE_INTEGER },
      ]),
    ).toThrow(/range/);
    expect(lineSchema.safeParse({ ...item, quantity: "1.0001" }).success).toBe(
      false,
    );
  });
  it("validates dates without throwing for invalid calendar values", () => {
    expect(
      quotationSchema.safeParse({
        customer_id: "a1000000-0000-4000-8000-000000000001",
        currency: "USD",
        items: [item],
        start_date: "2026-99-99",
      }).success,
    ).toBe(false);
  });
  it("numbers documents by year without truncating longer sequences", () => {
    expect(formatDocumentNumber("quotation", 2026, 1)).toBe("QT-2026-0001");
    expect(formatDocumentNumber("invoice", 2026, 12345)).toBe("INV-2026-12345");
    expect(() => formatDocumentNumber("credit_note", 2026, 0)).toThrow();
  });
});
