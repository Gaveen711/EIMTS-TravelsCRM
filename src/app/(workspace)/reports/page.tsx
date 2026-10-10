import { loadCompany } from "@/lib/settings/data";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorize";
import { loadInsights, displayMoney } from "@/lib/insights/data";
import { supportedCurrencies, currencyExponent } from "@/lib/catalog/schema";
import { BusinessCharts } from "@/components/insights/business-charts";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ currency?: string }>;
}) {
  await requirePermission("reports");
  const params = await searchParams;
  const company = await loadCompany();
  const currency = supportedCurrencies.includes(
    params.currency as (typeof supportedCurrencies)[number],
  )
    ? params.currency!
    : company?.default_currency || "USD";
  const data = await loadInsights(currency);
  return (
    <div className="flex flex-col gap-7">
      <header className="page-heading">
        <div>
          <h1 className="page-title">Business reports</h1>
          <p className="mt-2 text-muted-foreground">
            Issued revenue, customer balances and destination demand.
          </p>
        </div>
        <form className="flex items-end gap-2">
          <label className="text-sm">
            Currency
            <select
              name="currency"
              defaultValue={currency}
              className="mt-1 block rounded-md border bg-card px-3 py-2"
            >
              {supportedCurrencies.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </label>
          <button className="action-button">Apply</button>
        </form>
      </header>
      <section className="work-panel">
        <h2>Balance summary</h2>
        <dl className="mt-5 grid gap-6 sm:grid-cols-3">
          <div>
            <dt>Outstanding</dt>
            <dd className="mt-2 text-xl font-semibold">
              {displayMoney(data.outstanding_minor, currency)}
            </dd>
          </div>
          <div>
            <dt>Overdue invoices</dt>
            <dd className="mt-2 text-xl font-semibold">{data.overdue_count}</dd>
          </div>
          <div>
            <dt>Refunds to reconcile</dt>
            <dd className="mt-2 text-xl font-semibold">
              {displayMoney(data.refund_due_minor, currency)}
            </dd>
          </div>
        </dl>
        <p className="mt-5 text-sm text-muted-foreground">
          Revenue counts issued invoices minus issued credit notes. Outstanding
          balances deduct payments and credits. Refunds require separate bank
          reconciliation.
        </p>
        <Link
          className="mt-4 inline-block underline"
          href={`/reports/export?currency=${currency}`}
        >
          Export financial report CSV
        </Link>
      </section>
      <BusinessCharts
        monthly={data.monthly}
        destinations={data.destinations}
        currency={currency}
        exponent={currencyExponent(currency)}
      />
    </div>
  );
}
