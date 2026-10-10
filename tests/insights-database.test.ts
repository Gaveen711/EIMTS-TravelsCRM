import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";

let db: PGlite;
const adminId = "a1000000-0000-4000-8000-000000000001";
let customerId: string;
let overdueId: string;
type Insights = {
  currency: string;
  revenue_minor: string;
  outstanding_minor: string;
  refund_due_minor: string;
  overdue_count: number;
  attention: { id: string; outstanding_minor: string }[];
  monthly: { month: string; revenue_minor: string }[];
};
async function invoice(
  amount: number,
  currency = "USD",
  issue = "2026-10-01",
  due = "2026-11-01",
  status = "sent",
) {
  const payload = {
    customer_id: customerId,
    currency,
    exchange_rate: "1",
    billing_name: "Report customer",
    billing_email: "report@example.test",
    issue_date: issue,
    due_date: due,
    items: [
      {
        description: "Travel service",
        quantity: "1",
        unit_price_minor: amount,
        cost_minor: 0,
        discount_minor: 0,
        tax_rate: "0",
      },
    ],
  };
  const id = (
    await db.query<{ id: string }>(
      "select public.save_invoice($1::jsonb) as id",
      [JSON.stringify(payload)],
    )
  ).rows[0].id;
  if (status !== "draft")
    await db.query("select public.set_invoice_status($1,$2)", [id, status]);
  return id;
}
async function payment(id: string, amount: number) {
  await db.query("select public.add_payment($1::jsonb)", [
    JSON.stringify({
      invoice_id: id,
      amount_minor: amount,
      method: "bank_transfer",
      payment_date: "2026-10-05",
    }),
  ]);
}
async function credit(id: string, amount: number, status = "sent") {
  const creditId = (
    await db.query<{ id: string }>(
      "select public.credit_invoice($1,$2::jsonb) as id",
      [
        id,
        JSON.stringify({
          amount_minor: amount,
          reason: "Cancelled service",
          issue_date: "2026-10-06",
        }),
      ],
    )
  ).rows[0].id;
  if (status !== "draft")
    await db.query("select public.set_invoice_status($1,$2)", [
      creditId,
      status,
    ]);
}
async function insights(currency = "USD", date = "2026-10-10") {
  return (
    await db.query<{ result: Insights }>(
      "select public.consultant_insights($1,$2::date) as result",
      [currency, date],
    )
  ).rows[0].result;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text not null);create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[:array_length(string_to_array($1,'/'),1)-1]$$;alter table storage.objects enable row level security;grant usage on schema public,storage to anon,authenticated,service_role;grant select,insert,update,delete on storage.objects to authenticated;grant execute on function storage.foldername(text) to authenticated;",
  );
  for (const name of readdirSync(resolve("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(resolve("supabase/migrations", name), "utf8"));
  await db.query("insert into auth.users(id) values($1)", [adminId]);
  await db.query(
    "insert into public.profiles(id,full_name,role) values($1,'Report administrator','admin')",
    [adminId],
  );
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    adminId,
  ]);
  customerId = (
    await db.query<{ id: string }>(
      "insert into public.customers(name,email) values('Report customer','report@example.test') returning id",
    )
  ).rows[0].id;
  const partial = await invoice(10000, "USD", "2026-10-01", "2026-10-03");
  await payment(partial, 2500);
  await credit(partial, 1000);
  const paid = await invoice(5000, "USD", "2026-10-02");
  await payment(paid, 5000);
  await credit(paid, 500);
  await invoice(90000, "USD", "2026-10-01", "2026-10-02", "draft");
  await invoice(70000, "USD", "2026-10-01", "2026-10-02", "void");
  await invoice(3000, "USD", "2026-09-01");
  overdueId = await invoice(4000, "USD", "2026-10-03", "2026-10-09");
  const local = await invoice(800000, "LKR", "2026-10-04");
  await payment(local, 200000);
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("Consultant dashboard database aggregates", () => {
  it("keeps currencies separate without mixing minor-unit amounts or applying document exchange rates", async () => {
    expect(await insights("USD")).toMatchObject({
      currency: "USD",
      revenue_minor: "17500",
      outstanding_minor: "13500",
      refund_due_minor: "500",
    });
    expect(await insights("LKR")).toMatchObject({
      currency: "LKR",
      revenue_minor: "800000",
      outstanding_minor: "600000",
      refund_due_minor: "0",
    });
    expect(await insights("EUR")).toMatchObject({
      currency: "EUR",
      revenue_minor: "0",
      outstanding_minor: "0",
      refund_due_minor: "0",
    });
  });
  it("subtracts issued credits, leaves draft credits reserved only and reports refund obligations separately", async () => {
    const snapshot = await insights();
    expect(snapshot.outstanding_minor).toBe("13500");
    expect(snapshot.refund_due_minor).toBe("500");
    const source = (
      await db.query<{ id: string }>(
        "select id from public.invoices where currency='USD' and total_minor=4000 and document_type='invoice'",
      )
    ).rows[0].id;
    await credit(source, 1000, "draft");
    expect(await insights()).toMatchObject({
      outstanding_minor: "13500",
      revenue_minor: "17500",
      refund_due_minor: "500",
    });
  });
  it("counts overdue balances from due dates even before a stored status is refreshed", async () => {
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.invoices where id=$1",
          [overdueId],
        )
      ).rows[0].status,
    ).toBe("sent");
    const report = await insights();
    expect(report.overdue_count).toBe(2);
    expect(report.attention.find((row) => row.id === overdueId)).toMatchObject({
      outstanding_minor: "4000",
    });
    expect(report.attention).toHaveLength(2);
  });
  it("reports six calendar months of issued revenue and excludes draft and void documents", async () => {
    const report = await insights();
    expect(report.monthly).toHaveLength(6);
    expect(report.monthly.find((row) => row.month === "2026-10")).toEqual({
      month: "2026-10",
      revenue_minor: "17500",
    });
    expect(report.monthly.find((row) => row.month === "2026-09")).toEqual({
      month: "2026-09",
      revenue_minor: "3000",
    });
    expect(report.monthly.find((row) => row.month === "2026-08")).toEqual({
      month: "2026-08",
      revenue_minor: "0",
    });
  });
  it("denies anonymous access to financial dashboard RPCs", async () => {
    await db.exec("reset role;set role anon");
    await expect(insights()).rejects.toThrow(/permission denied/i);
  });
});
