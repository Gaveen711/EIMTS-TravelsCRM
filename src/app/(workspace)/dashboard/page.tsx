import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorize";
import { loadInsights, displayMoney } from "@/lib/insights/data";
import { supportedCurrencies, currencyExponent } from "@/lib/catalog/schema";
import { BusinessCharts } from "@/components/insights/business-charts";
import { canAccess, canManage } from "@/lib/auth/permissions";
import { loadCompany } from "@/lib/settings/data";
import { Icon } from "@/components/icon";
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ currency?: string }>;
}) {
  const profile = await requirePermission("dashboard");
  const company = await loadCompany();
  const billing = canAccess(profile.role, "invoices");
  const sales = canAccess(profile.role, "quotations");
  const params = await searchParams;
  const currency = supportedCurrencies.includes(
    params.currency as (typeof supportedCurrencies)[number],
  )
    ? params.currency!
    : company?.default_currency || "USD";
  const data = await loadInsights(currency);
  const stats = [
    {
      label: "Revenue this month",
      value: displayMoney(data.revenue_minor, currency),
      icon: "graph-up-arrow",
    },
    {
      label: "Outstanding balance",
      value: displayMoney(data.outstanding_minor, currency),
      icon: "wallet2",
    },
    {
      label: "Overdue invoices",
      value: String(data.overdue_count),
      icon: "clock-history",
    },
    {
      label: "Awaiting quotations",
      value: String(data.awaiting_quotes),
      icon: "file-earmark-text",
    },
  ].filter((stat) => (stat.label === "Awaiting quotations" ? sales : billing));
  return (
    <div className="flex flex-col gap-7">
      <header className="page-heading">
        <div>
          <h1 className="page-title">Your consultant desk</h1>
          <p className="mt-2 text-muted-foreground">
            Keep the next departure, conversation and payment in view.
          </p>
        </div>
        <form className="flex items-end gap-2">
          <label className="text-sm">
            Reporting currency
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
          <button className="action-button" type="submit">
            Apply
          </button>
        </form>
      </header>
      {sales ? (
        <div className="quick-actions">
          <Link href="/customers/new">
            <Icon name="person-plus" />
            Add customer
          </Link>
          <Link href="/itineraries/new">
            <Icon name="map" />
            Plan itinerary
          </Link>
          <Link href="/quotations/new">
            <Icon name="file-earmark-text" />
            Create quotation
          </Link>
          <Link href="/bookings/new">
            <Icon name="briefcase" />
            New booking
          </Link>
        </div>
      ) : (
        <div className="quick-actions">
          <Link href="/invoices/new">
            <Icon name="receipt" />
            Create invoice
          </Link>
          <Link href="/payments">
            <Icon name="wallet2" />
            Review payments
          </Link>
        </div>
      )}
      <div className="metric-grid">
        {stats.map((stat) => (
          <section key={stat.label} className="metric">
            <div className="flex items-center justify-between">
              <span>{stat.label}</span>
              <Icon name={stat.icon} />
            </div>
            <strong>{stat.value}</strong>
          </section>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="work-panel">
          <div className="flex items-center justify-between gap-3">
            <h2>Upcoming departures</h2>
            <Link href="/bookings" className="text-sm underline">
              All bookings
            </Link>
          </div>
          {data.departures.length ? (
            <ul className="work-list">
              {data.departures.map((row) => (
                <li key={row.id}>
                  <div>
                    <Link href={`/bookings/${row.id}`} className="font-medium">
                      {row.destination || "Destination to confirm"}
                    </Link>
                    <p>
                      {row.traveler_count} travelers · {row.status}
                    </p>
                  </div>
                  <time dateTime={row.start_date}>{row.start_date}</time>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-guidance">
              <Icon name="calendar3" />
              <p>No upcoming departures yet.</p>
              {canManage(profile.role, "bookings") && (
                <Link href="/bookings/new">Create your first booking</Link>
              )}
            </div>
          )}
        </section>
        {billing && (
          <section className="work-panel">
            <div className="flex items-center justify-between gap-3">
              <h2>Payments needing attention</h2>
              <Link href="/invoices" className="text-sm underline">
                All invoices
              </Link>
            </div>
            {data.attention.length ? (
              <ul className="work-list">
                {data.attention.map((row) => (
                  <li key={row.id}>
                    <div>
                      <Link
                        href={`/invoices/${row.id}`}
                        className="font-medium"
                      >
                        {row.number} · {row.billing_name}
                      </Link>
                      <p>Due {row.due_date}</p>
                    </div>
                    <strong>
                      {displayMoney(row.outstanding_minor, currency)}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-guidance">
                <Icon name="check2-circle" />
                <p>No overdue balances in {currency}.</p>
                <Link href="/invoices">Review invoices</Link>
              </div>
            )}
          </section>
        )}
      </div>
      <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
        {sales && (
          <>
            <span>{data.conversion_rate}% quotation-to-booking conversion</span>
            <span>{data.customers} customer records</span>
          </>
        )}
        {billing && data.refund_due_minor !== "0" && (
          <span>
            Refunds to reconcile:{" "}
            {displayMoney(data.refund_due_minor, currency)}
          </span>
        )}
        <span>Amounts stay separate by currency.</span>
      </div>
      {billing && (
        <BusinessCharts
          monthly={data.monthly}
          destinations={data.destinations}
          currency={currency}
          exponent={currencyExponent(currency)}
        />
      )}
    </div>
  );
}
