import { requirePermission } from "@/lib/auth/authorize";
import { loadInsights, displayMoney } from "@/lib/insights/data";
import { supportedCurrencies } from "@/lib/catalog/schema";
export async function GET(request: Request) {
  await requirePermission("reports");
  const currency = new URL(request.url).searchParams.get("currency") || "USD";
  if (
    !supportedCurrencies.includes(
      currency as (typeof supportedCurrencies)[number],
    )
  )
    return new Response("Unsupported currency.", { status: 400 });
  const data = await loadInsights(currency);
  const rows = [
    ["Metric", "Currency", "Value"],
    [
      "Revenue this month",
      currency,
      displayMoney(data.revenue_minor, currency),
    ],
    [
      "Outstanding balances",
      currency,
      displayMoney(data.outstanding_minor, currency),
    ],
    [
      "Refunds to reconcile",
      currency,
      displayMoney(data.refund_due_minor, currency),
    ],
    ["Overdue invoices", currency, String(data.overdue_count)],
    ["Quotation conversion percent", currency, String(data.conversion_rate)],
    ...data.monthly.map((row) => [
      row.month,
      currency,
      displayMoney(row.revenue_minor, currency),
    ]),
  ];
  const csv = rows
    .map((row) =>
      row.map((cell) => '"' + cell.replaceAll('"', '""') + '"').join(","),
    )
    .join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="business-report-${currency}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
