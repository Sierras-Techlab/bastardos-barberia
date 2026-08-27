-- Bastardos Barberia: reconcile Caja snapshots and void adjustments with
-- charged income-item totals after manager price overrides.
-- Run after 034_create_income_complete_flow_repair.sql.

begin;

create or replace function public.snapshot_daily_cash(target_register_id uuid, target_business_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare opening_value bigint;
begin
  select coalesce(opening_balance, 0) into opening_value
  from public.daily_cash_registers
  where id = target_register_id and business_date = target_business_date and closed_at is null
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'CASH_NOT_OPEN'; end if;

  delete from public.daily_cash_payment_totals where daily_cash_id = target_register_id;
  delete from public.daily_cash_sales where daily_cash_id = target_register_id;

  with sale_totals as (
    select coalesce(sum(i.total) filter (where i.status = 'active'), 0)::bigint as gross,
      coalesce(sum(i.commission_total) filter (where i.status = 'active'), 0)::bigint as commission,
      coalesce(sum(i.barbershop_net) filter (where i.status = 'active'), 0)::bigint as net,
      coalesce(sum(case when i.source_type = 'fixed_subscription' then i.total else item_totals.service end)
        filter (where i.status = 'active'), 0)::bigint as service,
      coalesce(sum(case when i.source_type = 'fixed_subscription' then 0 else item_totals.product end)
        filter (where i.status = 'active'), 0)::bigint as product,
      count(*)::integer as sale_count,
      (count(*) filter (where i.status = 'active'))::integer as active_count,
      (count(*) filter (where i.status = 'voided'))::integer as voided_count
    from public.incomes i
    left join lateral (
      select
        coalesce(sum(ii.charged_subtotal) filter (where ii.item_type = 'service'), 0)::bigint as service,
        coalesce(sum(ii.charged_subtotal) filter (where ii.item_type = 'product'), 0)::bigint as product
      from public.income_items ii where ii.income_id = i.id
    ) item_totals on true
    where i.business_date = target_business_date
  ), adjustment_totals as (
    select coalesce(sum(a.gross_delta), 0)::bigint as gross,
      coalesce(sum(a.commission_delta), 0)::bigint as commission,
      coalesce(sum(a.barbershop_net_delta), 0)::bigint as net,
      coalesce(sum(a.service_delta), 0)::bigint as service,
      coalesce(sum(a.product_delta), 0)::bigint as product,
      count(*)::integer as adjustment_count
    from public.daily_cash_adjustments a where a.business_date = target_business_date
  )
  update public.daily_cash_registers r
  set sales_gross_total = s.gross, sales_commission_total = s.commission,
      sales_barbershop_net = s.net, service_sales_total = s.service,
      product_sales_total = s.product, adjustment_gross_total = a.gross,
      adjustment_commission_total = a.commission, adjustment_barbershop_net = a.net,
      service_adjustment_total = a.service, product_adjustment_total = a.product,
      sale_count = s.sale_count, active_sale_count = s.active_count,
      voided_sale_count = s.voided_count, adjustment_count = a.adjustment_count,
      expected_cash = public.current_cash_expected(target_business_date, opening_value)
  from sale_totals s cross join adjustment_totals a where r.id = target_register_id;

  insert into public.daily_cash_sales(
    daily_cash_id, income_id, employee_id, employee_first_name_snapshot,
    employee_last_name_snapshot, customer_name_snapshot, kind, status_at_close,
    gross_total, commission_total, barbershop_net, service_total, product_total, created_at_snapshot
  )
  select target_register_id, i.id, employee.id, employee.first_name, employee.last_name,
    case when customer.id is null then null else trim(customer.first_name || ' ' || customer.last_name) end,
    case when i.source_type = 'fixed_subscription' then 'subscription'
      when item_totals.has_service and item_totals.has_product then 'combined'
      when item_totals.has_service then 'service' else 'products' end,
    i.status, i.total, i.commission_total, i.barbershop_net,
    case when i.source_type = 'fixed_subscription' then i.total else item_totals.service end,
    case when i.source_type = 'fixed_subscription' then 0 else item_totals.product end,
    i.created_at
  from public.incomes i
  join public.users employee on employee.id = i.employee_id
  left join public.customers customer on customer.id = i.customer_id
  left join lateral (
    select
      coalesce(sum(ii.charged_subtotal) filter (where ii.item_type = 'service'), 0)::bigint as service,
      coalesce(sum(ii.charged_subtotal) filter (where ii.item_type = 'product'), 0)::bigint as product,
      coalesce(bool_or(ii.item_type = 'service'), false) as has_service,
      coalesce(bool_or(ii.item_type = 'product'), false) as has_product
    from public.income_items ii where ii.income_id = i.id
  ) item_totals on true
  where i.business_date = target_business_date;

  with method_movements as (
    select ip.payment_method_id, ip.method_name_snapshot,
      ip.amount::bigint as sales_amount, 0::bigint as adjustment_amount
    from public.income_payments ip join public.incomes i on i.id = ip.income_id
    where i.business_date = target_business_date and i.status = 'active'
    union all
    select ap.payment_method_id, ap.method_name_snapshot, 0::bigint, ap.amount::bigint
    from public.daily_cash_adjustment_payments ap
    join public.daily_cash_adjustments a on a.id = ap.adjustment_id
    where a.business_date = target_business_date
  )
  insert into public.daily_cash_payment_totals(
    daily_cash_id, payment_method_id, method_name_snapshot, sales_amount, adjustment_amount
  )
  select target_register_id, payment_method_id, method_name_snapshot,
    sum(sales_amount)::bigint, sum(adjustment_amount)::bigint
  from method_movements group by payment_method_id, method_name_snapshot;
end;
$$;

create or replace function public.capture_post_close_cash_void()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  original_cash_id uuid; adjustment_id uuid; actor_record record;
  charged_service_total bigint; charged_product_total bigint;
  adjustment_date date := (new.voided_at at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not (old.status = 'active' and new.status = 'voided') then return new; end if;
  if new.total = 0 then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bastardos_daily_cash_close'));
  select id into original_cash_id from public.daily_cash_registers
  where business_date = old.business_date and closed_at is not null;
  if original_cash_id is null then return new; end if;
  select first_name, last_name into actor_record from public.users where id = new.voided_by;
  select
    case when new.source_type = 'fixed_subscription' then new.total
      else coalesce(sum(ii.charged_subtotal) filter (where ii.item_type = 'service'), 0) end,
    case when new.source_type = 'fixed_subscription' then 0
      else coalesce(sum(ii.charged_subtotal) filter (where ii.item_type = 'product'), 0) end
  into charged_service_total, charged_product_total
  from public.income_items ii where ii.income_id = new.id;
  insert into public.daily_cash_adjustments(
    business_date, source_income_id, original_daily_cash_id, created_by,
    created_by_first_name_snapshot, created_by_last_name_snapshot,
    gross_delta, commission_delta, barbershop_net_delta,
    service_delta, product_delta, created_at
  ) values (adjustment_date, new.id, original_cash_id, new.voided_by,
    actor_record.first_name, actor_record.last_name,
    -new.total::bigint, -new.commission_total::bigint, -new.barbershop_net::bigint,
    -charged_service_total, -charged_product_total, new.voided_at)
  on conflict (source_income_id) do nothing returning id into adjustment_id;
  if adjustment_id is not null then
    insert into public.daily_cash_adjustment_payments(
      adjustment_id, payment_method_id, method_name_snapshot, amount
    ) select adjustment_id, ip.payment_method_id, ip.method_name_snapshot, -ip.amount
      from public.income_payments ip where ip.income_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.snapshot_daily_cash(uuid, date) from public, anon, authenticated;
revoke execute on function public.capture_post_close_cash_void() from public, anon, authenticated;
grant execute on function public.snapshot_daily_cash(uuid, date) to service_role;
grant execute on function public.capture_post_close_cash_void() to service_role;

notify pgrst, 'reload schema';

commit;
