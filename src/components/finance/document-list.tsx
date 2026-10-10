import Link from "next/link";
import { requirePermission } from "@/lib/auth/authorize";
import { canManage } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import {
  money,
  outstanding,
  statusLabel,
  titles,
  type FinanceKind,
  type FinanceRecord,
  type Choice,
} from "./types";
import { creditTotals } from "./server";
export async function DocumentList({
  kind,
  searchParams,
}: {
  kind: FinanceKind;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePermission(kind);
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const status = typeof params.status === "string" ? params.status : "";
  const requestedPage = Number(params.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(10000, requestedPage)
      : 1;
  const db = await createClient();
  let query = db
    .from(kind)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id");
  if (q)
    query = query.ilike(
      kind === "bookings" ? "destination" : "number",
      `%${q.replace(/[\%_]/g, "\$&")}%`,
    );
  if (status) query = query.eq("status", status);
  const [result, customers] = await Promise.all([
    query.range((page - 1) * 20, page * 20 - 1),
    db.from("customers").select("id,name").limit(1000),
  ]);
  const customerMap = new Map(
    ((customers.data ?? []) as Choice[]).map((c) => [c.id, c.name]),
  );
  const statuses = {
    quotations: ["draft", "sent", "accepted", "rejected", "expired"],
    bookings: ["pending", "confirmed", "completed", "cancelled"],
    invoices: ["draft", "sent", "partially_paid", "paid", "overdue", "void"],
  }[kind];
  const rows = (result.data ?? []) as FinanceRecord[];
  if (kind === "invoices" && !result.error) {
    const credits = await creditTotals(rows.map((row) => row.id));
    for (const row of rows) row.credited_minor = credits.get(row.id) ?? 0;
  }
  const pageLink = (p: number) =>
    `/${kind}?${new URLSearchParams({ q, status, page: String(p) })}`;
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{titles[kind]}</h1>
          <p className="mt-2 text-muted-foreground">
            {
              {
                quotations:
                  "Build a clear travel proposal, then turn acceptance into a booking.",
                bookings:
                  "Keep departures, travelers and supplier confirmations together.",
                invoices:
                  "Issue accurate bills and track the balance through every payment.",
              }[kind]
            }
          </p>
        </div>
        {canManage(profile.role, kind) && (
          <Button asChild>
            <Link href={`/${kind}/new`}>
              <Icon name="plus-lg" />
              New{" "}
              {kind === "quotations"
                ? "quotation"
                : kind === "bookings"
                  ? "booking"
                  : "invoice"}
            </Link>
          </Button>
        )}
      </header>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="flex-1 text-sm">
          {kind === "bookings" ? "Destination" : "Document number"}
          <Input
            name="q"
            defaultValue={q}
            placeholder={
              kind === "bookings"
                ? "Search destinations"
                : "Search document numbers"
            }
          />
        </label>
        <label className="text-sm">
          Status
          <select
            name="status"
            defaultValue={status}
            className="block h-9 rounded-md border bg-background px-3"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <Button>Search</Button>
        <Button variant="ghost" asChild>
          <Link href={`/${kind}`}>Clear</Link>
        </Button>
      </form>
      {result.error ? (
        <div role="alert" className="rounded-xl border p-5">
          Unable to load documents. Refresh and try again.
        </div>
      ) : rows.length ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {[
                  "Document",
                  "Customer",
                  kind === "invoices" ? "Due date" : "Travel dates",
                  "Status",
                  "Total",
                  ...(kind === "invoices" ? ["Balance"] : []),
                ].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-4 py-3 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-4">
                    <Link
                      className="font-semibold text-primary hover:underline"
                      href={`/${kind}/${row.id}`}
                    >
                      {row.number ?? row.destination ?? "Booking"}
                    </Link>
                    {row.document_type === "credit_note" && (
                      <span className="block text-xs text-muted-foreground">
                        Credit note
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {row.billing_name ??
                      customerMap.get(row.customer_id) ??
                      "Customer"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    {kind === "invoices"
                      ? (row.due_date ?? "No due date")
                      : `${row.start_date ?? "Not set"}${row.end_date ? " – " + row.end_date : ""}`}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant="secondary">{statusLabel(row.status)}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 tabular-nums">
                    {money(
                      kind === "bookings" ? row.selling_minor : row.total_minor,
                      row.currency,
                    )}
                  </td>
                  {kind === "invoices" && (
                    <td className="whitespace-nowrap px-4 py-4 tabular-nums">
                      {money(outstanding(row), row.currency)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <Icon name="file-earmark-text" className="text-3xl text-primary" />
          <h2 className="mt-3 font-semibold">
            {q || status
              ? "No matching documents"
              : "Create your first " +
                (kind === "quotations"
                  ? "quotation"
                  : kind === "bookings"
                    ? "booking"
                    : "invoice")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {q || status
              ? "Clear the filters or try another search."
              : "Start with a customer and add services from your catalog."}
          </p>
        </div>
      )}
      <nav
        aria-label="Document pagination"
        className="flex justify-between text-sm"
      >
        <span>
          {result.count ?? 0} documents · Page {page}
        </span>
        <div className="flex gap-4">
          {page > 1 && (
            <Link className="underline" href={pageLink(page - 1)}>
              Previous
            </Link>
          )}
          {page * 20 < (result.count ?? 0) && (
            <Link className="underline" href={pageLink(page + 1)}>
              Next
            </Link>
          )}
        </div>
      </nav>
    </section>
  );
}
