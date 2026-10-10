-- Atomic native itinerary editing and revocable safe public snapshots.
alter table public.itineraries add column share_token uuid unique, add column share_expires_at timestamptz;
alter table public.itineraries add constraint itinerary_title_bounded check(length(btrim(title)) between 1 and 200);
alter table public.itineraries add constraint itinerary_content_bounded check(octet_length(legacy_content::text) <= 524288);
create index itineraries_customer_date_idx on public.itineraries(customer_id,start_date);
create function public.save_itinerary(p_itinerary jsonb,p_days jsonb,p_id uuid default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_day jsonb; v_price jsonb; v_number integer:=0; v_actor uuid:=auth.uid();
begin
 if coalesce(private.current_role(),'') not in ('admin','agent') then raise exception 'permission denied'; end if;
 if jsonb_typeof(p_itinerary)<>'object' or jsonb_typeof(p_days)<>'array' or jsonb_array_length(p_days) not between 1 and 30 then raise exception 'Invalid itinerary or days'; end if;
 if exists(select 1 from jsonb_object_keys(p_itinerary) k where k not in ('customer_id','title','destination','start_date','end_date','traveler_count','currency','summary','inclusions','exclusions','notes','legacy_content')) then raise exception 'Unsupported itinerary field'; end if;
 if length(coalesce(p_itinerary->>'title','')) not between 1 and 200 or length(coalesce(p_itinerary->>'destination',''))>160 or (p_itinerary->>'traveler_count')::integer not between 1 and 1998 then raise exception 'Invalid itinerary header'; end if;
 if (p_itinerary->>'end_date')::date <> (p_itinerary->>'start_date')::date + jsonb_array_length(p_days)-1 then raise exception 'Trip dates must match the ordered day count'; end if;
 if jsonb_typeof(p_itinerary->'legacy_content'->'pricing')<>'array' or jsonb_array_length(p_itinerary->'legacy_content'->'pricing')>20 then raise exception 'Invalid pricing'; end if;
 for v_price in select value from jsonb_array_elements(p_itinerary->'legacy_content'->'pricing') loop
  if length(coalesce(v_price->>'description','')) not between 1 and 500 or (v_price->>'quantity') !~ '^[0-9]+(\.[0-9]{1,3})?$' or (v_price->>'quantity')::numeric <= 0 or (v_price->>'quantity')::numeric > 999999999 or (v_price->>'unit_price_minor')::numeric not between 0 and 9007199254740991 or (v_price->>'cost_minor')::numeric not between 0 and 9007199254740991 or (v_price->>'discount_minor')::numeric not between 0 and 9007199254740991 or (v_price->>'tax_rate')::numeric not between 0 and 100 then raise exception 'Invalid price line'; end if;
  if v_price->>'service_id' is not null and not exists(select 1 from public.services where id=(v_price->>'service_id')::uuid) then raise exception 'Unknown service'; end if;
  if v_price->>'supplier_id' is not null and not exists(select 1 from public.suppliers where id=(v_price->>'supplier_id')::uuid) then raise exception 'Unknown supplier'; end if;
 end loop;
 if p_id is null then
  insert into public.itineraries(customer_id,title,destination,start_date,end_date,traveler_count,currency,summary,inclusions,exclusions,notes,legacy_content,created_by)
  values((p_itinerary->>'customer_id')::uuid,p_itinerary->>'title',p_itinerary->>'destination',(p_itinerary->>'start_date')::date,(p_itinerary->>'end_date')::date,(p_itinerary->>'traveler_count')::integer,p_itinerary->>'currency',p_itinerary->>'summary',p_itinerary->>'inclusions',p_itinerary->>'exclusions',p_itinerary->>'notes',p_itinerary->'legacy_content',v_actor) returning id into v_id;
 else
  update public.itineraries set customer_id=(p_itinerary->>'customer_id')::uuid,title=p_itinerary->>'title',destination=p_itinerary->>'destination',start_date=(p_itinerary->>'start_date')::date,end_date=(p_itinerary->>'end_date')::date,traveler_count=(p_itinerary->>'traveler_count')::integer,currency=p_itinerary->>'currency',summary=p_itinerary->>'summary',inclusions=p_itinerary->>'inclusions',exclusions=p_itinerary->>'exclusions',notes=p_itinerary->>'notes',legacy_content=p_itinerary->'legacy_content' where id=p_id returning id into v_id;
  if v_id is null then raise exception 'Itinerary not found'; end if;
  delete from public.itinerary_days where itinerary_id=v_id;
 end if;
 for v_day in select value from jsonb_array_elements(p_days) loop
  v_number:=v_number+1;
  if jsonb_typeof(v_day)<>'object' or length(coalesce(v_day->>'title','')) not between 1 and 200 or length(coalesce(v_day->>'description',''))>5000 or jsonb_typeof(v_day->'services')<>'array' or octet_length(v_day::text)>32768 then raise exception 'Invalid itinerary day'; end if;
  insert into public.itinerary_days(itinerary_id,day_number,date,title,description,accommodation,meals,image_path,services)
  values(v_id,v_number,(p_itinerary->>'start_date')::date+v_number-1,v_day->>'title',v_day->>'description',v_day->>'accommodation',v_day->>'meals',v_day->>'image_path',v_day->'services');
 end loop;
 insert into public.activities(customer_id,actor_id,kind,summary) values((p_itinerary->>'customer_id')::uuid,v_actor,'note','Itinerary '||case when p_id is null then 'created: ' else 'updated: ' end||(p_itinerary->>'title'));
 return v_id;
end $$;
create function public.duplicate_itinerary(p_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_old public.itineraries; v_header jsonb; v_days jsonb;
begin
 if coalesce(private.current_role(),'') not in ('admin','agent') then raise exception 'permission denied'; end if;
 select * into v_old from public.itineraries where id=p_id;
 if not found then raise exception 'Itinerary not found'; end if;
 v_header:=to_jsonb(v_old)-array['id','created_at','updated_at','created_by','share_token','share_expires_at'];
 v_header:=jsonb_set(v_header,'{title}',to_jsonb(left(v_old.title,193)||' (copy)'));
 select jsonb_agg(to_jsonb(d)-array['id','itinerary_id','created_at','updated_at'] order by day_number) into v_days from public.itinerary_days d where itinerary_id=p_id;
 return public.save_itinerary(v_header,v_days,null);
end $$;
create function public.set_itinerary_share(p_id uuid,p_enabled boolean) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_token uuid;
begin
 if coalesce(private.current_role(),'') not in ('admin','agent') then raise exception 'permission denied'; end if;
 update public.itineraries set share_token=case when p_enabled then gen_random_uuid() else null end,share_expires_at=case when p_enabled then now()+interval '30 days' else null end where id=p_id returning share_token into v_token;
 if not found then raise exception 'Itinerary not found'; end if;
 return v_token;
end $$;
revoke all on function public.save_itinerary(jsonb,jsonb,uuid),public.duplicate_itinerary(uuid),public.set_itinerary_share(uuid,boolean) from public,anon;
grant execute on function public.save_itinerary(jsonb,jsonb,uuid),public.duplicate_itinerary(uuid),public.set_itinerary_share(uuid,boolean) to authenticated,service_role;
