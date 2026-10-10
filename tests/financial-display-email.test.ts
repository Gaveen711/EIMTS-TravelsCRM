import { expect, test } from "vitest";
import {
  money,
  outstanding,
  refundDue,
  type FinanceRecord,
} from "../src/components/finance/types";
import { renderEmailTemplate, emailHtml } from "../src/lib/email/template";
test("money display preserves the largest supported cent amount", () => {
  expect(money(Number.MAX_SAFE_INTEGER, "USD")).toBe("$90,071,992,547,409.91");
});
test("money display respects zero and three decimal currencies", () => {
  expect(money(12345, "JPY")).toContain("12,345");
  expect(money(12345, "KWD")).toContain("12.345");
});
test("credited balances do not show negative money due and refunds are separate", () => {
  const record = {
    status: "paid",
    document_type: "invoice",
    total_minor: 10000,
    paid_minor: 9500,
    credited_minor: 1000,
  } as FinanceRecord;
  expect(outstanding(record)).toBe(0);
  expect(refundDue(record)).toBe(500);
  expect(outstanding({ ...record, status: "void" })).toBe(0);
});
test("email templates substitute only supported customer fields", () => {
  expect(
    renderEmailTemplate(
      "Hello {{customer}}: {{document}} {{total}} {{unknown}}",
      {
        customer: "Amelia",
        document: "QT-2026-0001",
        total: "USD 100.00",
        due_date: "2026-10-20",
      },
    ),
  ).toBe("Hello Amelia: QT-2026-0001 USD 100.00 {{unknown}}");
});
test("customer email content is HTML escaped", () => {
  expect(emailHtml('<script>"&\nnext')).toBe(
    "&lt;script&gt;&quot;&amp;<br>next",
  );
});
