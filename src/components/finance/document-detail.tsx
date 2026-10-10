import Link from "next/link";
import { EmailDocument } from "@/components/email/email-document";
import { requirePermission } from "@/lib/auth/authorize";
import { canManage, canAccess } from "@/lib/auth/permissions";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { DocumentActions } from "./document-actions";
import { loadDocument } from "./server";
import {
  money,
  statusLabel,
  outstanding,
  refundDue,
  type FinanceKind,
} from "./types";
export async function DocumentDetail({
  kind,
  id,
}: {
  kind: FinanceKind;
  id: string;
}) {
  const profile = await requirePermission(kind);
  const data = await loadDocument(kind, id);
  if (!data) notFound();
  const { record, items, customer, travelers, payments } = data;
  const title = record.number ?? record.destination ?? "Booking";
  const editable =
    canManage(profile.role, kind) &&
    (kind === "invoices"
      ? record.status === "draft"
      : kind === "quotations"
        ? record.status === "draft"
        : !["completed", "cancelled"].includes(record.status));
  const tax = items.reduce(
    (sum, line) => sum + BigInt(line.tax_minor ?? 0),
    BigInt(0),
  );
  const netRevenue = Number(BigInt(record.selling_minor ?? 0) - tax);
  const total =
    kind === "bookings"
      ? (record.selling_minor ?? 0)
      : (record.total_minor ?? 0);
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            className="text-sm text-muted-foreground hover:underline"
            href={`/${kind}`}
          >
            Back to {kind}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="page-title">{title}</h1>
            <Badge variant="secondary">{statusLabel(record.status)}</Badge>
          </div>
          <p className="mt-2 text-muted-foreground">
            {record.billing_name ?? customer?.name ?? "Customer"}
            {record.destination ? " · " + record.destination : ""}
          </p>
          {record.document_type === "credit_note" && (
            <p className="mt-2 font-medium text-primary">Credit note</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(kind === "quotations" || kind === "invoices") &&
            canManage(profile.role, kind) && (
              <EmailDocument kind={kind} id={id} />
            )}
          {editable && (
            <Button asChild variant="outline">
              <Link href={`/${kind}/${id}/edit`}>
                <Icon name="pencil-square" />
                Edit
              </Link>
            </Button>
          )}
          {kind !== "bookings" && (
            <Button asChild variant="outline">
              <a
                href={`/${kind}/${id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="file-earmark-pdf" />
                Download PDF
              </a>
            </Button>
          )}
        </div>
      </header>
      <div className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Summary
          label="Customer"
          value={record.billing_name ?? customer?.name ?? "Customer"}
        />
        <Summary
          label={kind === "invoices" ? "Issue date" : "Departure"}
          value={
            (kind === "invoices" ? record.issue_date : record.start_date) ??
            "Not set"
          }
        />
        <Summary
          label={kind === "invoices" ? "Due date" : "Return"}
          value={
            (kind === "invoices" ? record.due_date : record.end_date) ??
            "Not set"
          }
        />
        <Summary label="Document total" value={money(total, record.currency)} />
        {kind === "bookings" && (
          <>
            <Summary
              label="Service cost"
              value={money(record.cost_minor, record.currency)}
            />
            <Summary
              label="Profit excluding tax"
              value={money(
                netRevenue - (record.cost_minor ?? 0),
                record.currency,
              )}
            />
            <Summary
              label="Margin"
              value={
                netRevenue
                  ? `${(((netRevenue - (record.cost_minor ?? 0)) / netRevenue) * 100).toFixed(1)}%`
                  : "0%"
              }
            />
            <Summary
              label="Travelers"
              value={String(record.traveler_count ?? 1)}
            />
          </>
        )}
        {kind === "invoices" && (
          <>
            <Summary
              label="Paid"
              value={money(record.paid_minor, record.currency)}
            />
            <Summary
              label="Outstanding"
              value={money(outstanding(record), record.currency)}
            />
            {refundDue(record) > 0 && (
              <Summary
                label="Refund due"
                value={money(refundDue(record), record.currency)}
              />
            )}
            <Summary
              label="Billing type"
              value={statusLabel(record.billing_type ?? "balance")}
            />
          </>
        )}
      </div>
      <nav
        aria-label="Related documents"
        className="flex flex-wrap gap-4 text-sm"
      >
        {record.itinerary_id && canAccess(profile.role, "itineraries") && (
          <Link
            className="text-primary underline"
            href={`/itineraries/${record.itinerary_id}`}
          >
            View itinerary
          </Link>
        )}
        {record.quotation_id && canAccess(profile.role, "quotations") && (
          <Link
            className="text-primary underline"
            href={`/quotations/${record.quotation_id}`}
          >
            View quotation
          </Link>
        )}
        {record.booking_id && (
          <Link
            className="text-primary underline"
            href={`/bookings/${record.booking_id}`}
          >
            View booking
          </Link>
        )}
        {record.credited_invoice_id && (
          <Link
            className="text-primary underline"
            href={`/invoices/${record.credited_invoice_id}`}
          >
            Original invoice
          </Link>
        )}
      </nav>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {[
                "Service",
                "Quantity",
                "Unit price",
                "Discount",
                "Tax",
                "Total",
              ].map((label) => (
                <th
                  key={label}
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((line, index) => (
              <tr key={line.id ?? index} className="border-b last:border-0">
                <td className="min-w-48 px-4 py-4">{line.description}</td>
                <td className="px-4 py-4">{String(line.quantity)}</td>
                <td className="whitespace-nowrap px-4 py-4 tabular-nums">
                  {money(line.unit_price_minor, record.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 tabular-nums">
                  {money(line.discount_minor, record.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 tabular-nums">
                  {money(line.tax_minor, record.currency)} (
                  {String(line.tax_rate)}%)
                </td>
                <td className="whitespace-nowrap px-4 py-4 font-medium tabular-nums">
                  {money(line.total_minor, record.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {record.terms && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Terms and conditions</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
            {record.terms}
          </p>
        </section>
      )}
      <DocumentActions
        role={profile.role}
        kind={kind}
        record={record}
        items={items}
        travelers={travelers}
      />
      {kind === "invoices" && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Payment history</h2>
          {payments.length ? (
            <ul className="mt-3 divide-y">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                >
                  <span>
                    {payment.payment_date} · {statusLabel(payment.method)}
                    {payment.reference ? " · " + payment.reference : ""}
                  </span>
                  <strong className="tabular-nums">
                    {money(payment.amount_minor, record.currency)}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No payments recorded yet. Issue this invoice before receiving
              payment.
            </p>
          )}
        </section>
      )}
    </section>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
