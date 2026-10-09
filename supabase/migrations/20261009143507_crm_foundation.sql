-- Single-agency CRM. Amounts use integer currency minor units; rates use NUMERIC.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(full_name) between 1 and 160),
  role text not null check (role in ('admin','agent','accountant')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.customers (
  id uuid primary key default gen_random_uuid(), kind text not null default 'individual' check (kind in ('individual','company')),
  name text not null, email text, phone text, company_name text, address text,
  nationality text, passport_number text, notes text, tags text[] not null default '{}',
  lead_status text not null default 'new' check (lead_status in ('new','contacted','quoted','won','lost')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.suppliers (
  id uuid primary key default gen_random_uuid(), name text not null,
  kind text not null check (kind in ('hotel','transport','tour','airline','vendor')),
  email text, phone text, contact_name text, address text, payment_terms text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.services (
  id uuid primary key default gen_random_uuid(), supplier_id uuid references public.suppliers(id) on delete restrict,
  name text not null, description text, category text not null default 'tour', currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
  cost_minor bigint not null default 0 check(cost_minor >= 0), selling_minor bigint not null default 0 check(selling_minor >= 0),
  tax_rate numeric(7,4) not null default 0 check(tax_rate between 0 and 100), is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.itineraries (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete restrict,
  title text not null, destination text not null default '', start_date date, end_date date,
  traveler_count integer not null default 1 check(traveler_count > 0), currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
  summary text, inclusions text, exclusions text, notes text, legacy_content jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(end_date is null or start_date is null or end_date >= start_date)
);
create table public.itinerary_days (
  id uuid primary key default gen_random_uuid(), itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  day_number integer not null check(day_number > 0), date date, title text not null, description text, accommodation text,
  meals text, image_path text, services jsonb not null default '[]',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(itinerary_id,day_number)
);
create table public.quotations (
  id uuid primary key default gen_random_uuid(), number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  itinerary_id uuid references public.itineraries(id) on delete restrict,
  start_date date, end_date date, traveler_count integer not null default 1 check(traveler_count > 0), destination text,
  currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'), exchange_rate numeric(18,8) not null default 1 check(exchange_rate > 0),
  status text not null default 'draft' check(status in ('draft','sent','accepted','rejected','expired')),
  valid_until date, terms text, subtotal_minor bigint not null default 0 check(subtotal_minor >= 0),
  discount_minor bigint not null default 0 check(discount_minor >= 0), tax_minor bigint not null default 0 check(tax_minor >= 0),
  total_minor bigint not null default 0 check(total_minor >= 0), pdf_path text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(end_date is null or start_date is null or end_date >= start_date),
  check(total_minor = subtotal_minor - discount_minor + tax_minor)
);
create table public.quotation_items (
  id uuid primary key default gen_random_uuid(), quotation_id uuid not null references public.quotations(id) on delete cascade,
  service_id uuid references public.services(id) on delete restrict, description text not null, sort_order integer not null default 0,
  quantity numeric(12,3) not null default 1 check(quantity > 0), unit_price_minor bigint not null check(unit_price_minor >= 0),
  cost_minor bigint not null default 0 check(cost_minor >= 0), discount_minor bigint not null default 0 check(discount_minor >= 0),
  tax_rate numeric(7,4) not null default 0 check(tax_rate between 0 and 100), tax_minor bigint not null default 0 check(tax_minor >= 0),
  total_minor bigint not null check(total_minor >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(discount_minor <= round(quantity * unit_price_minor)),
  check(total_minor = round(quantity * unit_price_minor) - discount_minor + tax_minor),
  check(tax_minor = round((round(quantity * unit_price_minor) - discount_minor) * tax_rate / 100))
);
create table public.bookings (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete restrict,
  quotation_id uuid unique references public.quotations(id) on delete restrict, itinerary_id uuid references public.itineraries(id) on delete restrict,
  assigned_agent_id uuid references public.profiles(id) on delete set null,
  start_date date, end_date date, destination text not null default '', traveler_count integer not null default 1 check(traveler_count > 0),
  status text not null default 'pending' check(status in ('pending','confirmed','completed','cancelled')),
  currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'), exchange_rate numeric(18,8) not null default 1 check(exchange_rate > 0),
  cost_minor bigint not null default 0 check(cost_minor >= 0), selling_minor bigint not null default 0 check(selling_minor >= 0), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(end_date is null or start_date is null or end_date >= start_date)
);
create table public.booking_items (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade,
  service_id uuid references public.services(id) on delete restrict, supplier_id uuid references public.suppliers(id) on delete restrict,
  description text not null, sort_order integer not null default 0, quantity numeric(12,3) not null default 1 check(quantity > 0),
  unit_price_minor bigint not null check(unit_price_minor >= 0), cost_minor bigint not null default 0 check(cost_minor >= 0),
  discount_minor bigint not null default 0 check(discount_minor >= 0), tax_rate numeric(7,4) not null default 0 check(tax_rate between 0 and 100),
  tax_minor bigint not null default 0 check(tax_minor >= 0), total_minor bigint not null check(total_minor >= 0),
  confirmation_status text not null default 'pending' check(confirmation_status in ('pending','requested','confirmed','cancelled')),
  confirmation_number text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(discount_minor <= round(quantity * unit_price_minor)),
  check(total_minor = round(quantity * unit_price_minor) - discount_minor + tax_minor),
  check(tax_minor = round((round(quantity * unit_price_minor) - discount_minor) * tax_rate / 100))
);
create table public.travelers (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade,
  full_name text not null, date_of_birth date, nationality text, passport_number text, passport_expiry date, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(), number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete restrict,
  credited_invoice_id uuid references public.invoices(id) on delete restrict,
  document_type text not null default 'invoice' check(document_type in ('invoice','credit_note')),
  billing_type text not null default 'balance' check(billing_type in ('deposit','partial','balance')),
  issue_date date not null default current_date, due_date date,
  currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'), exchange_rate numeric(18,8) not null default 1 check(exchange_rate > 0),
  status text not null default 'draft' check(status in ('draft','sent','partially_paid','paid','overdue','void')),
  -- Snapshot avoids exposing customer passports to accounting and preserves historical billing details.
  billing_name text not null, billing_email text, billing_address text, terms text,
  subtotal_minor bigint not null default 0 check(subtotal_minor >= 0), discount_minor bigint not null default 0 check(discount_minor >= 0),
  tax_minor bigint not null default 0 check(tax_minor >= 0), total_minor bigint not null default 0 check(total_minor >= 0),
  paid_minor bigint not null default 0 check(paid_minor >= 0), pdf_path text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(total_minor = subtotal_minor - discount_minor + tax_minor), check(paid_minor <= total_minor),
  check((document_type = 'credit_note') = (credited_invoice_id is not null)),
  check(credited_invoice_id is null or credited_invoice_id <> id), check(due_date is null or due_date >= issue_date)
);
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete cascade,
  booking_item_id uuid references public.booking_items(id) on delete restrict, description text not null, sort_order integer not null default 0,
  quantity numeric(12,3) not null default 1 check(quantity > 0), unit_price_minor bigint not null check(unit_price_minor >= 0),
  discount_minor bigint not null default 0 check(discount_minor >= 0), tax_rate numeric(7,4) not null default 0 check(tax_rate between 0 and 100),
  tax_minor bigint not null default 0 check(tax_minor >= 0), total_minor bigint not null check(total_minor >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(discount_minor <= round(quantity * unit_price_minor)),
  check(total_minor = round(quantity * unit_price_minor) - discount_minor + tax_minor),
  check(tax_minor = round((round(quantity * unit_price_minor) - discount_minor) * tax_rate / 100))
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount_minor bigint not null check(amount_minor > 0), payment_date date not null default current_date,
  method text not null check(method in ('cash','bank_transfer','card','other')), reference text, notes text,
  recorded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.activities (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null default auth.uid(), kind text not null default 'note', summary text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.settings (
  id integer primary key default 1 check(id = 1), company_name text not null default 'Emerald Isle Travels', logo_path text,
  email text, phone text, address text, tax_id text, bank_details text, default_currency text not null default 'USD' check(default_currency ~ '^[A-Z]{3}$'),
  tax_rates jsonb not null default '[]', numbering_formats jsonb not null default '{"quotation":"QT-{year}-{sequence}","invoice":"INV-{year}-{sequence}","credit_note":"CN-{year}-{sequence}"}',
  terms_templates jsonb not null default '{}', email_templates jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.audit_log (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
  table_name text not null, record_id uuid not null, operation text not null check(operation in ('INSERT','UPDATE','DELETE')),
  old_data jsonb, new_data jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table private.document_counters (
  kind text not null check(kind in ('quotation','invoice','credit_note')), year integer not null, last_value bigint not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(kind,year)
);
alter table private.document_counters enable row level security;

-- Non-exposed helper deliberately bypasses profiles RLS to prevent recursion.
create function private.current_role() returns text language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.is_active and auth.uid() is not null
$$;
revoke all on function private.current_role() from public, anon;
grant execute on function private.current_role() to authenticated, service_role;

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['profiles','customers','suppliers','services','itineraries','itinerary_days','quotations','quotation_items','bookings','booking_items','travelers','invoices','invoice_items','payments','activities','settings','audit_log'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);
    execute format('create policy admin_access on public.%I for all to authenticated using ((select private.current_role()) = ''admin'') with check ((select private.current_role()) = ''admin'')',t);
  end loop;
  foreach t in array array['customers','suppliers','services','itineraries','itinerary_days','quotations','quotation_items','bookings','booking_items','travelers','activities'] loop
    execute format('create policy agent_access on public.%I for all to authenticated using ((select private.current_role()) = ''agent'') with check ((select private.current_role()) = ''agent'')',t);
  end loop;
  foreach t in array array['invoices','invoice_items','payments'] loop
    execute format('create policy accounting_access on public.%I for all to authenticated using ((select private.current_role()) = ''accountant'') with check ((select private.current_role()) = ''accountant'')',t);
  end loop;
  foreach t in array array['bookings','booking_items','suppliers','services'] loop
    execute format('create policy accounting_read on public.%I for select to authenticated using ((select private.current_role()) = ''accountant'')',t);
  end loop;
end $$;
create policy profile_self_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy settings_read on public.settings for select to authenticated using ((select private.current_role()) in ('agent','accountant'));
-- Audit is append-only even for admins; triggers write using their owner rights.
drop policy admin_access on public.audit_log;
create policy admin_audit_read on public.audit_log for select to authenticated using ((select private.current_role()) = 'admin');
revoke insert, update, delete on public.audit_log from authenticated;

create function private.allocate_number(p_kind text, p_year integer) returns text language plpgsql security definer set search_path = '' as $$
declare n bigint; prefix text; r text := private.current_role();
begin
  if auth.uid() is null or r is null or (p_kind = 'quotation' and r not in ('admin','agent')) or (p_kind in ('invoice','credit_note') and r not in ('admin','accountant')) then
    raise exception 'Document numbering permission denied' using errcode = '42501';
  end if;
  if p_kind not in ('quotation','invoice','credit_note') or p_year not between 2000 and 9999 then raise exception 'Invalid document number request'; end if;
  insert into private.document_counters(kind,year,last_value) values(p_kind,p_year,1)
  on conflict(kind,year) do update set last_value = private.document_counters.last_value + 1, updated_at = now()
  returning last_value into n;
  prefix := case p_kind when 'quotation' then 'QT' when 'invoice' then 'INV' else 'CN' end;
  return prefix || '-' || p_year::text || '-' || lpad(n::text,greatest(4,length(n::text)), '0');
end $$;
revoke all on function private.allocate_number(text,integer) from public, anon;
grant execute on function private.allocate_number(text,integer) to authenticated;
create function public.next_document_number(p_kind text, p_year integer default extract(year from current_date)::integer) returns text
language sql security invoker set search_path = '' as $$ select private.allocate_number(p_kind,p_year) $$;
revoke all on function public.next_document_number(text,integer) from public, anon;
grant execute on function public.next_document_number(text,integer) to authenticated;

create function private.assign_document_number() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.number is null or new.number = '' then
    if tg_table_name = 'quotations' then
      new.number := public.next_document_number('quotation');
    else
      new.number := public.next_document_number(new.document_type);
    end if;
  end if;
  return new;
end $$;
revoke all on function private.assign_document_number() from public, anon, authenticated;
create trigger assign_number before insert on public.quotations for each row execute function private.assign_document_number();
create trigger assign_number before insert on public.invoices for each row execute function private.assign_document_number();

create function private.lock_invoice() returns trigger language plpgsql set search_path = '' as $$
declare original public.invoices; credited_total bigint;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.paid_minor <> 0 then raise exception 'Invoices must start as unpaid drafts'; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'Issued invoices cannot be deleted'; end if;
    return old;
  end if;
  if old.status <> 'draft' then
    if (to_jsonb(new) - array['status','paid_minor','updated_at']) is distinct from (to_jsonb(old) - array['status','paid_minor','updated_at']) then
      raise exception 'Issued invoices are immutable; void or credit them';
    end if;
    if pg_trigger_depth() <= 1 and (new.paid_minor <> old.paid_minor or new.status not in (old.status,'void','overdue')) then
      raise exception 'Payment status can only be updated by the payment ledger';
    end if;
    if old.status = 'void' and new.status <> 'void' then raise exception 'Voided invoices cannot be reopened'; end if;
    if new.status = 'void' and old.paid_minor > 0 then raise exception 'Paid invoices require a credit note'; end if;
    if new.status = 'overdue' and (old.status not in ('sent','partially_paid','overdue') or new.due_date is null or new.due_date >= current_date) then raise exception 'Invoice is not overdue'; end if;
  else
    if new.paid_minor <> 0 or new.status not in ('draft','sent','void') then raise exception 'Invalid draft invoice transition'; end if;
    if new.status = 'sent' then
      if not exists(select 1 from public.invoice_items where invoice_id = new.id) then raise exception 'An issued invoice needs line items'; end if;
      if new.total_minor <> (select coalesce(sum(total_minor),0) from public.invoice_items where invoice_id = new.id) then raise exception 'Invoice total must match line items'; end if;
      if new.subtotal_minor <> (select coalesce(sum(round(quantity * unit_price_minor)),0) from public.invoice_items where invoice_id = new.id)
        or new.discount_minor <> (select coalesce(sum(discount_minor),0) from public.invoice_items where invoice_id = new.id)
        or new.tax_minor <> (select coalesce(sum(tax_minor),0) from public.invoice_items where invoice_id = new.id) then
        raise exception 'Invoice subtotal, discounts and taxes must match line items';
      end if;
      if new.document_type = 'credit_note' then
        -- Lock the original to serialize concurrent credits against its balance.
        select * into original from public.invoices where id = new.credited_invoice_id for update;
        if original.document_type <> 'invoice' or original.status in ('draft','void') or
          original.customer_id <> new.customer_id or original.currency <> new.currency then
          raise exception 'Credit note must reference an issued invoice for the same customer and currency';
        end if;
        select coalesce(sum(total_minor),0) into credited_total from public.invoices
          where credited_invoice_id = original.id and status not in ('draft','void') and id <> new.id;
        if credited_total + new.total_minor > original.total_minor then raise exception 'Credit notes exceed original invoice total'; end if;
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.lock_invoice() from public, anon, authenticated;
create trigger lock_invoice before insert or update or delete on public.invoices for each row execute function private.lock_invoice();
create function private.lock_invoice_items() returns trigger language plpgsql set search_path = '' as $$
declare parent_status text;
begin
  if tg_op <> 'INSERT' then
    select status into parent_status from public.invoices where id = old.invoice_id for update;
    -- A cascade from deleting a draft has already passed lock_invoice and removed its parent.
    if parent_status is null and tg_op = 'DELETE' then return old; end if;
    if parent_status is distinct from 'draft' then raise exception 'Issued invoice line items are immutable'; end if;
  end if;
  if tg_op <> 'DELETE' then
    select status into parent_status from public.invoices where id = new.invoice_id for update;
    if parent_status is distinct from 'draft' then raise exception 'Issued invoice line items are immutable'; end if;
    return new;
  end if;
  return old;
end $$;
revoke all on function private.lock_invoice_items() from public, anon, authenticated;
create trigger lock_invoice_items before insert or update or delete on public.invoice_items for each row execute function private.lock_invoice_items();

create function private.record_payment() returns trigger language plpgsql set search_path = '' as $$
declare inv public.invoices;
begin
  if tg_op <> 'INSERT' then raise exception 'Payment ledger is append-only'; end if;
  select * into inv from public.invoices where id = new.invoice_id for update;
  if inv.status not in ('sent','partially_paid','overdue') or inv.document_type <> 'invoice' then raise exception 'Payments require an issued open invoice'; end if;
  if inv.paid_minor + new.amount_minor > inv.total_minor then raise exception 'Payment exceeds outstanding balance'; end if;
  update public.invoices set paid_minor = paid_minor + new.amount_minor,
    status = case when paid_minor + new.amount_minor = total_minor then 'paid' else 'partially_paid' end where id = inv.id;
  return new;
end $$;
revoke all on function private.record_payment() from public, anon, authenticated;
create trigger record_payment before insert or update or delete on public.payments for each row execute function private.record_payment();

create function private.audit_financial_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log(actor_id,table_name,record_id,operation,old_data,new_data)
  values(auth.uid(),tg_table_name,coalesce(new.id,old.id),tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new,old);
end $$;
revoke all on function private.audit_financial_change() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['quotations','quotation_items','bookings','booking_items','invoices','invoice_items','payments'] loop
    execute format('create trigger audit_financial_change after insert or update or delete on public.%I for each row execute function private.audit_financial_change()',t);
  end loop;
end $$;

-- Index every FK dynamically; add search/status/date indexes for list/report queries.
do $$ declare fk record; begin
  for fk in select c.conrelid::regclass as tbl, a.attname as col from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace loop
    execute format('create index if not exists %I on %s (%I)',replace(fk.tbl::text,'public.','') || '_' || fk.col || '_idx',fk.tbl,fk.col);
  end loop;
end $$;
create index customers_name_idx on public.customers(lower(name));
create index customers_email_idx on public.customers(lower(email));
create index customers_search_idx on public.customers using gin(to_tsvector('simple',name || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'')));
create index customers_lead_status_idx on public.customers(lead_status,created_at desc);
create index customers_tags_idx on public.customers using gin(tags);
create index suppliers_name_idx on public.suppliers(lower(name));
create index services_name_idx on public.services(lower(name));
create index itineraries_title_idx on public.itineraries(lower(title));
create index quotations_status_idx on public.quotations(status,valid_until);
create index bookings_departures_idx on public.bookings(start_date,status);
create index invoices_due_idx on public.invoices(status,due_date);
create index payments_date_idx on public.payments(payment_date);
create index activities_timeline_idx on public.activities(customer_id,created_at desc);
create index audit_log_record_idx on public.audit_log(table_name,record_id,created_at desc);
create index profiles_role_idx on public.profiles(role) where is_active;

insert into public.settings(id) values(1);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('company-logos','company-logos',false,2097152,array['image/png','image/jpeg','image/webp']),
  ('document-pdfs','document-pdfs',false,10485760,array['application/pdf'])
on conflict(id) do nothing;
-- PDFs are partitioned by first path component, e.g. invoices/<id>/document.pdf.
create policy crm_storage_read on storage.objects for select to authenticated using (
  (bucket_id = 'company-logos' and (select private.current_role()) in ('admin','agent','accountant')) or
  (bucket_id = 'document-pdfs' and ((select private.current_role()) = 'admin' or
    ((select private.current_role()) = 'agent' and (storage.foldername(name))[1] in ('itineraries','quotations','bookings')) or
    ((select private.current_role()) = 'accountant' and (storage.foldername(name))[1] in ('invoices','credit-notes'))))
);
create policy crm_storage_insert on storage.objects for insert to authenticated with check (
  (bucket_id = 'company-logos' and (select private.current_role()) = 'admin') or
  (bucket_id = 'document-pdfs' and ((select private.current_role()) = 'admin' or
    ((select private.current_role()) = 'agent' and (storage.foldername(name))[1] in ('itineraries','quotations','bookings')) or
    ((select private.current_role()) = 'accountant' and (storage.foldername(name))[1] in ('invoices','credit-notes'))))
);
create policy crm_storage_update on storage.objects for update to authenticated using (
  bucket_id = 'company-logos' and (select private.current_role()) = 'admin'
) with check (bucket_id = 'company-logos' and (select private.current_role()) = 'admin');
create policy crm_storage_delete on storage.objects for delete to authenticated using (
  bucket_id in ('company-logos','document-pdfs') and (select private.current_role()) = 'admin'
);
