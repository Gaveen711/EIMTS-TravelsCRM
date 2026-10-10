-- Transactional sales cycle. API mutations validate inside PostgreSQL and preserve issued records.
create function private.finance_role(p_roles text[]) returns void language plpgsql security invoker set search_path='' as $$
begin if auth.uid() is null or coalesce(private.current_role(),'') <> all(p_roles) then raise exception 'Financial permission denied' using errcode='42501'; end if; end $$;
revoke all on function private.finance_role(text[]) from public,anon;
grant execute on function private.finance_role(text[]) to authenticated;
create function private.finance_lines(p_items jsonb) returns table(service_id uuid,description text,quantity numeric,unit_price_minor bigint,cost_minor bigint,discount_minor bigint,tax_rate numeric,tax_minor bigint,total_minor bigint,sort_order integer)
language plpgsql security invoker set search_path='' as $$
declare v jsonb; q numeric; price bigint; cost bigint; d bigint; rate numeric; gross numeric; tax numeric; n integer:=0;
begin
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Document needs 1 to 100 line items'; end if;
 for v in select value from jsonb_array_elements(p_items) loop
  if length(coalesce(v->>'description','')) not between 1 and 2000 or coalesce(v->>'quantity','') !~ '^\d+(\.\d{1,3})?$' or coalesce(v->>'tax_rate','0') !~ '^\d+(\.\d{1,4})?$' then raise exception 'Invalid line description, quantity or tax'; end if;
  if coalesce(v->>'unit_price_minor','') !~ '^\d+$' or coalesce(v->>'cost_minor','0') !~ '^\d+$' or coalesce(v->>'discount_minor','0') !~ '^\d+$' then raise exception 'Line amounts must be integer minor units'; end if;
  q:=(v->>'quantity')::numeric; price:=(v->>'unit_price_minor')::bigint; cost:=coalesce((v->>'cost_minor')::bigint,0); d:=coalesce((v->>'discount_minor')::bigint,0); rate:=coalesce((v->>'tax_rate')::numeric,0);
  gross:=round(q*price); tax:=round((gross-d)*rate/100);
  if q<=0 or q>999999999 or rate not between 0 and 100 or d>gross or greatest(price,cost,d,gross,tax,gross-d+tax,round(q*cost))>9007199254740991 then raise exception 'Line amounts exceed supported range'; end if;
  service_id:=nullif(v->>'service_id','')::uuid; description:=v->>'description';quantity:=q;unit_price_minor:=price;cost_minor:=cost;discount_minor:=d;tax_rate:=rate;tax_minor:=tax;total_minor:=gross-d+tax;sort_order:=n;n:=n+1;return next;
 end loop;
end $$;
revoke all on function private.finance_lines(jsonb) from public,anon;
grant execute on function private.finance_lines(jsonb) to authenticated;
create function private.finance_document(p_document jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(p_document)<>'object' or (p_document->>'customer_id') is null or coalesce(p_document->>'currency','') not in ('USD','LKR','EUR','GBP','AUD','CAD','INR','SGD','AED','JPY','KRW','KWD','BHD','OMR') or coalesce(p_document->>'exchange_rate','1') !~ '^\d+(\.\d{1,8})?$' or coalesce((p_document->>'exchange_rate')::numeric,1)<=0 or length(coalesce(p_document->>'terms',''))>20000 or length(coalesce(p_document->>'destination',''))>500 or coalesce((p_document->>'traveler_count')::integer,1) not between 1 and 10000 then raise exception 'Invalid financial document';end if;
 if nullif(p_document->>'start_date','')::date > nullif(p_document->>'end_date','')::date then raise exception 'End date precedes start date';end if;
 perform * from private.finance_lines(p_document->'items');
end $$;
revoke all on function private.finance_document(jsonb) from public,anon;
grant execute on function private.finance_document(jsonb) to authenticated;

create function public.save_quotation(p_document jsonb,p_id uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; old public.quotations; totals record;
begin
 perform private.finance_role(array['admin','agent']);perform private.finance_document(p_document);
 select sum(round(quantity*unit_price_minor)) subtotal,sum(discount_minor) discount,sum(tax_minor) tax,sum(total_minor) total into totals from private.finance_lines(p_document->'items');
 if p_id is not null then
  select * into old from public.quotations where id=p_id for update;
  if old.id is null or old.status<>'draft' or exists(select 1 from public.bookings where quotation_id=p_id) then raise exception 'Only unconverted draft quotations can be edited';end if;
  result:=p_id;
  update public.quotations set customer_id=(p_document->>'customer_id')::uuid,itinerary_id=nullif(p_document->>'itinerary_id','')::uuid,start_date=nullif(p_document->>'start_date','')::date,end_date=nullif(p_document->>'end_date','')::date,traveler_count=coalesce((p_document->>'traveler_count')::int,1),destination=coalesce(p_document->>'destination',''),currency=p_document->>'currency',exchange_rate=coalesce((p_document->>'exchange_rate')::numeric,1),valid_until=nullif(p_document->>'valid_until','')::date,terms=p_document->>'terms',subtotal_minor=totals.subtotal,discount_minor=totals.discount,tax_minor=totals.tax,total_minor=totals.total where id=result;
  delete from public.quotation_items where quotation_id=result;
 else
  insert into public.quotations(number,customer_id,itinerary_id,start_date,end_date,traveler_count,destination,currency,exchange_rate,valid_until,terms,subtotal_minor,discount_minor,tax_minor,total_minor)
  values('',(p_document->>'customer_id')::uuid,nullif(p_document->>'itinerary_id','')::uuid,nullif(p_document->>'start_date','')::date,nullif(p_document->>'end_date','')::date,coalesce((p_document->>'traveler_count')::int,1),coalesce(p_document->>'destination',''),p_document->>'currency',coalesce((p_document->>'exchange_rate')::numeric,1),nullif(p_document->>'valid_until','')::date,p_document->>'terms',totals.subtotal,totals.discount,totals.tax,totals.total) returning id into result;
 end if;
 insert into public.quotation_items(quotation_id,service_id,description,quantity,unit_price_minor,cost_minor,discount_minor,tax_rate,tax_minor,total_minor,sort_order)
 select result,l.service_id,l.description,l.quantity,l.unit_price_minor,l.cost_minor,l.discount_minor,l.tax_rate,l.tax_minor,l.total_minor,l.sort_order from private.finance_lines(p_document->'items') l;
 return result;
end $$;
create function public.quotation_from_itinerary(p_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare itinerary public.itineraries;
begin
 perform private.finance_role(array['admin','agent']);select * into itinerary from public.itineraries where id=p_id;
 if itinerary.id is null then raise exception 'Itinerary not found';end if;
 return public.save_quotation(jsonb_build_object('customer_id',itinerary.customer_id,'itinerary_id',itinerary.id,'start_date',itinerary.start_date,'end_date',itinerary.end_date,'traveler_count',itinerary.traveler_count,'destination',itinerary.destination,'currency',itinerary.currency,'exchange_rate','1','valid_until',current_date+14,'terms',coalesce(itinerary.inclusions,'')||E'\n'||coalesce(itinerary.exclusions,''),'items',itinerary.legacy_content->'pricing'));
end $$;
create function public.set_quotation_status(p_id uuid,p_status text) returns uuid language plpgsql security invoker set search_path='' as $$
declare q public.quotations;
begin
 perform private.finance_role(array['admin','agent']);select * into q from public.quotations where id=p_id for update;
 if q.id is null then raise exception 'Quotation not found';end if;
 if q.status=p_status then return p_id;end if;
 if not((q.status='draft' and p_status='sent') or(q.status='sent' and p_status in('accepted','rejected','expired'))) then raise exception 'Invalid quotation status transition';end if;
 if p_status='sent' and (not exists(select 1 from public.quotation_items where quotation_id=p_id) or q.total_minor<=0) then raise exception 'Quotation needs priced line items';end if;
 if p_status='expired' and (q.valid_until is null or q.valid_until>=current_date) then raise exception 'Quotation validity date has not expired';end if;
 if p_status='accepted' and q.valid_until<current_date then raise exception 'Expired quotation cannot be accepted';end if;
 update public.quotations set status=p_status where id=p_id;
 return p_id;
end $$;

create function public.save_booking(p_document jsonb,p_id uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; totals record;
begin
 perform private.finance_role(array['admin','agent']);perform private.finance_document(p_document);
 select sum(round(quantity*cost_minor)) cost,sum(total_minor) total into totals from private.finance_lines(p_document->'items');
 if nullif(p_document->>'assigned_agent_id','') is not null and not exists(select 1 from public.profiles where id=(p_document->>'assigned_agent_id')::uuid and role in('admin','agent') and is_active) then raise exception 'Invalid assigned agent';end if;
 if p_id is not null then
  perform 1 from public.bookings where id=p_id for update;
  if not found then raise exception 'Booking not found';end if;
  if exists(select 1 from public.invoices where booking_id=p_id and status<>'void') then raise exception 'Invoiced booking financial details are locked';end if;
  result:=p_id;
  update public.bookings set customer_id=(p_document->>'customer_id')::uuid,itinerary_id=nullif(p_document->>'itinerary_id','')::uuid,assigned_agent_id=coalesce(nullif(p_document->>'assigned_agent_id','')::uuid,auth.uid()),start_date=nullif(p_document->>'start_date','')::date,end_date=nullif(p_document->>'end_date','')::date,traveler_count=coalesce((p_document->>'traveler_count')::int,1),destination=coalesce(p_document->>'destination',''),currency=p_document->>'currency',exchange_rate=coalesce((p_document->>'exchange_rate')::numeric,1),cost_minor=totals.cost,selling_minor=totals.total,notes=p_document->>'notes' where id=result;
  delete from public.booking_items where booking_id=result;
 else
  insert into public.bookings(customer_id,itinerary_id,assigned_agent_id,start_date,end_date,traveler_count,destination,currency,exchange_rate,cost_minor,selling_minor,notes)
  values((p_document->>'customer_id')::uuid,nullif(p_document->>'itinerary_id','')::uuid,coalesce(nullif(p_document->>'assigned_agent_id','')::uuid,auth.uid()),nullif(p_document->>'start_date','')::date,nullif(p_document->>'end_date','')::date,coalesce((p_document->>'traveler_count')::int,1),coalesce(p_document->>'destination',''),p_document->>'currency',coalesce((p_document->>'exchange_rate')::numeric,1),totals.cost,totals.total,p_document->>'notes') returning id into result;
 end if;
 insert into public.booking_items(booking_id,service_id,supplier_id,description,quantity,unit_price_minor,cost_minor,discount_minor,tax_rate,tax_minor,total_minor,sort_order)
 select result,l.service_id,s.supplier_id,l.description,l.quantity,l.unit_price_minor,l.cost_minor,l.discount_minor,l.tax_rate,l.tax_minor,l.total_minor,l.sort_order from private.finance_lines(p_document->'items') l left join public.services s on s.id=l.service_id;
 return result;
end $$;
create function public.convert_quotation(p_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare q public.quotations; result uuid; lines jsonb;
begin
 perform private.finance_role(array['admin','agent']);select * into q from public.quotations where id=p_id for update;
 if q.id is null then raise exception 'Quotation not found';end if;
 select id into result from public.bookings where quotation_id=p_id;if result is not null then return result;end if;
 if q.status<>'accepted' then raise exception 'Quotation must be accepted before conversion';end if;
 select jsonb_agg(to_jsonb(i) order by sort_order,id) into lines from public.quotation_items i where quotation_id=p_id;
 result:=public.save_booking(to_jsonb(q)||jsonb_build_object('items',lines));
 update public.bookings set quotation_id=p_id where id=result;
 update public.customers set lead_status='won' where id=q.customer_id;
 insert into public.activities(customer_id,kind,summary) values(q.customer_id,'booking_created','Quotation '||q.number||' converted to booking');
 return result;
end $$;
create function public.update_booking_details(p_id uuid,p_details jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare booking public.bookings; v jsonb; changed integer;
begin
 perform private.finance_role(array['admin','agent']);select * into booking from public.bookings where id=p_id for update;
 if booking.id is null then raise exception 'Booking not found';end if;
 if p_details->>'status' not in('pending','confirmed','completed','cancelled') or length(coalesce(p_details->>'notes',''))>10000 or jsonb_typeof(p_details->'travelers') is distinct from 'array' or jsonb_array_length(p_details->'travelers')>10000 or jsonb_typeof(p_details->'confirmations') is distinct from 'array' or jsonb_array_length(p_details->'confirmations')>100 then raise exception 'Invalid booking details';end if;
 if booking.status in('completed','cancelled') and p_details->>'status'<>booking.status then raise exception 'Completed or cancelled booking cannot be reopened';end if;
 update public.bookings set status=p_details->>'status',notes=p_details->>'notes' where id=p_id;
 delete from public.travelers where booking_id=p_id;
 for v in select value from jsonb_array_elements(p_details->'travelers') loop
  if length(coalesce(v->>'full_name','')) not between 1 and 160 or length(coalesce(v->>'notes',''))>5000 then raise exception 'Invalid traveler details';end if;
  insert into public.travelers(booking_id,full_name,date_of_birth,nationality,passport_number,passport_expiry,notes) values(p_id,v->>'full_name',nullif(v->>'date_of_birth','')::date,v->>'nationality',v->>'passport_number',nullif(v->>'passport_expiry','')::date,v->>'notes');
 end loop;
 for v in select value from jsonb_array_elements(p_details->'confirmations') loop
  if length(coalesce(v->>'confirmation_number',''))>160 then raise exception 'Invalid confirmation number';end if;
  update public.booking_items set confirmation_status=v->>'confirmation_status',confirmation_number=nullif(v->>'confirmation_number','') where id=(v->>'id')::uuid and booking_id=p_id;
  get diagnostics changed=row_count;if changed<>1 then raise exception 'Confirmation line does not belong to booking';end if;
 end loop;
 return p_id;
end $$;

-- Accounting receives billing snapshots rather than access to customers' passports.
create function private.customer_billing(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin perform private.finance_role(array['admin','agent','accountant']);select jsonb_build_object('billing_name',name,'billing_email',email,'billing_address',address) into result from public.customers where id=p_id;if result is null then raise exception 'Customer not found';end if;return result;end $$;
revoke all on function private.customer_billing(uuid) from public,anon;
grant execute on function private.customer_billing(uuid) to authenticated;

create function public.save_invoice(p_document jsonb,p_id uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; totals record; booking public.bookings; existing numeric;
begin
 perform private.finance_role(array['admin','accountant']);perform private.finance_document(p_document);
 if length(coalesce(p_document->>'billing_name','')) not between 1 and 160 or length(coalesce(p_document->>'billing_address',''))>2000 or length(coalesce(p_document->>'billing_email',''))>254 then raise exception 'Invalid invoice billing details';end if;
 select sum(round(quantity*unit_price_minor)) subtotal,sum(discount_minor) discount,sum(tax_minor) tax,sum(total_minor) total into totals from private.finance_lines(p_document->'items');
 if nullif(p_document->>'booking_id','') is not null then
  select * into booking from public.bookings where id=(p_document->>'booking_id')::uuid for update;
  if booking.id is null or booking.status='cancelled' or booking.customer_id<>(p_document->>'customer_id')::uuid or booking.currency<>p_document->>'currency' then raise exception 'Invoice does not match an active booking';end if;
  select coalesce(sum(total_minor),0) into existing from public.invoices where booking_id=booking.id and status<>'void' and document_type='invoice' and id is distinct from p_id;
  if existing+totals.total>booking.selling_minor then raise exception 'Invoices exceed booking balance';end if;
 end if;
 if p_id is not null then
  perform 1 from public.invoices where id=p_id and status='draft' and document_type='invoice' for update;
  if not found then raise exception 'Only draft invoices can be edited';end if;
  result:=p_id;
  update public.invoices set customer_id=(p_document->>'customer_id')::uuid,booking_id=nullif(p_document->>'booking_id','')::uuid,issue_date=coalesce(nullif(p_document->>'issue_date','')::date,current_date),due_date=nullif(p_document->>'due_date','')::date,currency=p_document->>'currency',exchange_rate=coalesce((p_document->>'exchange_rate')::numeric,1),billing_name=p_document->>'billing_name',billing_email=nullif(p_document->>'billing_email',''),billing_address=p_document->>'billing_address',terms=p_document->>'terms',subtotal_minor=totals.subtotal,discount_minor=totals.discount,tax_minor=totals.tax,total_minor=totals.total where id=result;
  delete from public.invoice_items where invoice_id=result;
 else
  insert into public.invoices(number,customer_id,booking_id,issue_date,due_date,currency,exchange_rate,billing_name,billing_email,billing_address,terms,subtotal_minor,discount_minor,tax_minor,total_minor)
  values('',(p_document->>'customer_id')::uuid,nullif(p_document->>'booking_id','')::uuid,coalesce(nullif(p_document->>'issue_date','')::date,current_date),nullif(p_document->>'due_date','')::date,p_document->>'currency',coalesce((p_document->>'exchange_rate')::numeric,1),p_document->>'billing_name',nullif(p_document->>'billing_email',''),p_document->>'billing_address',p_document->>'terms',totals.subtotal,totals.discount,totals.tax,totals.total) returning id into result;
 end if;
 insert into public.invoice_items(invoice_id,description,quantity,unit_price_minor,discount_minor,tax_rate,tax_minor,total_minor,sort_order)
 select result,l.description,l.quantity,l.unit_price_minor,l.discount_minor,l.tax_rate,l.tax_minor,l.total_minor,l.sort_order from private.finance_lines(p_document->'items') l;
 return result;
end $$;

-- Only this scoped operation lets sales agents generate an invoice draft. It exposes no arbitrary invoice mutation.
create function private.booking_invoice(p_id uuid,p_options jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare booking public.bookings; result uuid; existing numeric; amount bigint; n bigint; yr integer:=extract(year from current_date)::int; billing jsonb; option_type text; line public.booking_items; allocated numeric; net bigint; tax bigint; subtotal bigint:=0; taxtotal bigint:=0; denominator numeric; proportion numeric; remainder bigint; count_items integer; pos integer:=0;
begin
 perform private.finance_role(array['admin','agent','accountant']);select * into booking from public.bookings where id=p_id for update;
 if booking.id is null or booking.status='cancelled' then raise exception 'An active booking is required';end if;
 option_type:=p_options->>'billing_type';if option_type not in('deposit','partial','balance') then raise exception 'Invalid billing type';end if;
 if length(coalesce(p_options->>'terms',''))>20000 then raise exception 'Invoice terms exceed limit';end if;
 select coalesce(sum(total_minor),0) into existing from public.invoices where booking_id=p_id and document_type='invoice' and status<>'void';
 amount:=case when option_type='balance' then booking.selling_minor-existing else (p_options->>'amount_minor')::bigint end;
 if amount is null or amount<=0 or existing+amount>booking.selling_minor then raise exception 'Invoice amount exceeds booking balance';end if;
 billing:=private.customer_billing(booking.customer_id);
 insert into private.document_counters(kind,year,last_value) values('invoice',yr,1) on conflict(kind,year) do update set last_value=private.document_counters.last_value+1 returning last_value into n;
 insert into public.invoices(number,customer_id,booking_id,billing_type,issue_date,due_date,currency,exchange_rate,billing_name,billing_email,billing_address,terms)
 values(private.format_number('invoice',yr,n),booking.customer_id,booking.id,option_type,coalesce(nullif(p_options->>'issue_date','')::date,current_date),nullif(p_options->>'due_date','')::date,booking.currency,booking.exchange_rate,billing->>'billing_name',billing->>'billing_email',billing->>'billing_address',p_options->>'terms') returning id into result;
 select count(*) into count_items from public.booking_items where booking_id=p_id and total_minor>0;
 if count_items=0 then raise exception 'Booking needs priced line items';end if;
 if existing=0 and amount=booking.selling_minor then
  insert into public.invoice_items(invoice_id,booking_item_id,description,sort_order,quantity,unit_price_minor,discount_minor,tax_rate,tax_minor,total_minor)
  select result,id,description,sort_order,quantity,unit_price_minor,discount_minor,tax_rate,tax_minor,total_minor from public.booking_items where booking_id=p_id;
  select coalesce(sum(round(quantity*unit_price_minor)),0),coalesce(sum(tax_minor),0) into subtotal,taxtotal from public.booking_items where booking_id=p_id;
  update public.invoices set subtotal_minor=subtotal,discount_minor=(select coalesce(sum(discount_minor),0) from public.booking_items where booking_id=p_id),tax_minor=taxtotal,total_minor=amount where id=result;
  return result;
 end if;
 remainder:=amount;
 for line in select * from public.booking_items where booking_id=p_id and total_minor>0 order by sort_order,id loop
  pos:=pos+1;
  -- Allocate gross minor units with exact numeric arithmetic, then derive a net amount that obeys the line tax rule.
  allocated:=case when pos=count_items then remainder else floor(amount::numeric*line.total_minor/booking.selling_minor) end;
  remainder:=remainder-allocated::bigint;
  if allocated=0 then continue;end if;
  net:=round(allocated/(1+line.tax_rate/100));tax:=round(net*line.tax_rate/100);
  -- Some inclusive totals are unrepresentable at a given rate; explicit adjustment line reconciles the one-minor-unit difference.
  insert into public.invoice_items(invoice_id,booking_item_id,description,sort_order,quantity,unit_price_minor,tax_rate,tax_minor,total_minor)
  values(result,line.id,line.description||case when option_type='balance' then '' else ' ('||option_type||')' end,pos*2,1,net,line.tax_rate,tax,net+tax);
  subtotal:=subtotal+net;taxtotal:=taxtotal+tax;
  if net+tax<>allocated then
   if net+tax>allocated then
    -- Lower net by one, maintaining the exact tax equation; remaining difference is non-taxable.
    net:=net-1;tax:=round(net*line.tax_rate/100);
    update public.invoice_items set unit_price_minor=net,tax_minor=tax,total_minor=net+tax where invoice_id=result and booking_item_id=line.id;
    subtotal:=subtotal-1;taxtotal:=(select coalesce(sum(tax_minor),0) from public.invoice_items where invoice_id=result);
   end if;
   insert into public.invoice_items(invoice_id,description,sort_order,quantity,unit_price_minor,tax_rate,tax_minor,total_minor) values(result,'Tax rounding adjustment',pos*2+1,1,allocated-net-tax,0,0,allocated-net-tax);
   subtotal:=subtotal+(allocated-net-tax);
  end if;
 end loop;
 update public.invoices set subtotal_minor=subtotal,tax_minor=taxtotal,total_minor=subtotal+taxtotal where id=result;
 return result;
end $$;
revoke all on function private.booking_invoice(uuid,jsonb) from public,anon;
grant execute on function private.booking_invoice(uuid,jsonb) to authenticated;
create function public.invoice_from_booking(p_id uuid,p_options jsonb) returns uuid language sql security invoker set search_path='' as $$select private.booking_invoice(p_id,p_options)$$;
create function public.set_invoice_status(p_id uuid,p_status text) returns uuid language plpgsql security invoker set search_path='' as $$
begin perform private.finance_role(array['admin','accountant']);if p_status not in('sent','void') then raise exception 'Invalid invoice status';end if;update public.invoices set status=p_status where id=p_id;if not found then raise exception 'Invoice not found';end if;return p_id;end $$;
create function public.add_payment(p_payment jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 perform private.finance_role(array['admin','accountant']);
 if coalesce(p_payment->>'amount_minor','') !~ '^\d+$' or length(coalesce(p_payment->>'reference',''))>200 or length(coalesce(p_payment->>'notes',''))>5000 then raise exception 'Invalid payment details';end if;
 insert into public.payments(invoice_id,amount_minor,payment_date,method,reference,notes) values((p_payment->>'invoice_id')::uuid,(p_payment->>'amount_minor')::bigint,coalesce(nullif(p_payment->>'payment_date','')::date,current_date),p_payment->>'method',p_payment->>'reference',p_payment->>'notes') returning id into result;
 return result;
end $$;
create function public.credit_invoice(p_id uuid,p_options jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare original public.invoices; result uuid; amount bigint; credited numeric; line public.invoice_items; allocated bigint; remaining bigint; net bigint; tax bigint; subtotal bigint:=0; taxes bigint:=0; pos integer:=0; n integer;
begin
 perform private.finance_role(array['admin','accountant']);select * into original from public.invoices where id=p_id for update;
 if original.id is null or original.document_type<>'invoice' or original.status in('draft','void') then raise exception 'Credit notes require an issued invoice';end if;
 amount:=(p_options->>'amount_minor')::bigint;
 if amount<=0 or length(coalesce(p_options->>'reason','')) not between 1 and 2000 then raise exception 'Invalid credit amount or reason';end if;
 select coalesce(sum(total_minor),0) into credited from public.invoices where credited_invoice_id=p_id and status<>'void';
 if credited+amount>original.total_minor then raise exception 'Credit notes exceed original invoice total';end if;
 insert into public.invoices(number,customer_id,booking_id,credited_invoice_id,document_type,billing_type,issue_date,currency,exchange_rate,billing_name,billing_email,billing_address,terms)
 values('',original.customer_id,original.booking_id,p_id,'credit_note','balance',coalesce(nullif(p_options->>'issue_date','')::date,current_date),original.currency,original.exchange_rate,original.billing_name,original.billing_email,original.billing_address,p_options->>'reason') returning id into result;
 select count(*) into n from public.invoice_items where invoice_id=p_id and total_minor>0;remaining:=amount;
 for line in select * from public.invoice_items where invoice_id=p_id and total_minor>0 order by sort_order,id loop
  pos:=pos+1;allocated:=case when pos=n then remaining else floor(amount::numeric*line.total_minor/original.total_minor) end;remaining:=remaining-allocated;
  if allocated=0 then continue;end if;
  net:=round(allocated/(1+line.tax_rate/100));tax:=round(net*line.tax_rate/100);
  if net+tax>allocated then net:=net-1;tax:=round(net*line.tax_rate/100);end if;
  insert into public.invoice_items(invoice_id,description,sort_order,quantity,unit_price_minor,tax_rate,tax_minor,total_minor)values(result,'Credit: '||line.description,pos*2,1,net,line.tax_rate,tax,net+tax);
  subtotal:=subtotal+net;taxes:=taxes+tax;
  if net+tax<>allocated then
   insert into public.invoice_items(invoice_id,description,sort_order,quantity,unit_price_minor,tax_rate,tax_minor,total_minor) values(result,'Tax rounding adjustment',pos*2+1,1,allocated-net-tax,0,0,allocated-net-tax);
   subtotal:=subtotal+allocated-net-tax;
  end if;
 end loop;
 if n=0 then raise exception 'Issued invoice requires priced line items';end if;
 update public.invoices set subtotal_minor=subtotal,tax_minor=taxes,total_minor=amount where id=result;
 return result;
end $$;

-- Invoice balance incorporates issued credits; ledgers remain append-only.
create or replace function private.record_payment() returns trigger language plpgsql set search_path='' as $$
declare inv public.invoices; credits bigint;
begin
 if tg_op<>'INSERT' then raise exception 'Payment ledger is append-only';end if;
 select * into inv from public.invoices where id=new.invoice_id for update;
 if inv.status not in('sent','partially_paid','overdue') or inv.document_type<>'invoice' then raise exception 'Payments require an issued open invoice';end if;
 select coalesce(sum(total_minor),0) into credits from public.invoices where credited_invoice_id=inv.id and status not in('draft','void');
 if inv.paid_minor+new.amount_minor>inv.total_minor-credits then raise exception 'Payment exceeds outstanding balance after credits';end if;
 update public.invoices set paid_minor=paid_minor+new.amount_minor,status=case when paid_minor+new.amount_minor=total_minor-credits then 'paid' else 'partially_paid' end where id=inv.id;
 return new;
end $$;

do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in('save_quotation','quotation_from_itinerary','set_quotation_status','save_booking','convert_quotation','update_booking_details','save_invoice','invoice_from_booking','set_invoice_status','add_payment','credit_invoice') loop
  execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;

-- Direct Data API writes receive the same numeric and issued-history protections.
create function private.lock_sales_document() returns trigger language plpgsql set search_path='' as $$
declare parent_id uuid; oldstatus text;
begin
 if tg_table_name='quotations' then
  if tg_op='DELETE' and old.status<>'draft' then raise exception 'Issued quotation is locked';end if;
  if tg_op='UPDATE' and old.status<>'draft' and (to_jsonb(new)-array['status','updated_at']) is distinct from(to_jsonb(old)-array['status','updated_at']) then raise exception 'Issued quotation is immutable';end if;
 elsif tg_table_name='quotation_items' then
  parent_id:=case when tg_op='DELETE' then old.quotation_id else new.quotation_id end;
  select status into oldstatus from public.quotations where id=parent_id for update;
  if oldstatus is not null and oldstatus<>'draft' then raise exception 'Issued quotation line items are immutable';end if;
 elsif tg_table_name='bookings' and tg_op='UPDATE' then
  if exists(select 1 from public.invoices where booking_id=old.id and status<>'void') and(to_jsonb(new)-array['status','notes','updated_at']) is distinct from(to_jsonb(old)-array['status','notes','updated_at']) then raise exception 'Invoiced booking financial details are locked';end if;
 elsif tg_table_name='booking_items' then
  parent_id:=case when tg_op='DELETE' then old.booking_id else new.booking_id end;
  perform 1 from public.bookings where id=parent_id for update;
  if exists(select 1 from public.invoices where booking_id=parent_id and status<>'void') and(tg_op<>'UPDATE' or(to_jsonb(new)-array['confirmation_status','confirmation_number','updated_at']) is distinct from(to_jsonb(old)-array['confirmation_status','confirmation_number','updated_at'])) then raise exception 'Invoiced booking line items are immutable';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.lock_sales_document() from public,anon,authenticated;
create trigger lock_sales_document before update or delete on public.quotations for each row execute function private.lock_sales_document();
create trigger lock_sales_document before insert or update or delete on public.quotation_items for each row execute function private.lock_sales_document();
create trigger lock_sales_document before update on public.bookings for each row execute function private.lock_sales_document();
create trigger lock_sales_document before insert or update or delete on public.booking_items for each row execute function private.lock_sales_document();

-- Close direct REST status transition and amount tampering paths.
create function private.validate_financial_totals() returns trigger language plpgsql set search_path='' as $$
declare s numeric;d numeric;t numeric;
begin
 if tg_table_name in('quotations','invoices') then
  if greatest(new.subtotal_minor,new.discount_minor,new.tax_minor,new.total_minor)>9007199254740991 then raise exception 'Document amount exceeds supported range';end if;
 else
  if greatest(new.cost_minor,new.selling_minor)>9007199254740991 then raise exception 'Document amount exceeds supported range';end if;
 end if;
 if tg_table_name='quotations' and tg_op='UPDATE' and new.status<>old.status then
  if not((old.status='draft' and new.status='sent') or(old.status='sent' and new.status in('accepted','rejected','expired'))) then raise exception 'Invalid quotation status transition';end if;
  if new.status='sent' then
   select coalesce(sum(round(quantity*unit_price_minor)),0),coalesce(sum(discount_minor),0),coalesce(sum(tax_minor),0) into s,d,t from public.quotation_items where quotation_id=new.id;
   if s<>new.subtotal_minor or d<>new.discount_minor or t<>new.tax_minor or new.total_minor<=0 then raise exception 'Quotation totals must match line items';end if;
  end if;
  if new.status='accepted' and new.valid_until<current_date then raise exception 'Expired quotation cannot be accepted';end if;
  if new.status='expired' and(new.valid_until is null or new.valid_until>=current_date) then raise exception 'Quotation validity date has not expired';end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_financial_totals() from public,anon,authenticated;
create trigger validate_financial_totals before insert or update on public.quotations for each row execute function private.validate_financial_totals();
create trigger validate_financial_totals before insert or update on public.bookings for each row execute function private.validate_financial_totals();
create trigger validate_financial_totals before insert or update on public.invoices for each row execute function private.validate_financial_totals();

-- Trigger sees accounting records so sales cannot bypass financial locks through RLS-hidden invoices.
alter function private.lock_sales_document() security definer;

-- Issued credit notes reconcile the source ledger under its row lock.
create function private.credit_ledger() returns trigger language plpgsql security definer set search_path='' as $$
declare inv public.invoices; credited bigint;
begin
 if new.document_type<>'credit_note' or tg_op<>'UPDATE' or new.status=old.status then return new;end if;
 select * into inv from public.invoices where id=new.credited_invoice_id for update;
 select coalesce(sum(total_minor),0) into credited from public.invoices where credited_invoice_id=inv.id and status not in('draft','void');
 if inv.status<>'void' then
  update public.invoices set status=case when paid_minor+credited>=total_minor then 'paid' when paid_minor>0 then 'partially_paid' when due_date<current_date then 'overdue' else 'sent' end where id=inv.id;
 end if;
 return new;
end $$;
revoke all on function private.credit_ledger() from public,anon,authenticated;
create trigger credit_ledger after update on public.invoices for each row execute function private.credit_ledger();

create function private.billing_customers(p_search text,p_limit integer) returns table(id uuid,name text,email text,address text) language plpgsql security definer set search_path='' as $$
begin
 perform private.finance_role(array['admin','accountant']);
 if length(p_search)>160 or p_limit not between 1 and 500 then raise exception 'Invalid customer search';end if;
 return query select c.id,c.name,c.email,c.address from public.customers c where c.name ilike '%'||p_search||'%' order by c.name,c.id limit p_limit;
end $$;
revoke all on function private.billing_customers(text,integer) from public,anon;
grant execute on function private.billing_customers(text,integer) to authenticated;
create function public.list_billing_customers(p_search text default '',p_limit integer default 500) returns table(id uuid,name text,email text,address text) language sql security invoker set search_path='' as $$select * from private.billing_customers(p_search,p_limit)$$;
revoke all on function public.list_billing_customers(text,integer) from public,anon;
grant execute on function public.list_billing_customers(text,integer) to authenticated;

create function private.invoice_billing_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare booking public.bookings; existing numeric;
begin
 if new.status='sent' and new.total_minor<=0 then raise exception 'An issued invoice needs line items with a positive total';end if;
 if new.status='void' and exists(select 1 from public.invoices where credited_invoice_id=new.id and status not in('draft','void')) then raise exception 'Credited invoices cannot be voided';end if;
 if new.document_type='invoice' and new.booking_id is not null and(tg_op='INSERT' or new.total_minor<>old.total_minor or new.booking_id is distinct from old.booking_id or new.currency<>old.currency or new.customer_id<>old.customer_id or new.status='void') then
  select * into booking from public.bookings where id=new.booking_id for update;
  if booking.id is null or booking.customer_id<>new.customer_id or booking.currency<>new.currency or (booking.status='cancelled' and new.status<>'void') then raise exception 'Invoice does not match an active booking';end if;
  select coalesce(sum(total_minor),0) into existing from public.invoices where booking_id=booking.id and document_type='invoice' and status<>'void' and id<>new.id;
  if new.status<>'void' and existing+new.total_minor>booking.selling_minor then raise exception 'Invoices exceed booking balance';end if;
 end if;
 return new;
end $$;
revoke all on function private.invoice_billing_guard() from public,anon,authenticated;
create trigger invoice_billing_guard before insert or update on public.invoices for each row execute function private.invoice_billing_guard();

-- Numbering uses the configured formats while counters remain atomic and role guarded.
create function private.format_number(p_kind text,p_year integer,p_sequence bigint) returns text language plpgsql security invoker set search_path='' as $$
declare template text;
begin
 if p_kind not in('quotation','invoice','credit_note') or p_year not between 2000 and 9999 or p_sequence<1 then raise exception 'Invalid document number request';end if;
 select numbering_formats->>p_kind into template from public.settings where id=1;
 template:=coalesce(template,case p_kind when 'quotation' then 'QT-{year}-{sequence}' when 'invoice' then 'INV-{year}-{sequence}' else 'CN-{year}-{sequence}' end);
 if length(template)>80 or template !~ '^[A-Za-z0-9-]*\{year\}[A-Za-z0-9-]*\{sequence\}$' then raise exception 'Invalid document numbering format';end if;
 return replace(replace(template,'{year}',p_year::text),'{sequence}',lpad(p_sequence::text,greatest(4,length(p_sequence::text)),'0'));
end $$;
revoke all on function private.format_number(text,integer,bigint) from public,anon;
grant execute on function private.format_number(text,integer,bigint) to authenticated;
create or replace function private.allocate_number(p_kind text,p_year integer) returns text language plpgsql security definer set search_path='' as $$
declare n bigint;r text:=private.current_role();
begin
 if auth.uid() is null or r is null or (p_kind='quotation' and r not in('admin','agent')) or(p_kind in('invoice','credit_note') and r not in('admin','accountant')) then raise exception 'Document numbering permission denied' using errcode='42501';end if;
 if p_kind not in('quotation','invoice','credit_note') or p_year not between 2000 and 9999 then raise exception 'Invalid document number request';end if;
 insert into private.document_counters(kind,year,last_value) values(p_kind,p_year,1) on conflict(kind,year)do update set last_value=private.document_counters.last_value+1,updated_at=now() returning last_value into n;
 return private.format_number(p_kind,p_year,n);
end $$;

-- Moving an item to another parent cannot evade the issued-history lock.
create function private.lock_original_sales_item() returns trigger language plpgsql security definer set search_path='' as $$
declare original_status text;
begin
 if tg_table_name='quotation_items' then
  if old.quotation_id<>new.quotation_id then
  select status into original_status from public.quotations where id=old.quotation_id for update;
  if original_status<>'draft' then raise exception 'Issued quotation line items are immutable';end if;
   end if;
 elsif tg_table_name='booking_items' then
  if old.booking_id<>new.booking_id then
  perform 1 from public.bookings where id=old.booking_id for update;
  if exists(select 1 from public.invoices where booking_id=old.booking_id and status<>'void') then raise exception 'Invoiced booking line items are immutable';end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function private.lock_original_sales_item() from public,anon,authenticated;
create trigger lock_original_sales_item before update on public.quotation_items for each row execute function private.lock_original_sales_item();
create trigger lock_original_sales_item before update on public.booking_items for each row execute function private.lock_original_sales_item();

create function private.lock_booking_origin() returns trigger language plpgsql set search_path='' as $$
begin
 if old.quotation_id is not null and new.quotation_id is distinct from old.quotation_id then raise exception 'Converted quotation link is immutable';end if;
 return new;
end $$;
revoke all on function private.lock_booking_origin() from public,anon,authenticated;
create trigger lock_booking_origin before update on public.bookings for each row execute function private.lock_booking_origin();
