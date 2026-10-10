import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// Run genuine PostgreSQL constraints, triggers and RLS without requiring Docker.
// Supabase-managed Auth/Storage infrastructure is stubbed; hosted integration is separate.
const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  agent: "10000000-0000-4000-8000-000000000002",
  accountant: "10000000-0000-4000-8000-000000000003",
  inactive: "10000000-0000-4000-8000-000000000004",
  unprofiled: "10000000-0000-4000-8000-000000000005",
  customer: "20000000-0000-4000-8000-000000000001",
};
let db: PGlite;
async function user(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
async function draft(number: string, amount = 10000) {
  await user(ids.admin);
  const result = await db.query<{ id: string }>(
    "insert into public.invoices(number,customer_id,billing_name,subtotal_minor,total_minor) values($1,$2,$3,$4,$4) returning id",
    [number, ids.customer, "Amelia Carter", amount],
  );
  const id = result.rows[0].id;
  await db.query(
    "insert into public.invoice_items(invoice_id,description,unit_price_minor,total_minor) values($1,$2,$3,$3)",
    [id, "Tour package", amount],
  );
  return id;
}
async function sent(number: string, amount = 10000) {
  const id = await draft(number, amount);
  await db.query("update public.invoices set status = 'sent' where id = $1", [
    id,
  ]);
  return id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null);
    create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[:array_length(string_to_array($1,'/'),1)-1] $$;
    alter table storage.objects enable row level security;
    grant usage on schema public,storage to anon,authenticated,service_role;
    grant select,insert,update,delete on storage.objects to authenticated;
    grant execute on function storage.foldername(text) to authenticated;
  `);
  const dir = resolve("supabase/migrations");
  for (const file of readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(resolve(dir, file), "utf8"));
  }
  await db.query("insert into auth.users(id) select unnest($1::uuid[])", [
    Object.values(ids).filter((id) => id !== ids.customer),
  ]);
  for (const role of ["admin", "agent", "accountant"] as const) {
    await db.query(
      "insert into public.profiles(id,full_name,role) values($1,$2,$2)",
      [ids[role], role],
    );
  }
  await db.query(
    "insert into public.profiles(id,full_name,role,is_active) values($1,'Inactive agent','agent',false)",
    [ids.inactive],
  );
  await db.query(
    "insert into public.customers(id,name,passport_number) values($1,$2,$3)",
    [ids.customer, "Amelia Carter", "PRIVATE-PASSPORT"],
  );
}, 60000);
afterEach(async () => {
  await db.exec(
    "reset role; select set_config('request.jwt.claim.sub','',false)",
  );
});
afterAll(async () => {
  await db?.close();
});

describe("database role boundaries", () => {
  it("enables RLS on every CRM table and indexes every foreign key", async () => {
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'",
    );
    expect(tables.rows).toHaveLength(17);
    expect(tables.rows.every((table) => table.relrowsecurity)).toBe(true);
    const unindexed =
      await db.query(`select conname from pg_constraint c where contype='f' and connamespace='public'::regnamespace
      and not exists(select 1 from pg_index i where i.indrelid=c.conrelid and i.indkey::smallint[] @> c.conkey)`);
    expect(unindexed.rows).toHaveLength(0);
  });
  it("denies anonymous customer reads and numbering", async () => {
    await db.exec("set role anon");
    await expect(db.query("select * from public.customers")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.query("select public.next_document_number('quotation',2026)"),
    ).rejects.toThrow(/permission denied/);
  });
  it("denies unprofiled/inactive identities access to agency data", async () => {
    for (const id of [ids.inactive, ids.unprofiled]) {
      await user(id);
      expect(
        (await db.query("select * from public.customers")).rows,
      ).toHaveLength(0);
      await expect(
        db.query("insert into public.customers(name) values('Unauthorized')"),
      ).rejects.toThrow(/row-level security/);
    }
  });
  it("lets agents manage customers but prevents role escalation and finance writes", async () => {
    await user(ids.agent);
    expect(
      (await db.query("select * from public.customers")).rows.length,
    ).toBeGreaterThan(0);
    await db.query(
      "insert into public.customers(name) values('Agent customer')",
    );
    expect(
      (
        await db.query(
          "update public.profiles set role='admin' where id=$1 returning id",
          [ids.agent],
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec(
      `select set_config('request.jwt.claims','{"user_metadata":{"role":"admin"},"app_metadata":{"role":"admin"}}',false)`,
    );
    expect(
      (
        await db.query<{ role: string }>(
          "select private.current_role() as role",
        )
      ).rows[0].role,
    ).toBe("agent");
    await expect(
      db.query(
        "insert into public.invoices(number,customer_id,billing_name) values('BLOCKED',$1,'Blocked')",
        [ids.customer],
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      db.query("select public.next_document_number('invoice',2026)"),
    ).rejects.toThrow(/permission denied/i);
    expect((await db.query("select * from public.profiles")).rows).toHaveLength(
      1,
    );
  });
  it("gives accounting booking context without customer/passport/traveler access", async () => {
    await user(ids.admin);
    const booking = await db.query<{ id: string }>(
      "insert into public.bookings(customer_id,destination) values($1,$2) returning id",
      [ids.customer, "Sri Lanka"],
    );
    await db.query(
      "insert into public.travelers(booking_id,full_name,passport_number) values($1,$2,$3)",
      [booking.rows[0].id, "Amelia Carter", "PRIVATE"],
    );
    await user(ids.accountant);
    expect((await db.query("select * from public.bookings")).rows).toHaveLength(
      1,
    );
    expect(
      (await db.query("select * from public.customers")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.travelers")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update public.bookings set destination='Denied' returning id",
        )
      ).rows,
    ).toHaveLength(0);
  });
});

describe("financial invariants", () => {
  it("rounds tax in minor units and rejects inconsistent tax or monetary totals", async () => {
    await user(ids.admin);
    const quote = await db.query<{ id: string }>(
      "insert into public.quotations(number,customer_id) values('TEST-TAX',$1) returning id",
      [ids.customer],
    );
    const quotationId = quote.rows[0].id;
    // 3 x 101 = 303; discount 2 -> 301 taxable; 10% tax rounds to 30.
    await db.query(
      "insert into public.quotation_items(quotation_id,description,quantity,unit_price_minor,discount_minor,tax_rate,tax_minor,total_minor) values($1,$2,3,101,2,10,30,331)",
      [quotationId, "Taxed service"],
    );
    await expect(
      db.query(
        "insert into public.quotation_items(quotation_id,description,unit_price_minor,tax_rate,tax_minor,total_minor) values($1,$2,100,0,10,110)",
        [quotationId, "Forged tax"],
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query(
        "insert into public.quotation_items(quotation_id,description,unit_price_minor,total_minor) values($1,$2,100,99)",
        [quotationId, "Forged total"],
      ),
    ).rejects.toThrow(/check constraint/);
  });
  it("allocates distinct sequential numbers and prevents direct counter access", async () => {
    await user(ids.agent);
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        db.query<{ number: string }>(
          "select public.next_document_number('quotation',2031) as number",
        ),
      ),
    );
    const numbers = results.map((result) => result.rows[0].number);
    expect(new Set(numbers).size).toBe(12);
    expect(numbers).toContain("QT-2031-0001");
    expect(numbers).toContain("QT-2031-0012");
    await expect(
      db.query("update private.document_counters set last_value=0"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select public.next_document_number('other',2031)"),
    ).rejects.toThrow(/Invalid document/);
  });
  it("automatically numbers new quotations and invoices", async () => {
    await user(ids.admin);
    const quote = await db.query<{ number: string }>(
      "insert into public.quotations(customer_id) values($1) returning number",
      [ids.customer],
    );
    expect(quote.rows[0].number).toMatch(/^QT-\d{4}-\d{4,}$/);
    const invoice = await db.query<{ number: string }>(
      "insert into public.invoices(customer_id,billing_name) values($1,'Amelia') returning number",
      [ids.customer],
    );
    expect(invoice.rows[0].number).toMatch(/^INV-\d{4}-\d{4,}$/);
  });
  it("locks issued invoices, lines and deletes while allowing a void of an unpaid invoice", async () => {
    const id = await sent("TEST-LOCK");
    await expect(
      db.query(
        "update public.invoices set billing_name='Tampered' where id=$1",
        [id],
      ),
    ).rejects.toThrow(/immutable/);
    await expect(
      db.query("delete from public.invoices where id=$1", [id]),
    ).rejects.toThrow(/cannot be deleted/);
    await expect(
      db.query("update public.invoices set status='draft' where id=$1", [id]),
    ).rejects.toThrow(/ledger/);
    await expect(
      db.query(
        "update public.invoice_items set description='Tampered' where invoice_id=$1",
        [id],
      ),
    ).rejects.toThrow(/immutable/);
    await expect(
      db.query("delete from public.invoice_items where invoice_id=$1", [id]),
    ).rejects.toThrow(/immutable/);
    await expect(
      db.query(
        "insert into public.invoice_items(invoice_id,description,unit_price_minor,total_minor) values($1,'Added',1,1)",
        [id],
      ),
    ).rejects.toThrow(/immutable/);
    await db.query("update public.invoices set status='void' where id=$1", [
      id,
    ]);
    await expect(
      db.query("update public.invoices set status='sent' where id=$1", [id]),
    ).rejects.toThrow();
  });
  it("allows deletion of draft invoices and their cascaded lines", async () => {
    const id = await draft("TEST-DRAFT-DELETE");
    await db.query("delete from public.invoices where id=$1", [id]);
    expect(
      (
        await db.query(
          "select * from public.invoice_items where invoice_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("prevents moving line items into or out of an issued invoice", async () => {
    const issued = await sent("TEST-REPARENT-SENT");
    const editable = await draft("TEST-REPARENT-DRAFT");
    await expect(
      db.query(
        "update public.invoice_items set invoice_id=$1 where invoice_id=$2",
        [editable, issued],
      ),
    ).rejects.toThrow(/immutable/);
    await expect(
      db.query(
        "update public.invoice_items set invoice_id=$1 where invoice_id=$2",
        [issued, editable],
      ),
    ).rejects.toThrow(/immutable/);
  });
  it("rejects issuing mismatched totals or empty invoices", async () => {
    const id = await draft("TEST-MISMATCH");
    await db.query(
      "update public.invoices set subtotal_minor=9999,total_minor=9999 where id=$1",
      [id],
    );
    await expect(
      db.query("update public.invoices set status='sent' where id=$1", [id]),
    ).rejects.toThrow(/match line items/);
    const empty = await db.query<{ id: string }>(
      "insert into public.invoices(number,customer_id,billing_name) values('TEST-EMPTY',$1,'Empty') returning id",
      [ids.customer],
    );
    await expect(
      db.query("update public.invoices set status='sent' where id=$1", [
        empty.rows[0].id,
      ]),
    ).rejects.toThrow(/needs line items/);
  });
  it("records partial and full payments atomically and prevents overpayment or edits", async () => {
    const id = await sent("TEST-PAYMENT");
    await user(ids.accountant);
    await expect(
      db.query("update public.invoices set paid_minor=4000 where id=$1", [id]),
    ).rejects.toThrow(/ledger/);
    const payment = await db.query<{ id: string }>(
      "insert into public.payments(invoice_id,amount_minor,method) values($1,4000,'bank_transfer') returning id",
      [id],
    );
    let invoice = await db.query<{ status: string; paid_minor: number }>(
      "select status,paid_minor from public.invoices where id=$1",
      [id],
    );
    expect(invoice.rows[0]).toEqual({
      status: "partially_paid",
      paid_minor: 4000,
    });
    await expect(
      db.query("update public.invoices set status='void' where id=$1", [id]),
    ).rejects.toThrow(/credit note/);
    await expect(
      db.query(
        "insert into public.payments(invoice_id,amount_minor,method) values($1,6001,'cash')",
        [id],
      ),
    ).rejects.toThrow(/exceeds/);
    await expect(
      db.query("update public.payments set amount_minor=5000 where id=$1", [
        payment.rows[0].id,
      ]),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.query("delete from public.payments where id=$1", [payment.rows[0].id]),
    ).rejects.toThrow(/append-only/);
    await db.query(
      "insert into public.payments(invoice_id,amount_minor,method) values($1,6000,'cash')",
      [id],
    );
    invoice = await db.query(
      "select status,paid_minor from public.invoices where id=$1",
      [id],
    );
    expect(invoice.rows[0]).toEqual({ status: "paid", paid_minor: 10000 });
  });
  it("rejects payments against a draft or void invoice", async () => {
    const id = await draft("TEST-NOT-SENT");
    await expect(
      db.query(
        "insert into public.payments(invoice_id,amount_minor,method) values($1,100,'cash')",
        [id],
      ),
    ).rejects.toThrow(/issued open/);
    await db.query("update public.invoices set status='void' where id=$1", [
      id,
    ]);
    await expect(
      db.query(
        "insert into public.payments(invoice_id,amount_minor,method) values($1,100,'cash')",
        [id],
      ),
    ).rejects.toThrow(/issued open/);
  });
  it("audits financial changes and prevents tampering even by admins", async () => {
    const id = await sent("TEST-AUDIT");
    const audit = await db.query<{ operation: string; actor_id: string }>(
      "select operation,actor_id from public.audit_log where record_id=$1 order by created_at",
      [id],
    );
    expect(audit.rows.map((row) => row.operation)).toEqual([
      "INSERT",
      "UPDATE",
    ]);
    expect(audit.rows.every((row) => row.actor_id === ids.admin)).toBe(true);
    await expect(db.query("delete from public.audit_log")).rejects.toThrow(
      /permission denied/,
    );
    await user(ids.agent);
    expect(
      (await db.query("select * from public.audit_log")).rows,
    ).toHaveLength(0);
  });
  it("issues credit notes without permitting credits above the original invoice total", async () => {
    const original = await sent("TEST-CREDIT-ORIGINAL");
    const createCredit = async (amount: number) => {
      const result = await db.query<{ id: string; number: string }>(
        "insert into public.invoices(customer_id,billing_name,document_type,credited_invoice_id,subtotal_minor,total_minor) values($1,'Amelia','credit_note',$2,$3,$3) returning id,number",
        [ids.customer, original, amount],
      );
      const credit = result.rows[0];
      expect(credit.number).toMatch(/^CN-\d{4}-\d{4,}$/);
      await db.query(
        "insert into public.invoice_items(invoice_id,description,unit_price_minor,total_minor) values($1,'Cancellation credit',$2,$2)",
        [credit.id, amount],
      );
      return credit.id;
    };
    const first = await createCredit(6000);
    await db.query("update public.invoices set status='sent' where id=$1", [
      first,
    ]);
    const second = await createCredit(5000);
    await expect(
      db.query("update public.invoices set status='sent' where id=$1", [
        second,
      ]),
    ).rejects.toThrow(/exceed original/);
    await expect(
      db.query(
        "insert into public.payments(invoice_id,amount_minor,method) values($1,100,'cash')",
        [first],
      ),
    ).rejects.toThrow(/issued open/);
  });
});

describe("private file storage policies", () => {
  it("keeps buckets private and limits uploads to role-specific folders", async () => {
    expect(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets",
        )
      ).rows.every((row) => !row.public),
    ).toBe(true);
    await user(ids.agent);
    await db.query(
      "insert into storage.objects(bucket_id,name) values('document-pdfs','itineraries/test/document.pdf')",
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('document-pdfs','invoices/test/document.pdf')",
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('company-logos','logo.png')",
      ),
    ).rejects.toThrow(/row-level security/);
    await user(ids.accountant);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('document-pdfs','invoices/test/document.pdf')",
    );
    await user(ids.agent);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
  });
});
