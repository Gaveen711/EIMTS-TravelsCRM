create or replace function public.consultant_insights(p_currency text default 'USD', p_date date default current_date)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
 if (select private.current_role()) not in ('admin','agent','accountant') then raise exception 'Workspace access required' using errcode='42501'; end if;
 if p_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid currency'; end if;
 with ledger as (
   select i.*,coalesce((select sum(c.total_minor) from public.invoices c where c.credited_invoice_id=i.id and c.status not in ('draft','void') and c.issue_date<=p_date),0) as credits
   from public.invoices i where i.currency=p_currency and i.document_type='invoice' and i.status not in ('draft','void') and i.issue_date<=p_date
 ), quote_count as (select count(*) as count from public.quotations where currency=p_currency), booked as (select count(*) as count from public.bookings where currency=p_currency and quotation_id is not null and status<>'cancelled')
 select jsonb_build_object(
  'currency',p_currency,
  'revenue_minor',coalesce((select sum(case when document_type='credit_note' then -total_minor else total_minor end) from public.invoices where currency=p_currency and status not in ('draft','void') and issue_date>=date_trunc('month',p_date)::date and issue_date<=p_date),0)::text,
  'outstanding_minor',coalesce((select sum(greatest(0,total_minor-paid_minor-credits)) from ledger),0)::text,
  'overdue_count',(select count(*) from ledger where due_date<p_date and greatest(0,total_minor-paid_minor-credits)>0),
  'refund_due_minor',coalesce((select sum(greatest(0,paid_minor+credits-total_minor)) from ledger),0)::text,
  'awaiting_quotes',(select count(*) from public.quotations where currency=p_currency and status='sent' and (valid_until is null or valid_until>=p_date)),
  'customers',(select count(*) from public.customers),
  'conversion_rate',case when (select count from quote_count)>0 then round(100.0*(select count from booked)/(select count from quote_count),1) else 0 end,
  'departures',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,destination,start_date,traveler_count,status from public.bookings where currency=p_currency and status in ('pending','confirmed') and start_date>=p_date order by start_date,id limit 8) x),'[]'::jsonb),
  'attention',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,number,billing_name,due_date,greatest(0,total_minor-paid_minor-credits)::text as outstanding_minor from ledger where due_date<p_date and greatest(0,total_minor-paid_minor-credits)>0 order by due_date,id limit 8) x),'[]'::jsonb),
  'destinations',coalesce((select jsonb_agg(to_jsonb(x)) from (select destination,count(*) as bookings from public.bookings where currency=p_currency and status<>'cancelled' and destination<>'' group by destination order by count(*) desc,destination limit 6) x),'[]'::jsonb),
  'monthly',coalesce((select jsonb_agg(to_jsonb(x) order by x.month) from (select to_char(m.month,'YYYY-MM') as month,coalesce((select sum(case when i.document_type='credit_note' then -i.total_minor else i.total_minor end) from public.invoices i where i.currency=p_currency and i.status not in ('draft','void') and date_trunc('month',i.issue_date)=m.month and i.issue_date<=p_date),0)::text as revenue_minor from generate_series(date_trunc('month',p_date)-interval '5 months',date_trunc('month',p_date),interval '1 month') as m(month)) x),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.consultant_insights(text,date) from public,anon;
grant execute on function public.consultant_insights(text,date) to authenticated;
-- Supabase may provision this event-trigger helper. It is not a public CRM RPC.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated'; end if;
end $$;
