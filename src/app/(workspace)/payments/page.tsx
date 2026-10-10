import { requirePermission } from "@/lib/auth/authorize";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  money,
  statusLabel,
  type Payment,
  type FinanceRecord,
} from "@/components/finance/types";
export default async function Page() {
  await requirePermission("payments");
  const db = await createClient();
  const [payments, invoices] = await Promise.all([
    db
      .from("payments")
      .select("*")
      .order("payment_date", { ascending: false })
      .limit(200),
    db.from("invoices").select("id,number,currency").limit(1000),
  ]);
  const map = new Map(
    ((invoices.data ?? []) as FinanceRecord[]).map((i) => [i.id, i]),
  );
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Payments</h1>
        <p className="mt-2 text-muted-foreground">
          Record payments from an issued invoice. The most recent 200 receipts
          appear here.
        </p>
      </div>
      {payments.error ? (
        <p role="alert">Unable to load payments. Refresh and try again.</p>
      ) : payments.data?.length ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {["Invoice", "Date", "Method", "Reference", "Amount"].map(
                  (h) => (
                    <th className="px-4 py-3 font-medium" key={h}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {(payments.data as Payment[]).map((p) => {
                const inv = map.get(p.invoice_id);
                return (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        className="text-primary underline"
                        href={`/invoices/${p.invoice_id}`}
                      >
                        {inv?.number ?? "View invoice"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{p.payment_date}</td>
                    <td className="px-4 py-3">{statusLabel(p.method)}</td>
                    <td className="px-4 py-3">{p.reference || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                      {inv
                        ? money(p.amount_minor, inv.currency)
                        : p.amount_minor + " minor units"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-8">
          <h2 className="font-semibold">No payments recorded</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Open an issued invoice and choose Record payment.
          </p>
          <Link
            className="mt-3 inline-block text-primary underline"
            href="/invoices"
          >
            View invoices
          </Link>
        </div>
      )}
    </section>
  );
}
