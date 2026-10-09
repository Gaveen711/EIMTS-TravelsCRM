// Isolated test infrastructure. Never imported by production app code.
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const secret = "local-test-provider-only";
const ids = { admin: "a1000000-0000-4000-8000-000000000001", agent: "a1000000-0000-4000-8000-000000000002", accountant: "a1000000-0000-4000-8000-000000000003" };
type Role = keyof typeof ids;
function token(role: Role) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const value = encode({ alg: "HS256", typ: "JWT" }) + "." + encode({ sub: ids[role], aud: "authenticated", role: "authenticated", email: role + "@fixture.test", exp: Math.floor(Date.now()/1000)+3600, iat: Math.floor(Date.now()/1000) });
  return value + "." + createHmac("sha256", secret).update(value).digest("base64url");
}
function identity(bearer: string | undefined): Role | null {
  try {
    const [head, body, signature] = (bearer ?? "").replace(/^Bearer /, "").split(".");
    const expected = createHmac("sha256", secret).update(head+"."+body).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(body,"base64url").toString());
    if (claims.exp < Date.now()/1000) return null;
    return (Object.keys(ids) as Role[]).find(role => ids[role] === claims.sub) ?? null;
  } catch { return null; }
}
const user = (role: Role) => ({ id: ids[role], aud: "authenticated", role: "authenticated", email: role+"@fixture.test", email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email" }, user_metadata: {}, created_at: new Date().toISOString() });
const session = (role: Role) => ({ access_token: token(role), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, refresh_token: "fixture-refresh-"+role, user: user(role) });

async function main() {
const db = new PGlite();
await db.exec(`
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
`);
for (const file of readdirSync(resolve("supabase/migrations")).filter(f=>f.endsWith(".sql")).sort())
  await db.exec(readFileSync(resolve("supabase/migrations",file),"utf8"));
for (const role of Object.keys(ids) as Role[]) {
  await db.query<Record<string,unknown>>("insert into auth.users(id) values($1)",[ids[role]]);
  await db.query<Record<string,unknown>>("insert into public.profiles(id,full_name,role) values($1,$2,$3)",[ids[role],"Fixture "+role,role]);
}
const tables = new Set(["profiles","customers","activities","suppliers","services"]);
const columns = new Map<string,Set<string>>();
for (const table of tables) {
  const result = await db.query<{column_name:string}>("select column_name from information_schema.columns where table_schema='public' and table_name=$1",[table]);
  columns.set(table,new Set(result.rows.map(r=>r.column_name)));
}
let queue: Promise<unknown> = Promise.resolve();
const server = createServer((req,res)=>{
 const run = async () => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:3101");
  const send = (status:number,data:unknown) => { res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"}); res.end(data===undefined?undefined:JSON.stringify(data)); };
  if (url.pathname === "/health") return send(200,{ready:true});
  let raw = ""; for await (const chunk of req) { raw += chunk.toString(); if (raw.length > 6_000_000) return send(413,{message:"Payload too large"}); }
  const body = raw ? JSON.parse(raw) : {};
  if (url.pathname === "/auth/v1/token") {
    const role = (Object.keys(ids) as Role[]).find(role=>body.email===role+"@fixture.test" && body.password==="fixture-password-123" || body.refresh_token==="fixture-refresh-"+role);
    return role ? send(200,session(role)) : send(400,{error:"invalid_grant",error_description:"Invalid fixture credentials"});
  }
  const role = identity(req.headers.authorization);
  if (!role) return send(401,{message:"Invalid test provider token",code:"invalid_token"});
  if (url.pathname === "/auth/v1/user") return send(200,user(role));
  if (url.pathname === "/auth/v1/logout") return send(204,undefined);
  await db.exec("reset role; set role authenticated");
  await db.query<Record<string,unknown>>("select set_config('request.jwt.claim.sub',$1,false)",[ids[role]]);
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const name = url.pathname.split("/").pop()!;
    if (!["save_customer","import_customers","add_customer_note"].includes(name)) return send(404,{message:"Unknown fixture RPC"});
    const args = Object.entries(body);
    if (args.some(([name])=>!/^p_[a-z_]+$/.test(name))) return send(400,{message:"Invalid RPC parameter"});
    const result = await db.query<{value:unknown}>("select public."+name+"("+args.map(([key],i)=>key+" => $"+(i+1)).join(",")+") as value",args.map(([,value])=>typeof value==="object" && value!==null ? JSON.stringify(value):value));
    return send(200,result.rows[0].value);
  }
  const table = url.pathname.split("/").pop()!;
  if (!tables.has(table)) return send(404,{message:"Unknown fixture relation"});
  const valid = columns.get(table)!;
  const params: unknown[] = [];
  const binds = (value:unknown) => {params.push(value);return "$"+params.length;};
  const conditions: string[]=[];
  const compare = (column:string, operation:string, value:string) => {
    if (!valid.has(column)) throw new Error("Unknown fixture column");
    if (operation==="eq") return column+" = "+binds(value);
    if (operation==="lte") return column+" <= "+binds(value);
    if (operation==="ilike") return column+" ilike "+binds(value.replaceAll("*","%"));
    if (operation==="is" && value==="null") return column+" is null";
    if (operation==="wfts(simple)") return column+" @@ websearch_to_tsquery('simple',"+binds(value)+")";
    throw new Error("Unsupported fixture filter "+operation);
  };
  for (const [key,value] of url.searchParams) {
    if (valid.has(key)) { const dot=value.indexOf(".");conditions.push(compare(key,value.slice(0,dot),value.slice(dot+1))); }
    if (key==="or") {
      const alternatives=value.replace(/^\(|\)$/g,"").split(",").map(part=>{const match=part.match(/^([a-z_]+)\.([a-z]+)\.(.*)$/);if(!match)throw new Error("Invalid OR filter");return compare(match[1],match[2],match[3]);});
      conditions.push("("+alternatives.join(" or ")+")");
    }
  }
  const where=conditions.length?" where "+conditions.join(" and "):"";
  let rows: Record<string,unknown>[]=[];
  let total=0;
  if (req.method==="GET" || req.method==="HEAD") {
    const count=await db.query<{count:string}>("select count(*)::text as count from public."+table+where,params);
    total=Number(count.rows[0].count);
    const order=(url.searchParams.get("order")??"").split(",").filter(Boolean).map(part=>{const [col,direction]=part.split(".");if(!valid.has(col))throw new Error("Invalid order");return col+" "+(direction==="desc"?"desc":"asc");}).join(",");
    const offset=Number(url.searchParams.get("offset")??0),limit=Number(url.searchParams.get("limit")??1000);
    if (!Number.isInteger(offset) || offset<0 || !Number.isInteger(limit)||limit<0||limit>10000) throw new Error("Invalid range");
    const result=await db.query<Record<string,unknown>>("select * from public."+table+where+(order?" order by "+order:"")+" limit "+limit+" offset "+offset,params);
    rows=result.rows;
    if (table==="services" && (url.searchParams.get("select")??"").includes("suppliers")) {
      for (const row of rows) { const supplier=await db.query<Record<string,unknown>>("select id,name from public.suppliers where id=$1",[row.supplier_id]); row.supplier=supplier.rows[0]??null;row.suppliers=row.supplier; }
    }
    res.setHeader("Content-Range",(total?offset+"-"+(offset+rows.length-1):"*")+"/"+total);
  } else if (req.method==="POST") {
    const inputs=Array.isArray(body)?body:[body];
    for(const row of inputs) {
      const keys=Object.keys(row);if(!keys.length||keys.some(k=>!valid.has(k)))throw new Error("Invalid insert");
      const result=await db.query<Record<string,unknown>>("insert into public."+table+"("+keys.join(",")+") values("+keys.map((_,i)=>"$"+(i+1)).join(",")+") returning *",keys.map(k=>row[k]));
      rows.push(...result.rows);
    }
  } else if (req.method==="PATCH") {
    const keys=Object.keys(body);if(!keys.length||keys.some(k=>!valid.has(k)))throw new Error("Invalid update");
    const result=await db.query<Record<string,unknown>>("update public."+table+" set "+keys.map(key=>key+"="+binds(body[key])).join(",")+where+" returning *",params);
    rows=result.rows;
  } else if (req.method==="DELETE") {
    rows=(await db.query<Record<string,unknown>>("delete from public."+table+where+" returning *",params)).rows;
  } else return send(405,{message:"Unsupported fixture method"});
  const single=(req.headers.accept??"").includes("vnd.pgrst.object");
  if(single && rows.length!==1)return send(406,{code:"PGRST116",message:"JSON object requested, multiple (or no) rows returned"});
  return send(req.method==="POST"?201:200,single?rows[0]:rows);
 };
 const current = queue.then(run);
 queue = current.catch(()=>{});
 void current.catch((error:unknown)=>{console.error("Fixture request failed", req.method, req.url, (error as {code?:string}).code, error instanceof Error ? error.message : error);if(!res.headersSent){res.writeHead(400,{"Content-Type":"application/json"});res.end(JSON.stringify({message:error instanceof Error?error.message:"Fixture error",code: (error as {code?:string}).code ?? "fixture_error"}));}});
});
server.listen(3101,"127.0.0.1",()=>console.log("Test-only Supabase fixture ready on 3101"));
const close=()=>server.close(()=>{void db.close().then(()=>process.exit(0));});
process.on("SIGINT",close);process.on("SIGTERM",close);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
