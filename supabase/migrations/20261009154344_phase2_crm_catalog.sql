-- Phase 2: bounded catalog/customer data and transactional CRM mutations.
create function private.valid_customer_tags(p_tags text[]) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select cardinality(p_tags) <= 20 and not exists(
    select 1 from unnest(p_tags) t where t is null or length(btrim(t)) not between 1 and 40
  )
$$;
revoke all on function private.valid_customer_tags(text[]) from public, anon;
grant execute on function private.valid_customer_tags(text[]) to authenticated, service_role;

alter table public.customers
 add constraint customers_name_length check(length(btrim(name)) between 1 and 160),
 add constraint customers_email_valid check(email is null or (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 add constraint customers_phone_length check(length(phone) <= 60),
 add constraint customers_company_length check(length(company_name) <= 160),
 add constraint customers_address_length check(length(address) <= 1000),
 add constraint customers_nationality_length check(length(nationality) <= 100),
 add constraint customers_passport_length check(length(passport_number) <= 80),
 add constraint customers_notes_length check(length(notes) <= 5000),
 add constraint customers_tags_valid check(private.valid_customer_tags(tags));
alter table public.suppliers
 add constraint suppliers_name_length check(length(btrim(name)) between 1 and 160),
 add constraint suppliers_email_valid check(email is null or (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 add constraint suppliers_phone_length check(length(phone) <= 60),
 add constraint suppliers_contact_length check(length(contact_name) <= 160),
 add constraint suppliers_address_length check(length(address) <= 1000),
 add constraint suppliers_terms_length check(length(payment_terms) <= 2000),
 add constraint suppliers_notes_length check(length(notes) <= 5000);
alter table public.services
 add constraint services_name_length check(length(btrim(name)) between 1 and 160),
 add constraint services_description_length check(length(description) <= 5000),
 add constraint services_category_valid check(category in ('hotel','transport','tour','airline','vendor')),
 add constraint services_money_safe check(cost_minor <= 9007199254740991 and selling_minor <= 9007199254740991);
alter table public.activities
 add constraint activities_summary_length check(length(btrim(summary)) between 1 and 5000);
create index suppliers_kind_created_idx on public.suppliers(kind,created_at desc);
create index services_category_active_created_idx on public.services(category,is_active,created_at desc);

-- Explicit caller role validation complements RLS; no service-key bypass in UI.
create function public.save_customer(p_customer jsonb,p_id uuid default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare c public.customers; previous_status text; result_id uuid; key text;
begin
 if auth.uid() is null or coalesce(private.current_role(),'') not in ('admin','agent') then
  raise exception 'Customer permission denied' using errcode = '42501';
 end if;
 if p_customer is null or jsonb_typeof(p_customer) <> 'object' then raise exception 'Customer must be an object'; end if;
 for key in select jsonb_object_keys(p_customer) loop
  if key not in ('kind','name','email','phone','company_name','address','nationality','passport_number','notes','tags','lead_status') then
   raise exception 'Unknown customer field: %',key;
  end if;
  if key = 'tags' then
   if jsonb_typeof(p_customer->key) <> 'array' or exists(
    select 1 from jsonb_array_elements(p_customer->key) t where jsonb_typeof(t) <> 'string'
   ) then raise exception 'Tags must be an array of strings'; end if;
  elsif jsonb_typeof(p_customer->key) not in ('string','null') then
   raise exception 'Customer field must be text: %',key;
  end if;
 end loop;
 select * into c from jsonb_populate_record(null::public.customers,p_customer);
 c.kind := coalesce(c.kind,'individual');
 c.lead_status := coalesce(c.lead_status,'new');
 c.tags := coalesce(c.tags,'{}');
 if p_id is null then
  insert into public.customers(kind,name,email,phone,company_name,address,nationality,passport_number,notes,tags,lead_status)
  values(c.kind,c.name,c.email,c.phone,c.company_name,c.address,c.nationality,c.passport_number,c.notes,c.tags,c.lead_status)
  returning id into result_id;
  insert into public.activities(customer_id,actor_id,kind,summary)
  values(result_id,auth.uid(),'created','Customer created');
 else
  select lead_status into previous_status from public.customers where id=p_id for update;
  if not found then raise exception 'Customer not found' using errcode='P0002'; end if;
  update public.customers set kind=c.kind,name=c.name,email=c.email,phone=c.phone,company_name=c.company_name,
   address=c.address,nationality=c.nationality,passport_number=c.passport_number,notes=c.notes,tags=c.tags,lead_status=c.lead_status
  where id=p_id returning id into result_id;
  insert into public.activities(customer_id,actor_id,kind,summary)
  values(result_id,auth.uid(),case when previous_status<>c.lead_status then 'status_changed' else 'updated' end,
   case when previous_status<>c.lead_status then 'Lead status changed from '||previous_status||' to '||c.lead_status else 'Customer updated' end);
 end if;
 return result_id;
end $$;
create function public.add_customer_note(p_customer_id uuid,p_summary text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare result_id uuid;
begin
 if auth.uid() is null or coalesce(private.current_role(),'') not in ('admin','agent') then
  raise exception 'Customer permission denied' using errcode='42501';
 end if;
 if p_summary is null or length(btrim(p_summary)) not between 1 and 5000 then raise exception 'Invalid activity note'; end if;
 if not exists(select 1 from public.customers where id=p_customer_id) then raise exception 'Customer not found' using errcode='P0002'; end if;
 insert into public.activities(customer_id,actor_id,kind,summary) values(p_customer_id,auth.uid(),'note',btrim(p_summary)) returning id into result_id;
 return result_id;
end $$;
create function public.import_customers(p_rows jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare row_data jsonb; imported integer := 0;
begin
 if auth.uid() is null or coalesce(private.current_role(),'') not in ('admin','agent') then
  raise exception 'Customer permission denied' using errcode='42501';
 end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Import must be an array'; end if;
 if jsonb_array_length(p_rows) not between 1 and 200 or octet_length(p_rows::text)>262144 then raise exception 'Import exceeds allowed size'; end if;
 for row_data in select value from jsonb_array_elements(p_rows) loop
  perform public.save_customer(row_data);
  imported := imported + 1;
 end loop;
 return imported;
end $$;
revoke all on function public.save_customer(jsonb,uuid) from public, anon;
revoke all on function public.add_customer_note(uuid,text) from public, anon;
revoke all on function public.import_customers(jsonb) from public, anon;
grant execute on function public.save_customer(jsonb,uuid) to authenticated;
grant execute on function public.add_customer_note(uuid,text) to authenticated;
grant execute on function public.import_customers(jsonb) to authenticated;

alter table public.customers add column search_document tsvector generated always as (
 to_tsvector('simple',name || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(company_name,''))
) stored;
create index customers_search_document_idx on public.customers using gin(search_document);
