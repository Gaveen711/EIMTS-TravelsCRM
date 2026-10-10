import "server-only";
import { serializeDevelopmentResponse } from "./serialize";
import { createClient } from "@supabase/supabase-js";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { developmentAdminId, developmentWorkspace } from "./config";

const infrastructure = `
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null);
create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[:array_length(string_to_array($1,'/'),1)-1] $$;
alter table storage.objects enable row level security;
grant usage on schema public,storage to anon,authenticated,service_role;
grant select,insert,update,delete on storage.objects to authenticated; grant execute on function storage.foldername(text) to authenticated;
`;
type Row = Record<string, unknown>;
type State = {
  db: PGlite;
  columns: Map<string, Set<string>>;
  rpc: Map<string, boolean>;
  queue: Promise<unknown>;
};
const runtime = globalThis as typeof globalThis & {
  crmDevelopmentDatabase?: Promise<State>;
};
async function initialize(): Promise<State> {
  const dataDir = resolve(process.env.CRM_LOCAL_DATA_DIR || ".crm-data");
  await mkdir(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.waitReady;
  await db.exec(
    "create table if not exists public._development_migrations(name text primary key)",
  );
  const installed = await db.query<{ name: string }>(
    "select name from public._development_migrations",
  );
  if (!installed.rows.length) await db.exec(infrastructure);
  for (const name of (await readdir(resolve("supabase/migrations")))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    if (installed.rows.some((row) => row.name === name)) continue;
    const sql = await readFile(resolve("supabase/migrations", name), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into public._development_migrations values($1)", [
        name,
      ]);
    });
  }
  await db.query(
    "insert into auth.users(id) values($1) on conflict do nothing",
    [developmentAdminId],
  );
  await db.query(
    "insert into public.profiles(id,full_name,role) values($1,'Travel consultant','admin') on conflict do nothing",
    [developmentAdminId],
  );
  await db.exec(
    "insert into public.customers(id,name,email,nationality,lead_status,tags) values('de000000-0000-4000-8000-000000000001','Amelia Carter','amelia@example.com','British','contacted',array['Culture','Private tour']) on conflict do nothing; insert into public.suppliers(id,name,kind,email,payment_terms) values('de000000-0000-4000-8000-000000000011','Ceylon Garden Lodge','hotel','reservations@example.com','30% deposit, balance before arrival') on conflict do nothing; insert into public.services(id,supplier_id,name,category,currency,cost_minor,selling_minor,tax_rate) values('de000000-0000-4000-8000-000000000021','de000000-0000-4000-8000-000000000011','Garden lodge double room / night','hotel','USD',9500,12500,0) on conflict do nothing;",
  );
  const metadata = await db.query<{ table_name: string; column_name: string }>(
    "select table_name,column_name from information_schema.columns where table_schema='public' and table_name <> '_development_migrations'",
  );
  const columns = new Map<string, Set<string>>();
  for (const row of metadata.rows) {
    if (!columns.has(row.table_name)) columns.set(row.table_name, new Set());
    columns.get(row.table_name)!.add(row.column_name);
  }
  const functions = await db.query<{ proname: string; proretset: boolean }>(
    "select proname,proretset from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'",
  );
  return {
    db,
    columns,
    rpc: new Map(functions.rows.map((row) => [row.proname, row.proretset])),
    queue: Promise.resolve(),
  };
}
const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(body === undefined ? null : serializeDevelopmentResponse(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
function sqlValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? JSON.stringify(value)
    : value;
}
async function request(
  state: State,
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const req = new Request(input, init),
    url = new URL(req.url);
  const body =
    req.method === "GET" || req.method === "HEAD"
      ? null
      : await req.json().catch(() => null);
  await state.db.exec("reset role; set role authenticated");
  await state.db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    developmentAdminId,
  ]);
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const name = url.pathname.split("/").pop()!;
    if (!state.rpc.has(name) || !/^[a-z_]+$/.test(name))
      return json({ message: "Unknown operation" }, 404);
    const args = Object.entries(body || {});
    if (args.some(([key]) => !/^p_[a-z_]+$/.test(key)))
      return json({ message: "Invalid operation parameters" }, 400);
    const invocation = `public.${name}(${args.map(([key], i) => `${key} => $${i + 1}`).join(",")})`;
    const query = state.rpc.get(name)
      ? `select coalesce(jsonb_agg(result),'[]'::jsonb) as value from ${invocation} result`
      : `select ${invocation} as value`;
    const result = await state.db.query<{ value: unknown }>(
      query,
      args.map(([, value]) => sqlValue(value)),
    );
    return json(result.rows[0]?.value);
  }
  const table = url.pathname.split("/").pop()!,
    valid = state.columns.get(table);
  if (!valid || !/^[a-z_]+$/.test(table))
    return json({ message: "Unknown relation" }, 404);
  const params: unknown[] = [],
    conditions: string[] = [];
  const bind = (value: unknown) => {
    params.push(sqlValue(value));
    return `$${params.length}`;
  };
  function compare(column: string, operation: string, value: string): string {
    if (!valid!.has(column)) throw new Error("Unknown query column");
    if (["eq", "neq", "gt", "gte", "lt", "lte"].includes(operation))
      return `${column} ${{ eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[operation]} ${bind(value)}`;
    if (operation === "ilike")
      return `${column} ilike ${bind(value.replaceAll("*", "%"))}`;
    if (operation === "is" && value === "null") return `${column} is null`;
    if (operation === "not.is" && value === "null")
      return `${column} is not null`;
    if (operation === "in")
      return `${column} = any(${bind(value.replace(/^\(|\)$/g, "").split(","))})`;
    if (operation === "wfts(simple)")
      return `${column} @@ websearch_to_tsquery('simple',${bind(value)})`;
    throw new Error("Unsupported query filter");
  }
  for (const [key, value] of url.searchParams) {
    if (valid.has(key)) {
      const dot = value.indexOf(".");
      conditions.push(compare(key, value.slice(0, dot), value.slice(dot + 1)));
    }
    if (key === "or")
      conditions.push(
        "(" +
          value
            .replace(/^\(|\)$/g, "")
            .split(",")
            .map((part) => {
              const match = part.match(/^([a-z_]+)\.([a-z]+)\.(.*)$/);
              if (!match) throw new Error("Invalid filter");
              return compare(match[1], match[2], match[3]);
            })
            .join(" or ") +
          ")",
      );
  }
  const where = conditions.length ? ` where ${conditions.join(" and ")}` : "";
  let rows: Row[] = [],
    total = 0;
  if (req.method === "GET" || req.method === "HEAD") {
    total = Number(
      (
        await state.db.query<{ count: string }>(
          `select count(*)::text as count from public.${table}${where}`,
          params,
        )
      ).rows[0].count,
    );
    const order = (url.searchParams.get("order") || "")
      .split(",")
      .filter(Boolean)
      .map((part) => {
        const [column, direction] = part.split(".");
        if (!valid.has(column)) throw new Error("Invalid ordering");
        return `${column} ${direction === "desc" ? "desc" : "asc"}`;
      })
      .join(",");
    const limit = Number(url.searchParams.get("limit") || 1000),
      offset = Number(url.searchParams.get("offset") || 0);
    if (
      !Number.isInteger(limit) ||
      limit < 0 ||
      limit > 10000 ||
      !Number.isInteger(offset) ||
      offset < 0
    )
      throw new Error("Invalid pagination");
    rows = (
      await state.db.query<Row>(
        `select * from public.${table}${where}${order ? ` order by ${order}` : ""} limit ${limit} offset ${offset}`,
        params,
      )
    ).rows;
    const selection = url.searchParams.get("select") || "*";
    const relations = selection.matchAll(
      /(?:([a-z_]+):)?([a-z_]+)\(([^()]*)\)/g,
    );
    for (const relation of relations) {
      const alias = relation[1] || relation[2],
        target = relation[2];
      if (!state.columns.has(target)) throw new Error("Invalid related table");
      const singular = target.endsWith("ies")
        ? target.slice(0, -3) + "y"
        : target.replace(/s$/, "");
      const parentSingular = table.endsWith("ies")
        ? table.slice(0, -3) + "y"
        : table.replace(/s$/, "");
      const ownFk = `${singular}_id`,
        childFk = `${parentSingular}_id`;
      for (const row of rows) {
        if (valid.has(ownFk))
          row[alias] =
            (
              await state.db.query<Row>(
                `select * from public.${target} where id=$1`,
                [row[ownFk]],
              )
            ).rows[0] || null;
        else if (state.columns.get(target)!.has(childFk))
          row[alias] = (
            await state.db.query<Row>(
              `select * from public.${target} where ${childFk}=$1`,
              [row.id],
            )
          ).rows;
      }
    }
    if (!selection.includes("*") && !selection.includes("(")) {
      const selected = selection.split(",");
      if (selected.some((key) => !valid.has(key)))
        throw new Error("Invalid selection");
      rows = rows.map((row) =>
        Object.fromEntries(selected.map((key) => [key, row[key]])),
      );
    }
    const headers = {
      "Content-Range": `${total ? `${offset}-${offset + rows.length - 1}` : "*"}/${total}`,
    };
    if (req.method === "HEAD") return json(undefined, 200, headers);
    if ((req.headers.get("accept") || "").includes("vnd.pgrst.object"))
      return rows.length === 1
        ? json(rows[0], 200, headers)
        : json({ code: "PGRST116", message: "Record not found" }, 406, headers);
    return json(rows, 200, headers);
  }
  if (req.method === "POST") {
    const inputs = Array.isArray(body) ? body : [body];
    for (const row of inputs) {
      const keys = Object.keys(row);
      if (!keys.length || keys.some((key) => !valid.has(key)))
        throw new Error("Invalid record fields");
      rows.push(
        ...(
          await state.db.query<Row>(
            `insert into public.${table}(${keys.join(",")}) values(${keys.map((_, i) => `$${i + 1}`).join(",")}) returning *`,
            keys.map((key) => sqlValue(row[key])),
          )
        ).rows,
      );
    }
  } else if (req.method === "PATCH") {
    const keys = Object.keys(body);
    if (!keys.length || keys.some((key) => !valid.has(key)))
      throw new Error("Invalid record fields");
    rows = (
      await state.db.query<Row>(
        `update public.${table} set ${keys.map((key) => `${key}=${bind(body[key])}`).join(",")}${where} returning *`,
        params,
      )
    ).rows;
  } else if (req.method === "DELETE")
    rows = (
      await state.db.query<Row>(
        `delete from public.${table}${where} returning *`,
        params,
      )
    ).rows;
  else return json({ message: "Unsupported operation" }, 405);
  const single = (req.headers.get("accept") || "").includes("vnd.pgrst.object");
  return single && rows.length !== 1
    ? json({ code: "PGRST116", message: "Record not found" }, 406)
    : json(single ? rows[0] : rows, req.method === "POST" ? 201 : 200);
}
async function localFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (!developmentWorkspace())
    throw new Error("Local workspace is disabled outside development.");
  const state = await (runtime.crmDevelopmentDatabase ||= initialize());
  const result = state.queue.then(() => request(state, input, init));
  state.queue = result.catch(() => {});
  try {
    return await result;
  } catch (error) {
    return json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Local database operation failed",
        code: (error as { code?: string }).code || "local_error",
      },
      400,
    );
  }
}
export function createDevelopmentClient() {
  if (!developmentWorkspace()) throw new Error("Local workspace is disabled.");
  return createClient("http://local-workspace.invalid", "development-only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: localFetch },
  });
}
