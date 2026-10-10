-- Validate native itinerary documents at the database boundary.
create function private.valid_native_itinerary(p_content jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare v_line jsonb; v_field text; v_quantity numeric; v_gross numeric; v_discount numeric; v_tax numeric; v_total numeric:=0; v_cost numeric:=0;
begin
 if jsonb_typeof(p_content) is distinct from 'object' or p_content->>'version' is distinct from '1' or jsonb_typeof(p_content->'pricing') is distinct from 'array' then return false; end if;
 if jsonb_array_length(p_content->'pricing')>20 then return false; end if;
 for v_field in select unnest(array['adults','children']) loop
  if jsonb_typeof(p_content->v_field) is distinct from 'number' or coalesce(p_content->>v_field,'') !~ '^[0-9]+$' or (p_content->>v_field)::numeric>999 then return false; end if;
 end loop;
 if (p_content->>'adults')::integer<1 then return false; end if;
 if coalesce(p_content->>'primary_color','') !~ '^#[0-9a-fA-F]{6}$' or coalesce(p_content->>'accent_color','') !~ '^#[0-9a-fA-F]{6}$' then return false; end if;
 if coalesce(p_content->>'route_mode','') not in ('automatic','custom') or jsonb_typeof(p_content->'custom_stops') is distinct from 'array' then return false; end if;
 if jsonb_array_length(p_content->'custom_stops')>40 or exists(select 1 from jsonb_array_elements(p_content->'custom_stops') s where jsonb_typeof(s) is distinct from 'string' or length(btrim(s#>>'{}')) not between 1 and 160) then return false; end if;
 for v_line in select value from jsonb_array_elements(p_content->'pricing') loop
  if jsonb_typeof(v_line) is distinct from 'object' or jsonb_typeof(v_line->'description') is distinct from 'string' or length(btrim(coalesce(v_line->>'description',''))) not between 1 and 500 then return false; end if;
  if jsonb_typeof(v_line->'quantity') is distinct from 'string' or coalesce(v_line->>'quantity','') !~ '^[0-9]+(\.[0-9]{1,3})?$' or jsonb_typeof(v_line->'tax_rate') is distinct from 'string' or coalesce(v_line->>'tax_rate','') !~ '^[0-9]+(\.[0-9]{1,4})?$' then return false; end if;
  for v_field in select unnest(array['unit_price_minor','cost_minor','discount_minor']) loop
   if jsonb_typeof(v_line->v_field) is distinct from 'number' or coalesce(v_line->>v_field,'') !~ '^[0-9]+$' or (v_line->>v_field)::numeric>9007199254740991 then return false; end if;
  end loop;
  v_quantity:=(v_line->>'quantity')::numeric;
  if v_quantity<=0 or v_quantity>999999999 or (v_line->>'tax_rate')::numeric>100 then return false; end if;
  v_gross:=round(v_quantity*(v_line->>'unit_price_minor')::numeric);
  v_discount:=(v_line->>'discount_minor')::numeric;
  if v_discount>v_gross then return false; end if;
  v_tax:=round((v_gross-v_discount)*(v_line->>'tax_rate')::numeric/100);
  v_total:=v_total+v_gross-v_discount+v_tax;v_cost:=v_cost+round(v_quantity*(v_line->>'cost_minor')::numeric);
  if v_total>9007199254740991 or v_cost>9007199254740991 then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function private.valid_native_itinerary(jsonb) from public,anon;
grant execute on function private.valid_native_itinerary(jsonb) to authenticated,service_role;
alter table public.itineraries add constraint native_itinerary_valid check(legacy_content->>'version' is distinct from '1' or private.valid_native_itinerary(legacy_content));

create or replace function public.save_itinerary(p_itinerary jsonb,p_days jsonb,p_id uuid default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_day jsonb; v_price jsonb; v_number integer:=0; v_actor uuid:=auth.uid();
begin
 if not private.valid_native_itinerary(p_itinerary->'legacy_content') then raise exception 'Invalid native itinerary content'; end if;
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

create or replace function public.duplicate_itinerary(p_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_old public.itineraries; v_header jsonb; v_days jsonb;
begin
 if coalesce(private.current_role(),'') not in ('admin','agent') then raise exception 'permission denied'; end if;
 select * into v_old from public.itineraries where id=p_id;
 if not found then raise exception 'Itinerary not found'; end if;
 v_header:=to_jsonb(v_old)-array['id','created_at','updated_at','created_by','share_token','share_expires_at'];
 v_header:=jsonb_set(v_header,'{title}',to_jsonb(left(v_old.title,193)||' (copy)'));
 if v_old.legacy_content->>'version' is distinct from '1' then
  v_header:=jsonb_set(v_header,'{legacy_content}',
   jsonb_build_object('adults',v_old.traveler_count,'children',0,'primary_color','#153c32','accent_color','#ecb64b','theme_name','Emerald','route_mode','automatic','custom_stops','[]'::jsonb,'pricing','[]'::jsonb)
   ||v_old.legacy_content||jsonb_build_object('version',1));
 end if;

 select jsonb_agg(to_jsonb(d)-array['id','itinerary_id','created_at','updated_at'] order by day_number) into v_days from public.itinerary_days d where itinerary_id=p_id;
 return public.save_itinerary(v_header,v_days,null);
end $$;
