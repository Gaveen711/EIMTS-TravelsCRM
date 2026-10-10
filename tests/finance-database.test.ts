import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { calculateTotals } from "@/lib/finance/schema";
let db: PGlite;
const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  agent: "10000000-0000-4000-8000-000000000002",
  accountant: "10000000-0000-4000-8000-000000000003",
};
async function role(name: keyof typeof ids) {
  await db.exec("reset role;set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[name],
  ]);
}
async function rpc(name: string, ...args: unknown[]) {
  const cast = args.map(
    (v, i) => "$" + (i + 1) + (typeof v === "object" ? "::jsonb" : "::text"),
  );
  if (["convert_quotation", "quotation_from_itinerary"].includes(name))
    cast[0] = "$1::uuid";
  if (
    [
      "set_quotation_status",
      "set_invoice_status",
      "invoice_from_booking",
      "credit_invoice",
      "update_booking_details",
    ].includes(name)
  )
    cast[0] = "$1::uuid";
  return (
    await db.query<{ id: string }>(
      "select public." + name + "(" + cast.join(",") + ") as id",
      args.map((v) => (typeof v === "object" ? JSON.stringify(v) : v)),
    )
  ).rows[0].id;
}
let customer: string;
const line = {
  description: "Guided wildlife tour",
  quantity: "1.005",
  unit_price_minor: 10000,
  cost_minor: 6000,
  discount_minor: 100,
  tax_rate: "10.5",
};
const doc = () => ({
  customer_id: customer,
  start_date: "2026-11-01",
  end_date: "2026-11-05",
  traveler_count: 2,
  destination: "Yala",
  currency: "USD",
  exchange_rate: "300.12345678",
  valid_until: "2027-12-01",
  items: [line],
  terms: "Deposit required",
});
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text not null);create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[:array_length(string_to_array($1,'/'),1)-1]$$;alter table storage.objects enable row level security;grant usage on schema public,storage to anon,authenticated,service_role;grant select,insert,update,delete on storage.objects to authenticated;grant execute on function storage.foldername(text) to authenticated;",
  );
  for (const file of readdirSync(resolve("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(resolve("supabase/migrations", file), "utf8"));
  for (const [name, id] of Object.entries(ids)) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query(
      "insert into public.profiles(id,full_name,role)values($1,$2,$2)",
      [id, name],
    );
  }
  await role("admin");
  customer = (
    await db.query<{ id: string }>(
      "insert into public.customers(name,email)values('Financial customer','finance@example.test') returning id",
    )
  ).rows[0].id;
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("Transactional sales cycle", () => {
  it("matches exact JS totals, converts once and protects quoted snapshots", async () => {
    await role("agent");
    const q = await rpc("save_quotation", doc());
    const expected = calculateTotals([line]);
    expect(
      (
        await db.query(
          "select subtotal_minor,discount_minor,tax_minor,total_minor from public.quotations where id=$1",
          [q],
        )
      ).rows[0],
    ).toMatchObject(
      Object.fromEntries(
        ["subtotal_minor", "discount_minor", "tax_minor", "total_minor"].map(
          (k) => [k, expected[k as keyof typeof expected]],
        ),
      ),
    );
    await expect(rpc("convert_quotation", q)).rejects.toThrow(/accepted/);
    await rpc("set_quotation_status", q, "sent");
    await expect(
      db.query(
        "update public.quotation_items set description='Tamper' where quotation_id=$1",
        [q],
      ),
    ).rejects.toThrow(/immutable/);
    await rpc("set_quotation_status", q, "accepted");
    const b = await rpc("convert_quotation", q);
    expect(await rpc("convert_quotation", q)).toBe(b);
    expect(
      (
        await db.query<{ cost_minor: number; selling_minor: number }>(
          "select cost_minor,selling_minor from public.bookings where id=$1",
          [b],
        )
      ).rows[0],
    ).toEqual({
      cost_minor: expected.cost_minor,
      selling_minor: expected.total_minor,
    });
    expect(
      (
        await db.query(
          "select * from public.activities where customer_id=$1 and kind='booking_created'",
          [customer],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("creates deposit and balance invoices with correct taxes, locks issued documents and records partial/full payments", async () => {
    await role("agent");
    const b = await rpc("save_booking", doc());
    const inv = await rpc("invoice_from_booking", b, {
      billing_type: "deposit",
      amount_minor: 2501,
      issue_date: "2026-10-09",
      due_date: "2026-10-23",
    });
    expect(
      (await db.query("select id from public.invoices where id=$1", [inv]))
        .rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "update public.bookings set selling_minor=selling_minor+1 where id=$1",
        [b],
      ),
    ).rejects.toThrow(/locked/);
    await role("accountant");
    const stored = (
      await db.query<{
        total_minor: number;
        tax_minor: number;
        subtotal_minor: number;
      }>(
        "select total_minor,tax_minor,subtotal_minor from public.invoices where id=$1",
        [inv],
      )
    ).rows[0];
    expect(stored.total_minor).toBe(2501);
    expect(stored.tax_minor).toBeGreaterThan(0);
    expect(stored.subtotal_minor + stored.tax_minor).toBe(2501);
    await rpc("set_invoice_status", inv, "sent");
    await expect(
      db.query("update public.invoices set terms='Tamper' where id=$1", [inv]),
    ).rejects.toThrow(/immutable/);
    await expect(
      db.query("delete from public.invoice_items where invoice_id=$1", [inv]),
    ).rejects.toThrow(/immutable/);
    await rpc("add_payment", {
      invoice_id: inv,
      amount_minor: 1000,
      payment_date: "2026-10-09",
      method: "bank_transfer",
      reference: "DEP-01",
    });
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.invoices where id=$1",
          [inv],
        )
      ).rows[0].status,
    ).toBe("partially_paid");
    await expect(
      rpc("add_payment", {
        invoice_id: inv,
        amount_minor: 1502,
        method: "cash",
      }),
    ).rejects.toThrow(/exceeds/);
    await rpc("add_payment", {
      invoice_id: inv,
      amount_minor: 1501,
      method: "card",
    });
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.invoices where id=$1",
          [inv],
        )
      ).rows[0].status,
    ).toBe("paid");
    await expect(rpc("set_invoice_status", inv, "void")).rejects.toThrow(
      /credit/,
    );
    const balance = await rpc("invoice_from_booking", b, {
      billing_type: "balance",
    });
    expect(
      (
        await db.query<{ total_minor: number }>(
          "select total_minor from public.invoices where id=$1",
          [balance],
        )
      ).rows[0].total_minor,
    ).toBe(calculateTotals([line]).total_minor - 2501);
    await expect(
      rpc("invoice_from_booking", b, {
        billing_type: "partial",
        amount_minor: 1,
      }),
    ).rejects.toThrow(/balance/);
  });
  it("preserves travelers and supplier confirmations with transaction rollback on invalid row", async () => {
    await role("agent");
    const b = await rpc("save_booking", doc());
    const item = (
      await db.query<{ id: string }>(
        "select id from public.booking_items where booking_id=$1",
        [b],
      )
    ).rows[0].id;
    await rpc("update_booking_details", b, {
      status: "confirmed",
      notes: "Confirmed",
      travelers: [{ full_name: "Alex Green", passport_number: "N123" }],
      confirmations: [
        {
          id: item,
          confirmation_status: "confirmed",
          confirmation_number: "HTL-123",
        },
      ],
    });
    expect(
      (
        await db.query(
          "select full_name from public.travelers where booking_id=$1",
          [b],
        )
      ).rows[0],
    ).toEqual({ full_name: "Alex Green" });
    await expect(
      rpc("update_booking_details", b, {
        status: "cancelled",
        travelers: [{ full_name: "" }],
        confirmations: [],
      }),
    ).rejects.toThrow(/traveler/);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.bookings where id=$1",
          [b],
        )
      ).rows[0].status,
    ).toBe("confirmed");
  });
  it("rejects unauthorized accounting/sales mutations and anonymous RPC calls", async () => {
    await role("accountant");
    await expect(rpc("save_quotation", doc())).rejects.toThrow(/permission/);
    await role("agent");
    await expect(
      rpc("save_invoice", { ...doc(), billing_name: "Customer" }),
    ).rejects.toThrow(/permission/);
    await db.exec("reset role;set role anon");
    await expect(rpc("save_quotation", doc())).rejects.toThrow(/permission/);
  });
  it("credits issued invoices and caps payments by the remaining credit-adjusted balance", async () => {
    await role("admin");
    const inv = await rpc("save_invoice", {
      ...doc(),
      billing_name: "Financial Customer",
    });
    await rpc("set_invoice_status", inv, "sent");
    const total = calculateTotals([line]).total_minor;
    const credit = await rpc("credit_invoice", inv, {
      amount_minor: 500,
      reason: "Cancelled service",
    });
    await rpc("set_invoice_status", credit, "sent");
    await expect(
      rpc("credit_invoice", inv, { amount_minor: total, reason: "Too much" }),
    ).rejects.toThrow(/exceed/);
    await expect(
      rpc("add_payment", {
        invoice_id: inv,
        amount_minor: total,
        method: "cash",
      }),
    ).rejects.toThrow(/exceeds/);
    await rpc("add_payment", {
      invoice_id: inv,
      amount_minor: total - 500,
      method: "cash",
    });
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.invoices where id=$1",
          [inv],
        )
      ).rows[0].status,
    ).toBe("paid");
    expect(
      (
        await db.query("select id from public.audit_log where record_id=$1", [
          inv,
        ])
      ).rows.length,
    ).toBeGreaterThanOrEqual(3);
  });
  it("imports itinerary pricing and dates without retyping", async () => {
    await role("agent");
    const itinerary = (
      await db.query<{ id: string }>(
        "insert into public.itineraries(customer_id,title,destination,start_date,end_date,traveler_count,currency,legacy_content)values($1,'Wildlife holiday','Yala','2026-11-01','2026-11-05',2,'USD',$2::jsonb)returning id",
        [customer, JSON.stringify({ pricing: [line] })],
      )
    ).rows[0].id;
    const q = await rpc("quotation_from_itinerary", itinerary);
    expect(
      (
        await db.query(
          "select itinerary_id,traveler_count,destination from public.quotations where id=$1",
          [q],
        )
      ).rows[0],
    ).toEqual({
      itinerary_id: itinerary,
      traveler_count: 2,
      destination: "Yala",
    });
  });

  it("blocks direct REST item moves, illegal status jumps and linked invoice overbilling", async () => {
    await role("admin");
    const q = await rpc("save_quotation", doc());
    const draftQuote = await rpc("save_quotation", doc());
    await expect(
      db.query("update public.quotations set status='accepted' where id=$1", [
        q,
      ]),
    ).rejects.toThrow(/transition/);
    await rpc("set_quotation_status", q, "sent");
    await expect(
      db.query(
        "update public.quotation_items set quotation_id=$1 where quotation_id=$2",
        [draftQuote, q],
      ),
    ).rejects.toThrow(/immutable/);
    const b = await rpc("save_booking", doc());
    const alternate = await rpc("save_booking", doc());
    await rpc("invoice_from_booking", b, { billing_type: "balance" });
    await expect(
      db.query(
        "update public.booking_items set booking_id=$1 where booking_id=$2",
        [alternate, b],
      ),
    ).rejects.toThrow(/immutable/);
    await expect(
      db.query(
        "insert into public.invoices(number,customer_id,booking_id,currency,billing_name,subtotal_minor,total_minor)values('DIRECT-OVERBILL',$1,$2,'USD','Customer',1,1)",
        [customer, b],
      ),
    ).rejects.toThrow(/balance/);
  });
  it("preserves full booking quantities, prices, discounts and tax snapshots on invoicing", async () => {
    await role("admin");
    const b = await rpc("save_booking", doc());
    const inv = await rpc("invoice_from_booking", b, {
      billing_type: "balance",
    });
    const invoiceLine = (
      await db.query(
        "select description,quantity,unit_price_minor,discount_minor,tax_rate,tax_minor,total_minor from public.invoice_items where invoice_id=$1",
        [inv],
      )
    ).rows[0];
    const bookingLine = (
      await db.query(
        "select description,quantity,unit_price_minor,discount_minor,tax_rate,tax_minor,total_minor from public.booking_items where booking_id=$1",
        [b],
      )
    ).rows[0];
    expect(invoiceLine).toEqual(bookingLine);
  });
  it("applies configured numbering to quotation and agent-generated invoice counters", async () => {
    await role("admin");
    await db.query(
      "update public.settings set numbering_formats=$1::jsonb where id=1",
      [
        JSON.stringify({
          quotation: "EIT-Q-{year}-{sequence}",
          invoice: "EIT-I-{year}-{sequence}",
          credit_note: "EIT-C-{year}-{sequence}",
        }),
      ],
    );
    await role("agent");
    const q = await rpc("save_quotation", doc());
    const b = await rpc("save_booking", doc());
    const inv = await rpc("invoice_from_booking", b, {
      billing_type: "balance",
    });
    expect(
      (
        await db.query<{ number: string }>(
          "select number from public.quotations where id=$1",
          [q],
        )
      ).rows[0].number,
    ).toMatch(/^EIT-Q-\d{4}-\d{4,}$/);
    await role("accountant");
    expect(
      (
        await db.query<{ number: string }>(
          "select number from public.invoices where id=$1",
          [inv],
        )
      ).rows[0].number,
    ).toMatch(/^EIT-I-\d{4}-\d{4,}$/);
    expect(
      (
        await db.query(
          "select * from public.list_billing_customers('Financial',10)",
        )
      ).rows,
    ).toEqual([
      {
        id: customer,
        name: "Financial customer",
        email: "finance@example.test",
        address: null,
      },
    ]);
    await role("admin");
    await db.query(
      "update public.settings set numbering_formats=$1::jsonb where id=1",
      [
        JSON.stringify({
          quotation: "QT-{year}-{sequence}",
          invoice: "INV-{year}-{sequence}",
          credit_note: "CN-{year}-{sequence}",
        }),
      ],
    );
  });
});
