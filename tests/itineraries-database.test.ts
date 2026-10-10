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

import {
  blankItinerary,
  itineraryPayload,
} from "../src/lib/itineraries/schema";
async function saveTrip(customer: string, id: string | null = null) {
  const payload = itineraryPayload(blankItinerary(customer));
  return (
    await db.query<{ id: string }>(
      "select public.save_itinerary($1::jsonb,$2::jsonb,$3::uuid) as id",
      [JSON.stringify(payload.header), JSON.stringify(payload.days), id],
    )
  ).rows[0].id;
}
describe("Native itinerary persistence", () => {
  it("saves header and ordered days atomically; duplicating starts without a shared token", async () => {
    await role("agent");
    const customer = await save({ name: "Itinerary traveler" });
    const id = await saveTrip(customer);
    await db.query("select public.set_itinerary_share($1,true)", [id]);
    const copy = (
      await db.query<{ id: string }>(
        "select public.duplicate_itinerary($1) as id",
        [id],
      )
    ).rows[0].id;
    expect(copy).not.toBe(id);
    const header = (
      await db.query<{ title: string; share_token: string | null }>(
        "select title,share_token from public.itineraries where id=$1",
        [copy],
      )
    ).rows[0];
    expect(header.title).toMatch(/\(copy\)$/);
    expect(header.share_token).toBeNull();
    expect(
      (
        await db.query(
          "select * from public.itinerary_days where itinerary_id=$1",
          [copy],
        )
      ).rows,
    ).toHaveLength(1);
    const payload = itineraryPayload(blankItinerary(customer));
    payload.days[0].title = "";
    await expect(
      db.query("select public.save_itinerary($1::jsonb,$2::jsonb,$3)", [
        JSON.stringify(payload.header),
        JSON.stringify(payload.days),
        id,
      ]),
    ).rejects.toThrow(/Invalid itinerary day/);
    expect(
      (
        await db.query(
          "select * from public.itinerary_days where itinerary_id=$1",
          [id],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("rotates and revokes share links with expiry without exposing anonymous table access", async () => {
    await role("admin");
    const customer = await save({ name: "Share traveler" });
    const id = await saveTrip(customer);
    const token1 = (
      await db.query<{ token: string }>(
        "select public.set_itinerary_share($1,true) as token",
        [id],
      )
    ).rows[0].token;
    const token2 = (
      await db.query<{ token: string }>(
        "select public.set_itinerary_share($1,true) as token",
        [id],
      )
    ).rows[0].token;
    expect(token1).not.toBe(token2);
    await db.query("select public.set_itinerary_share($1,false)", [id]);
    expect(
      (
        await db.query<{ share_token: string | null }>(
          "select share_token from public.itineraries where id=$1",
          [id],
        )
      ).rows[0].share_token,
    ).toBeNull();
    await db.exec("reset role; set role anon");
    await expect(
      db.query("select public.set_itinerary_share($1,true)", [id]),
    ).rejects.toThrow(/permission denied/);
  });
  it("rejects accountant mutations and direct malformed prices and trip dates", async () => {
    await role("admin");
    const customer = await save({ name: "Restricted trip" });
    const payload = itineraryPayload(blankItinerary(customer));
    payload.header.end_date = "2099-12-31";
    await expect(
      db.query("select public.save_itinerary($1::jsonb,$2::jsonb)", [
        JSON.stringify(payload.header),
        JSON.stringify(payload.days),
      ]),
    ).rejects.toThrow(/Trip dates/);
    await role("accountant");
    await expect(saveTrip(customer)).rejects.toThrow(/permission denied/);
  });
});

describe("Native itinerary database boundaries", () => {
  it("rejects null, fractional, discounted-below-zero and excessive financial values atomically", async () => {
    await role("agent");
    const customer = await save({ name: "Native price validation" });
    const payload = itineraryPayload(blankItinerary(customer));
    const line = {
      description: "Private journey",
      quantity: "1",
      unit_price_minor: 100,
      cost_minor: 50,
      discount_minor: 0,
      tax_rate: "0",
      service_id: null,
      supplier_id: null,
    };
    for (const patch of [
      { quantity: null },
      { unit_price_minor: 1.5 },
      { cost_minor: null },
      { discount_minor: 101 },
      { quantity: "1.0001" },
      { tax_rate: "100.0001" },
      { unit_price_minor: 9007199254740992 },
    ]) {
      const header = {
        ...payload.header,
        legacy_content: {
          ...payload.header.legacy_content,
          pricing: [{ ...line, ...patch }],
        },
      };
      await expect(
        db.query("select public.save_itinerary($1::jsonb,$2::jsonb)", [
          JSON.stringify(header),
          JSON.stringify(payload.days),
        ]),
      ).rejects.toThrow(/Invalid native itinerary/);
    }
    expect(
      (
        await db.query(
          "select id from public.itineraries where customer_id=$1",
          [customer],
        )
      ).rows,
    ).toHaveLength(0);
  });
});

describe("Foundation seed compatibility", () => {
  it("duplicates normalized foundation itineraries with native defaults and preserved days", async () => {
    await role("admin");
    const customer = await save({ name: "Foundation traveler" });
    const id = (
      await db.query<{ id: string }>(
        "insert into public.itineraries(customer_id,title,start_date,end_date,traveler_count) values($1,'Foundation journey','2027-02-12','2027-02-13',4) returning id",
        [customer],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.itinerary_days(itinerary_id,day_number,title,description) values($1,1,'Arrival','Meet your driver'),($1,2,'Departure','Airport transfer')",
      [id],
    );
    const copied = (
      await db.query<{ id: string }>(
        "select public.duplicate_itinerary($1) as id",
        [id],
      )
    ).rows[0].id;
    const result = (
      await db.query<{
        legacy_content: { version: number; adults: number; pricing: unknown[] };
      }>("select legacy_content from public.itineraries where id=$1", [copied])
    ).rows[0];
    expect(result.legacy_content.version).toBe(1);
    expect(result.legacy_content.adults).toBe(4);
    expect(result.legacy_content.pricing).toEqual([]);
    expect(
      (
        await db.query(
          "select id from public.itinerary_days where itinerary_id=$1",
          [copied],
        )
      ).rows,
    ).toHaveLength(2);
  });
});

describe("Private itinerary photo storage", () => {
  it("allows agency sales roles and denies accountant photo access", async () => {
    await role("agent");
    const photo = (
      await db.query<{ id: string }>(
        "insert into storage.objects(bucket_id,name) values('itinerary-images','itineraries/test-photo.jpg') returning id",
      )
    ).rows[0].id;
    expect(
      (await db.query("select id from storage.objects where id=$1", [photo]))
        .rows,
    ).toHaveLength(1);
    await role("accountant");
    expect(
      (await db.query("select id from storage.objects where id=$1", [photo]))
        .rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('itinerary-images','blocked.jpg')",
      ),
    ).rejects.toThrow(/row-level security/);
    await role("admin");
    expect(
      (await db.query("select id from storage.objects where id=$1", [photo]))
        .rows,
    ).toHaveLength(1);
  });
});
