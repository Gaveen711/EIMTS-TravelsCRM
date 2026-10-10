-- Keep one permissive policy per CRM table and effective command.
-- Preserve existing single-agency role permissions, grants and financial triggers.
do $$
declare t text;p text;writers text[];readers text[];write_rule text;read_rule text;
begin
 foreach t in array array['profiles','customers','suppliers','services','itineraries','itinerary_days','quotations','quotation_items','bookings','booking_items','travelers','invoices','invoice_items','payments','activities','settings'] loop
  foreach p in array array['admin_access','agent_access','accounting_access','accounting_read','profile_self_read','settings_read'] loop
   execute format('drop policy if exists %I on public.%I',p,t);
  end loop;
  writers:=case when t in('profiles','settings') then array['admin'] when t in('invoices','invoice_items','payments') then array['admin','accountant'] else array['admin','agent'] end;
  readers:=case when t in('suppliers','services','bookings','booking_items','settings') then array['admin','agent','accountant'] else writers end;
  write_rule:=format('(select private.current_role()) = any (%L::text[])',writers);
  read_rule:=format('(select private.current_role()) = any (%L::text[])',readers);
  if t='profiles' then read_rule:='('||write_rule||') or id = (select auth.uid())';end if;
  if readers=writers and t<>'profiles' then
   execute format('create policy crm_access on public.%I for all to authenticated using (%s) with check (%s)',t,write_rule,write_rule);
  else
   execute format('create policy crm_select on public.%I for select to authenticated using (%s)',t,read_rule);
   execute format('create policy crm_insert on public.%I for insert to authenticated with check (%s)',t,write_rule);
   execute format('create policy crm_update on public.%I for update to authenticated using (%s) with check (%s)',t,write_rule,write_rule);
   execute format('create policy crm_delete on public.%I for delete to authenticated using (%s)',t,write_rule);
  end if;
 end loop;
end $$;

-- Storage conditions are merged, retaining immutable photo objects and existing logo/PDF mutations.
drop policy crm_storage_read on storage.objects;
drop policy crm_storage_insert on storage.objects;
drop policy itinerary_photo_read on storage.objects;
drop policy itinerary_photo_insert on storage.objects;
create policy crm_storage_read on storage.objects for select to authenticated using(
 (bucket_id='company-logos' and(select private.current_role()) in('admin','agent','accountant'))
 or(bucket_id='itinerary-images' and(select private.current_role()) in('admin','agent'))
 or(bucket_id='document-pdfs' and(
  (select private.current_role())='admin'
  or((select private.current_role())='agent' and(storage.foldername(name))[1] in('itineraries','quotations','bookings'))
  or((select private.current_role())='accountant' and(storage.foldername(name))[1] in('invoices','credit-notes'))
 ))
);
create policy crm_storage_insert on storage.objects for insert to authenticated with check(
 (bucket_id='company-logos' and(select private.current_role())='admin')
 or(bucket_id='itinerary-images' and(select private.current_role()) in('admin','agent'))
 or(bucket_id='document-pdfs' and(
  (select private.current_role())='admin'
  or((select private.current_role())='agent' and(storage.foldername(name))[1] in('itineraries','quotations','bookings'))
  or((select private.current_role())='accountant' and(storage.foldername(name))[1] in('invoices','credit-notes'))
 ))
);
