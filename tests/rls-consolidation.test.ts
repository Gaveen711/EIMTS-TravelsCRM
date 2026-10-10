import { PGlite } from "@electric-sql/pglite";
import { readFileSync,readdirSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll,afterAll,afterEach,describe,it,expect } from "vitest";

let db:PGlite;
const ids={admin:"b1000000-0000-4000-8000-000000000001",agent:"b1000000-0000-4000-8000-000000000002",accountant:"b1000000-0000-4000-8000-000000000003",inactive:"b1000000-0000-4000-8000-000000000004",unprofiled:"b1000000-0000-4000-8000-000000000005"};
let customer:string;
let booking:string;
async function user(name:keyof typeof ids){await db.exec("reset role;set role authenticated");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[name]]);}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null);create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[:array_length(string_to_array($1,'/'),1)-1]$$;alter table storage.objects enable row level security;grant usage on schema public,storage to anon,authenticated,service_role;grant select,insert,update,delete on storage.objects to authenticated;grant execute on function storage.foldername(text) to authenticated;");
 for(const name of readdirSync(resolve("supabase/migrations")).filter(name=>name.endsWith(".sql")).sort())await db.exec(readFileSync(resolve("supabase/migrations",name),"utf8"));
 await db.exec(readFileSync(resolve("docs/proposals/consolidate_crm_policies.sql"),"utf8"));
 for(const [name,id] of Object.entries(ids)){await db.query("insert into auth.users values($1)",[id]);if(name!=="unprofiled")await db.query("insert into public.profiles(id,full_name,role,is_active)values($1,$2,$3,$4)",[id,name,name==="inactive"?"agent":name,name!=="inactive"]);}
 customer=(await db.query<{id:string}>("insert into public.customers(name,passport_number,created_by)values('Administrator lead','SECRET-PASSPORT',$1)returning id",[ids.admin])).rows[0].id;
 await db.query("insert into public.customers(name,created_by)values('Agent lead',$1)",[ids.agent]);
 const supplier=(await db.query<{id:string}>("insert into public.suppliers(name,kind)values('Travel supplier','hotel')returning id")).rows[0].id;
 await db.query("insert into public.services(name,supplier_id)values('Hotel room',$1)",[supplier]);
 booking=(await db.query<{id:string}>("insert into public.bookings(customer_id,destination)values($1,'Yala')returning id",[customer])).rows[0].id;
 await db.query("insert into public.booking_items(booking_id,description,unit_price_minor,total_minor)values($1,'Tour',1000,1000)",[booking]);
 await db.query("insert into public.travelers(booking_id,full_name,passport_number)values($1,'Private traveler','SECRET-TRAVELER')",[booking]);
 await db.exec("insert into storage.objects(bucket_id,name)values('company-logos','logo.png'),('document-pdfs','quotations/fixture/document.pdf'),('document-pdfs','invoices/fixture/document.pdf'),('itinerary-images','fixture.png')");
},60000);
afterEach(async()=>{await db.exec("reset role;select set_config('request.jwt.claim.sub','',false)")});
afterAll(async()=>{await db?.close()});
describe("Consolidated policies preserve agency rights",()=>{
 it("keeps agency-wide sales access while administrators retain management and audit restrictions",async()=>{
  await user("agent");expect((await db.query("select name from public.customers")).rows).toHaveLength(2);
  expect((await db.query("update public.customers set notes='Contacted by another consultant' where id=$1 returning id",[customer])).rows).toHaveLength(1);
  const temp=(await db.query<{id:string}>("insert into public.customers(name)values('Temporary lead')returning id")).rows[0].id;
  expect((await db.query("delete from public.customers where id=$1 returning id",[temp])).rows).toHaveLength(1);
  await expect(db.query("insert into public.invoices(number,customer_id,billing_name)values('AGENT-DENIED',$1,'Customer')",[customer])).rejects.toThrow(/row-level security/);
  await user("admin");expect((await db.query("update public.settings set company_name='Agency administrator' returning id")).rows).toHaveLength(1);
  expect((await db.query("select id from public.profiles")).rows).toHaveLength(4);
  await expect(db.query("insert into public.audit_log(table_name,record_id,operation)values('customers',$1,'INSERT')",[customer])).rejects.toThrow(/permission denied/);
 });
 it("retains accounting read-only bookings/catalog access and append-only payment ledger mutations",async()=>{
  await user("accountant");
  for(const table of ["bookings","booking_items","suppliers","services"])expect((await db.query("select id from public."+table)).rows).toHaveLength(1);
  for(const table of ["customers","travelers"])expect((await db.query("select id from public."+table)).rows).toHaveLength(0);
  expect((await db.query("update public.bookings set notes='Denied' where id=$1 returning id",[booking])).rows).toHaveLength(0);
  await expect(db.query("insert into public.suppliers(name,kind)values('Denied','hotel')")).rejects.toThrow(/row-level security/);
  const inv=(await db.query<{id:string}>("insert into public.invoices(number,customer_id,billing_name,subtotal_minor,total_minor)values('ACCOUNT-RLS-01',$1,'Accounting customer',1000,1000)returning id",[customer])).rows[0].id;
  await db.query("insert into public.invoice_items(invoice_id,description,unit_price_minor,total_minor)values($1,'Travel service',1000,1000)",[inv]);await db.query("select public.set_invoice_status($1,'sent')",[inv]);
  await db.query("insert into public.payments(invoice_id,amount_minor,method)values($1,250,'cash')",[inv]);
  expect((await db.query<{paid_minor:number;status:string}>("select paid_minor,status from public.invoices where id=$1",[inv])).rows[0]).toEqual({paid_minor:250,status:"partially_paid"});
  await expect(db.query("delete from public.payments where invoice_id=$1",[inv])).rejects.toThrow(/append-only/);
  await expect(db.query("update public.invoice_items set description='Denied' where invoice_id=$1",[inv])).rejects.toThrow(/immutable/);
 });
 it("preserves self-profile reads without granting role escalation, settings changes or inactive/unprofiled agency access",async()=>{
  for(const name of ["agent","accountant"] as const){await user(name);expect((await db.query<{id:string}>("select id from public.profiles")).rows).toEqual([{id:ids[name]}]);expect((await db.query("update public.profiles set role='admin' where id=$1 returning id",[ids[name]])).rows).toHaveLength(0);expect((await db.query("update public.settings set company_name='Denied' returning id")).rows).toHaveLength(0);expect((await db.query("select id from public.settings")).rows).toHaveLength(1);}
  await user("inactive");expect((await db.query<{id:string}>("select id from public.profiles")).rows).toEqual([{id:ids.inactive}]);expect((await db.query("select id from public.customers")).rows).toHaveLength(0);
  await user("unprofiled");expect((await db.query("select id from public.profiles")).rows).toHaveLength(0);expect((await db.query("select id from public.customers")).rows).toHaveLength(0);
  await db.exec("reset role;set role anon");await expect(db.query("select id from public.customers")).rejects.toThrow(/permission denied/);
 });
 it("preserves storage visibility and upload boundaries by role, bucket and document folder",async()=>{
  await user("agent");expect((await db.query<{name:string}>("select name from storage.objects order by name")).rows.map(row=>row.name)).toEqual(["fixture.png","logo.png","quotations/fixture/document.pdf"]);
  await db.query("insert into storage.objects(bucket_id,name)values('itinerary-images','agent.png')");
  await expect(db.query("insert into storage.objects(bucket_id,name)values('document-pdfs','invoices/denied.pdf')")).rejects.toThrow(/row-level security/);
  await expect(db.query("insert into storage.objects(bucket_id,name)values('company-logos','agent-logo.png')")).rejects.toThrow(/row-level security/);
  await user("accountant");expect((await db.query<{name:string}>("select name from storage.objects order by name")).rows.map(row=>row.name)).toEqual(["invoices/fixture/document.pdf","logo.png"]);
  await db.query("insert into storage.objects(bucket_id,name)values('document-pdfs','credit-notes/accountant.pdf')");
  await expect(db.query("insert into storage.objects(bucket_id,name)values('itinerary-images','accountant.png')")).rejects.toThrow(/row-level security/);
 });
 it("retains immutable images/PDF updates, administrator logo changes and administrator PDF deletion",async()=>{
  await user("admin");
  expect((await db.query("update storage.objects set name='renamed-logo.png' where bucket_id='company-logos' returning id")).rows).toHaveLength(1);
  await expect(db.query("update storage.objects set bucket_id='document-pdfs' where bucket_id='company-logos'")).rejects.toThrow(/row-level security/);
  expect((await db.query("update storage.objects set name='renamed.png' where bucket_id='itinerary-images' returning id")).rows).toHaveLength(0);
  expect((await db.query("delete from storage.objects where bucket_id='itinerary-images' returning id")).rows).toHaveLength(0);
  expect((await db.query("update storage.objects set name='renamed.pdf' where bucket_id='document-pdfs' returning id")).rows).toHaveLength(0);
  expect((await db.query("delete from storage.objects where bucket_id='document-pdfs' returning id")).rows).toHaveLength(3);
 });
 it("leaves at most one permissive authenticated policy per effective command and retains UPDATE WITH CHECK",async()=>{
  const duplicates=await db.query("with effective as(select p.polrelid,unnest(case when p.polcmd='*' then array['r','a','w','d'] else array[p.polcmd::text] end) as command from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where p.polpermissive and ('authenticated'::regrole::oid=any(p.polroles) or 0::oid=any(p.polroles)) and(n.nspname='public' or(n.nspname='storage' and c.relname='objects')))select polrelid::regclass::text,command,count(*) from effective group by polrelid,command having count(*)>1");
  expect(duplicates.rows).toHaveLength(0);
  const unsafe=await db.query("select polname from pg_policy p join pg_class c on c.oid=p.polrelid where c.relnamespace='public'::regnamespace and polcmd in('*','w') and polwithcheck is null");expect(unsafe.rows).toHaveLength(0);
 });
});
