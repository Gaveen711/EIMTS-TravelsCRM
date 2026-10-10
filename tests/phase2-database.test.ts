import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
let db: PGlite;
const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  agent: "10000000-0000-4000-8000-000000000002",
  accountant: "10000000-0000-4000-8000-000000000003",
};
async function role(name: keyof typeof ids) {
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[name],
  ]);
}
async function save(customer: object, id: string | null = null) {
  return (
    await db.query<{ id: string }>(
      "select public.save_customer($1::jsonb,$2::uuid) as id",
      [JSON.stringify(customer), id],
    )
  ).rows[0].id;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;
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
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(resolve(dir, file), "utf8"));
  for (const [name, id] of Object.entries(ids)) {
    await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query(
      "insert into public.profiles(id,full_name,role) values($1,$2,$2)",
      [id, name],
    );
  }
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("Phase 2 transactional customer API", () => {
  it("saves and changes leads atomically with attributed timeline entries", async () => {
    await role("agent");
    const id = await save({
      name: "Amelia Carter",
      email: "amelia@example.com",
      tags: ["VIP"],
    });
    await save(
      { name: "Amelia Carter", lead_status: "contacted", tags: ["VIP"] },
      id,
    );
    await db.query("select public.add_customer_note($1,$2)", [
      id,
      "Called about honeymoon dates",
    ]);
    const events = await db.query<{ kind: string; actor_id: string }>(
      "select kind,actor_id from public.activities where customer_id=$1 order by created_at",
      [id],
    );
    expect(events.rows.map((r) => r.kind)).toEqual([
      "created",
      "status_changed",
      "note",
    ]);
    expect(events.rows.every((r) => r.actor_id === ids.agent)).toBe(true);
    await expect(save({ name: "", lead_status: "won" }, id)).rejects.toThrow(
      /check constraint/,
    );
    expect(
      (
        await db.query<{ lead_status: string }>(
          "select lead_status from public.customers where id=$1",
          [id],
        )
      ).rows[0].lead_status,
    ).toBe("contacted");
    expect(
      (
        await db.query(
          "select id from public.activities where customer_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(3);
  });
  it("indexes normalized company and customer contact search", async () => {
    await role("agent");
    const id = await save({
      name: "Corporate contact",
      company_name: "Northern Trails",
      email: "corporate@example.com",
    });
    const found = await db.query<{ id: string }>(
      "select id from public.customers where search_document @@ websearch_to_tsquery('simple','northern')",
    );
    expect(found.rows.map((r) => r.id)).toContain(id);
  });
  it("rolls back all imported customers and timeline entries if one row is invalid", async () => {
    await role("admin");
    const before = (
      await db.query<{ count: number }>(
        "select count(*)::integer as count from public.customers",
      )
    ).rows[0].count;
    await expect(
      db.query("select public.import_customers($1::jsonb)", [
        JSON.stringify([
          { name: "Atomic valid" },
          { name: "Invalid", email: "broken" },
        ]),
      ]),
    ).rejects.toThrow(/check constraint/);
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::integer as count from public.customers",
        )
      ).rows[0].count,
    ).toBe(before);
    expect(
      (
        await db.query(
          "select id from public.customers where name='Atomic valid'",
        )
      ).rows,
    ).toHaveLength(0);
    const result = await db.query<{ count: number }>(
      "select public.import_customers($1::jsonb) as count",
      [JSON.stringify([{ name: "Import A" }, { name: "Import B" }])],
    );
    expect(result.rows[0].count).toBe(2);
  });
  it("rejects unauthorized accountant and anonymous RPC callers", async () => {
    await role("accountant");
    await expect(save({ name: "Denied" })).rejects.toThrow(
      /permission denied/i,
    );
    await expect(
      db.query(
        'select public.import_customers(\'[{"name":"Denied"}]\'::jsonb)',
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.query("select public.add_customer_note(gen_random_uuid(),'Denied')"),
    ).rejects.toThrow(/permission denied/i);
    await db.exec("reset role; set role anon");
    await expect(save({ name: "Denied" })).rejects.toThrow(
      /permission denied/i,
    );
    await expect(
      db.query("select public.import_customers('[]'::jsonb)"),
    ).rejects.toThrow(/permission denied/i);
  });
  it("rejects invalid shapes, actor spoofing, tag types and oversize imports", async () => {
    await role("agent");
    for (const input of [
      { name: "Spoof", created_by: ids.admin },
      { name: 123 },
      { name: "Bad tags", tags: [1] },
      { name: "Long tag", tags: ["x".repeat(41)] },
    ])
      await expect(save(input)).rejects.toThrow();
    await expect(
      db.query("select public.import_customers($1::jsonb)", [
        JSON.stringify(
          Array.from({ length: 201 }, () => ({ name: "Oversize" })),
        ),
      ]),
    ).rejects.toThrow(/size/);
    await expect(
      db.query("select public.import_customers('{}'::jsonb)"),
    ).rejects.toThrow(/array/);
  });
  it("enforces catalog data boundaries even for direct API writes", async () => {
    await role("agent");
    await expect(
      db.query(
        "insert into public.suppliers(name,kind,email) values('Hotel','hotel','broken')",
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query(
        "insert into public.services(name,category) values('Tour','unsupported')",
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query(
        "insert into public.services(name,cost_minor) values('Tour',9007199254740992)",
      ),
    ).rejects.toThrow(/check constraint/);
    const supplier = (
      await db.query<{ id: string }>(
        "insert into public.suppliers(name,kind) values('Cinnamon Hotel','hotel') returning id",
      )
    ).rows[0].id;
    await db.query(
      "insert into public.services(name,supplier_id,category,cost_minor,selling_minor) values('Suite',$1,'hotel',90000,120000)",
      [supplier],
    );
    await role("accountant");
    expect((await db.query("select * from public.services")).rows).toHaveLength(
      1,
    );
    await expect(
      db.query("insert into public.services(name) values('Denied')"),
    ).rejects.toThrow(/row-level security/);
  });
  it("keeps exposed mutation functions invoker-only and denies PUBLIC execution", async () => {
    await db.exec("reset role");
    const result = await db.query<{ proname: string; prosecdef: boolean }>(
      "select proname,prosecdef from pg_proc where pronamespace='public'::regnamespace and proname in ('save_customer','import_customers','add_customer_note')",
    );
    expect(result.rows).toHaveLength(3);
    expect(result.rows.every((r) => !r.prosecdef)).toBe(true);
    const anon = await db.query<{ allowed: boolean }>(
      "select bool_or(has_function_privilege('anon',oid,'EXECUTE')) as allowed from pg_proc where pronamespace='public'::regnamespace and proname in ('save_customer','import_customers','add_customer_note')",
    );
    expect(anon.rows[0].allowed).toBe(false);
  });
});
