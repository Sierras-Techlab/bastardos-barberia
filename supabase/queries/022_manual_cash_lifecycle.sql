-- Bastardos Barberia: manual cash lifecycle over the immutable 018 snapshots.
-- Run after 021_fixed_customer_monthly_payments.sql as one transaction.

begin;

alter table public.payment_methods add column if not exists system_code text;
update public.payment_methods
set system_code = 'cash', is_active = true
where normalized_name = 'efectivo' and system_code is null;
create unique index if not exists payment_methods_cash_system_unique
  on public.payment_methods(system_code) where system_code = 'cash';
alter table public.payment_methods drop constraint if exists payment_methods_system_code_check;
alter table public.payment_methods add constraint payment_methods_system_code_check
  check (system_code is null or system_code = 'cash');

do $$
declare cash_count integer;
begin
  select count(*) into cash_count from public.payment_methods where system_code = 'cash';
  if cash_count <> 1 then
    raise exception using errcode = 'P0001', message = 'CASH_PAYMENT_METHOD_REQUIRED';
  end if;
end;
$$;

-- 018 stored only closed rows; 022 also persists the live register.
alter table public.daily_cash_registers
  alter column closed_at drop default,
  alter column closed_at drop not null,
  add column if not exists opening_balance bigint,
  add column if not exists opening_source text,
  add column if not exists opened_at timestamptz,
  add column if not exists opened_by uuid references public.users(id) on delete restrict,
  add column if not exists close_mode text,
  add column if not exists counted_cash bigint,
  add column if not exists expected_cash bigint,
  add column if not exists difference_cash bigint,
  add column if not exists reconciliation_state text not null default 'not_applicable';

alter table public.daily_cash_registers
  drop constraint if exists daily_cash_counts_check,
  drop constraint if exists daily_cash_opening_balance_check,
  drop constraint if exists daily_cash_opening_source_check,
  drop constraint if exists daily_cash_close_mode_check,
  drop constraint if exists daily_cash_reconciliation_state_check,
  drop constraint if exists daily_cash_count_difference_check,
  drop constraint if exists daily_cash_lifecycle_state_check;
alter table public.daily_cash_registers
  add constraint daily_cash_counts_check check (
    sale_count >= 0 and active_sale_count >= 0 and voided_sale_count >= 0
    and active_sale_count + voided_sale_count = sale_count and adjustment_count >= 0
  ),
  add constraint daily_cash_opening_balance_check check (opening_balance is null or opening_balance >= 0),
  add constraint daily_cash_opening_source_check check (opening_source is null or opening_source in ('manual', 'first_income')),
  add constraint daily_cash_close_mode_check check (close_mode is null or close_mode in ('manual', 'automatic')),
  add constraint daily_cash_reconciliation_state_check check (
    reconciliation_state in ('not_applicable', 'pending_confirmation', 'confirmed')
  );

alter table public.daily_cash_sales
  drop constraint if exists daily_cash_sales_kind_check,
  drop constraint if exists daily_cash_sales_economics_check;
alter table public.daily_cash_sales
  add constraint daily_cash_sales_kind_check check (kind in ('service', 'products', 'combined', 'subscription')),
  add constraint daily_cash_sales_economics_check check (
    gross_total >= 0 and commission_total >= 0 and barbershop_net >= 0
    and commission_total + barbershop_net = gross_total
    and service_total >= 0 and product_total >= 0
    and service_total + product_total = gross_total
  );

-- Backfill lifecycle metadata without modifying 018 financial snapshots.
update public.daily_cash_registers r
set opening_balance = coalesce(r.opening_balance, 0),
    opening_source = 'first_income',
    opened_at = coalesce(r.opened_at, r.closed_at),
    opened_by = coalesce(r.opened_by, (
      select i.registered_by from public.incomes i
      where i.business_date = r.business_date order by i.created_at, i.id limit 1
    )),
    close_mode = 'automatic',
    expected_cash = coalesce(r.opening_balance, 0) + coalesce((
      select sum(pt.net_amount)
      from public.daily_cash_payment_totals pt
      join public.payment_methods pm on pm.id = pt.payment_method_id
      where pt.daily_cash_id = r.id and pm.system_code = 'cash'
    ), 0),
    counted_cash = null,
    difference_cash = null,
    reconciliation_state = 'pending_confirmation'
where r.closed_at is not null and r.opening_source is null;

alter table public.daily_cash_registers
  add constraint daily_cash_count_difference_check check (
    (counted_cash is null and difference_cash is null)
    or (counted_cash is not null and difference_cash = counted_cash - expected_cash)
  ),
  add constraint daily_cash_lifecycle_state_check check (
    (closed_at is null and close_mode is null and counted_cash is null
      and difference_cash is null and reconciliation_state = 'not_applicable')
    or (closed_at is not null and close_mode = 'manual' and counted_cash is not null
      and difference_cash is not null and reconciliation_state = 'confirmed')
    or (closed_at is not null and close_mode = 'automatic' and (
      (reconciliation_state = 'pending_confirmation' and counted_cash is null and difference_cash is null)
      or (reconciliation_state = 'confirmed' and counted_cash is not null and difference_cash is not null)
    ))
  );

-- Preserve the 016 payment-method API while protecting canonical cash by code.
create or replace function public.create_payment_method(actor_user_id uuid, payment_method_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_role_id smallint;
  clean_name text := trim(coalesce(payment_method_name, ''));
  normalized text;
  created_id uuid;
begin
  select role_id into actor_role_id from public.users
  where id = actor_user_id and is_active and deleted_at is null;
  if not found or actor_role_id not in (1, 2) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;
  if length(clean_name) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_METHOD_NAME';
  end if;
  normalized := public.normalize_catalog_name(clean_name);
  if normalized = 'efectivo' then
    raise exception using errcode = '22023', message = 'CASH_PAYMENT_METHOD_PROTECTED';
  end if;
  if exists (select 1 from public.payment_methods where normalized_name = normalized) then
    raise exception using errcode = '23505', message = 'PAYMENT_METHOD_NAME_EXISTS';
  end if;
  insert into public.payment_methods(name, normalized_name, created_by, updated_by)
  values(clean_name, normalized, actor_user_id, actor_user_id) returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.update_payment_method(
  actor_user_id uuid, target_payment_method_id uuid,
  payment_method_name text, payment_method_is_active boolean
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_role_id smallint;
  clean_name text;
  normalized text;
  current_record record;
  active_count integer;
begin
  select role_id into actor_role_id from public.users
  where id = actor_user_id and is_active and deleted_at is null;
  if not found or actor_role_id not in (1, 2) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bastardos_payment_method_lifecycle', 0));
  select * into current_record from public.payment_methods
  where id = target_payment_method_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_NOT_FOUND';
  end if;
  if payment_method_name is not null then
    clean_name := trim(payment_method_name);
    if length(clean_name) not between 1 and 80 then
      raise exception using errcode = '22023', message = 'INVALID_PAYMENT_METHOD_NAME';
    end if;
    normalized := public.normalize_catalog_name(clean_name);
  end if;
  if current_record.system_code = 'cash' and (
    (normalized is not null and normalized <> current_record.normalized_name)
    or payment_method_is_active = false
  ) then
    raise exception using errcode = '22023', message = 'CASH_PAYMENT_METHOD_PROTECTED';
  end if;
  if normalized = 'efectivo' and current_record.system_code is null then
    raise exception using errcode = '22023', message = 'CASH_PAYMENT_METHOD_PROTECTED';
  end if;
  if normalized is not null and normalized <> current_record.normalized_name
    and exists (select 1 from public.payment_methods where normalized_name = normalized) then
    raise exception using errcode = '23505', message = 'PAYMENT_METHOD_NAME_EXISTS';
  end if;
  if payment_method_is_active = false and current_record.is_active then
    select count(*) into active_count from public.payment_methods where is_active;
    if active_count <= 1 then
      raise exception using errcode = 'P0001', message = 'LAST_ACTIVE_PAYMENT_METHOD';
    end if;
  end if;
  update public.payment_methods
  set name = coalesce(clean_name, name), normalized_name = coalesce(normalized, normalized_name),
      is_active = coalesce(payment_method_is_active, is_active), updated_by = actor_user_id,
      updated_at = pg_catalog.clock_timestamp()
  where id = target_payment_method_id;
  return target_payment_method_id;
end;
$$;

create or replace function public.delete_payment_method(actor_user_id uuid, target_payment_method_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_role_id smallint; current_record record; active_count integer;
begin
  select role_id into actor_role_id from public.users
  where id = actor_user_id and is_active and deleted_at is null;
  if not found or actor_role_id not in (1, 2) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bastardos_payment_method_lifecycle', 0));
  select * into current_record from public.payment_methods where id = target_payment_method_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_NOT_FOUND';
  end if;
  if current_record.system_code = 'cash' then
    raise exception using errcode = '22023', message = 'CASH_PAYMENT_METHOD_PROTECTED';
  end if;
  if current_record.is_active then
    select count(*) into active_count from public.payment_methods where is_active;
    if active_count <= 1 then
      raise exception using errcode = 'P0001', message = 'LAST_ACTIVE_PAYMENT_METHOD'; end if;
  end if;
  if exists (select 1 from public.income_payments where payment_method_id = target_payment_method_id) then
    raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_IN_USE';
  end if;
  delete from public.payment_methods where id = target_payment_method_id;
  return target_payment_method_id;
end;
$$;

revoke execute on function public.create_payment_method(uuid, text) from public, anon, authenticated;
revoke execute on function public.update_payment_method(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.delete_payment_method(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_payment_method(uuid, text) to service_role;
grant execute on function public.update_payment_method(uuid, uuid, text, boolean) to service_role;
grant execute on function public.delete_payment_method(uuid, uuid) to service_role;

create or replace function public.current_cash_expected(target_business_date date, target_opening_balance bigint)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(target_opening_balance, 0) + coalesce(sum(movement.amount), 0)::bigint
  from (
    select ip.amount::bigint as amount
    from public.income_payments ip
    join public.incomes i on i.id = ip.income_id
    join public.payment_methods pm on pm.id = ip.payment_method_id
    where i.business_date = target_business_date and i.status = 'active' and pm.system_code = 'cash'
    union all
    select ap.amount::bigint
    from public.daily_cash_adjustment_payments ap
    join public.daily_cash_adjustments a on a.id = ap.adjustment_id
    join public.payment_methods pm on pm.id = ap.payment_method_id
    where a.business_date = target_business_date and pm.system_code = 'cash'
  ) movement;
$$;

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
      bool_or(ii.item_type = 'service') as has_service,
      bool_or(ii.item_type = 'product') as has_product
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

-- Retain the proven 018 financial projection as the single internal helper.
alter function public.cash_day_as_json(date, uuid, boolean) rename to cash_financial_day_as_json;
create or replace function public.cash_day_as_json(
  target_business_date date, target_cash_id uuid, is_live boolean
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; register_record record; normalized_sales jsonb;
  charged_service_total bigint; charged_product_total bigint;
begin
  result := public.cash_financial_day_as_json(target_business_date, target_cash_id, is_live);
  if result is null then return null; end if;
  select r.*, u.id as opener_id, u.first_name as opener_first_name, u.last_name as opener_last_name
  into register_record from public.daily_cash_registers r
  left join public.users u on u.id = r.opened_by where r.id = target_cash_id;
  if is_live then
    result := jsonb_set(result, '{id}', coalesce(to_jsonb(target_cash_id), 'null'::jsonb));
    select
      coalesce(sum(case when i.source_type = 'fixed_subscription' then i.total else item_totals.service end)
        filter (where i.status = 'active'), 0)::bigint,
      coalesce(sum(case when i.source_type = 'fixed_subscription' then 0 else item_totals.product end)
        filter (where i.status = 'active'), 0)::bigint
    into charged_service_total, charged_product_total
    from public.incomes i
    left join lateral (
      select
        coalesce(sum(ii.charged_subtotal) filter (where ii.item_type = 'service'), 0)::bigint as service,
        coalesce(sum(ii.charged_subtotal) filter (where ii.item_type = 'product'), 0)::bigint as product
      from public.income_items ii
      where ii.income_id = i.id
    ) item_totals on true
    where i.business_date = target_business_date;
    result := jsonb_set(result, '{summary,serviceTotal}', to_jsonb(charged_service_total), true);
    result := jsonb_set(result, '{summary,productTotal}', to_jsonb(charged_product_total), true);
  end if;
  select coalesce(jsonb_agg(
    case when i.source_type = 'fixed_subscription'
      then jsonb_set(sale.item, '{kind}', to_jsonb('subscription'::text)) else sale.item end
    order by sale.ordinality
  ), '[]'::jsonb) into normalized_sales
  from jsonb_array_elements(result -> 'sales') with ordinality sale(item, ordinality)
  left join public.incomes i on i.id = (sale.item ->> 'id')::uuid;
  result := jsonb_set(result, '{sales}', normalized_sales);
  result := result || jsonb_build_object('lifecycle',
    case when target_cash_id is null then jsonb_build_object(
      'openingBalance', 0, 'openingSource', null, 'openedAt', null, 'openedBy', null,
      'expectedCash', public.current_cash_expected(target_business_date, 0),
      'countedCash', null, 'difference', null, 'closeMode', null,
      'reconciliationState', 'not_applicable'
    ) else jsonb_build_object(
      'openingBalance', coalesce(register_record.opening_balance, 0),
      'openingSource', register_record.opening_source, 'openedAt', register_record.opened_at,
      'openedBy', case when register_record.opener_id is null then null else jsonb_build_object(
        'id', register_record.opener_id, 'firstName', register_record.opener_first_name,
        'lastName', register_record.opener_last_name) end,
      'expectedCash', case when is_live then public.current_cash_expected(
        target_business_date, register_record.opening_balance) else register_record.expected_cash end,
      'countedCash', register_record.counted_cash, 'difference', register_record.difference_cash,
      'closeMode', register_record.close_mode,
      'reconciliationState', register_record.reconciliation_state
    ) end);
  return result;
end;
$$;

drop function if exists public.cash_day_as_json(uuid);
revoke execute on function public.cash_financial_day_as_json(date, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.cash_day_as_json(date, uuid, boolean) from public, anon, authenticated;
grant execute on function public.cash_day_as_json(date, uuid, boolean) to service_role;

create or replace function public.ensure_daily_cash_open(actor_user_id uuid, target_business_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare existing_closed_at timestamptz;
begin
  if not exists (select 1 from public.users where id = actor_user_id and is_active and deleted_at is null) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('daily-cash:' || target_business_date::text, 0));
  select closed_at into existing_closed_at
  from public.daily_cash_registers
  where business_date = target_business_date
  for update;
  if found then
    if existing_closed_at is not null then
      raise exception using errcode = 'P0001', message = 'CASH_ALREADY_CLOSED';
    end if;
    return;
  end if;
  insert into public.daily_cash_registers(
    business_date, sales_gross_total, sales_commission_total, sales_barbershop_net,
    service_sales_total, product_sales_total, sale_count, active_sale_count, voided_sale_count,
    opening_balance, opening_source, opened_at, opened_by, close_mode,
    expected_cash, reconciliation_state, closed_at
  ) values (target_business_date, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 'first_income', pg_catalog.clock_timestamp(), actor_user_id,
    null, 0, 'not_applicable', null)
  on conflict (business_date) do nothing;
end;
$$;

create or replace function public.open_daily_cash(
  actor_user_id uuid, target_business_date date, opening_balance bigint
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare new_id uuid; local_today date := (pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not exists (select 1 from public.users where id = actor_user_id and role_id in (1, 2)
    and is_active and deleted_at is null) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;
  if opening_balance < 0 then raise exception using errcode = '22023', message = 'INVALID_OPENING_BALANCE'; end if;
  if target_business_date <> local_today then raise exception using errcode = '22023', message = 'INVALID_CASH_DATE'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('daily-cash:' || target_business_date::text, 0));
  insert into public.daily_cash_registers(
    business_date, sales_gross_total, sales_commission_total, sales_barbershop_net,
    service_sales_total, product_sales_total, sale_count, active_sale_count, voided_sale_count,
    opening_balance, opening_source, opened_at, opened_by, close_mode,
    expected_cash, reconciliation_state, closed_at
  ) values (target_business_date, 0, 0, 0, 0, 0, 0, 0, 0,
    opening_balance, 'manual', pg_catalog.clock_timestamp(), actor_user_id,
    null, opening_balance, 'not_applicable', null)
  on conflict (business_date) do nothing returning id into new_id;
  if new_id is null then raise exception using errcode = 'P0001', message = 'CASH_ALREADY_OPEN'; end if;
  return public.cash_day_as_json(target_business_date, new_id, true);
end;
$$;

create or replace function public.close_daily_cash(
  actor_user_id uuid, target_business_date date, counted_cash bigint
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  register_id uuid; expected_value bigint; diff_value bigint; declared_count bigint := counted_cash;
begin
  if not exists (select 1 from public.users where id = actor_user_id and role_id in (1, 2)
    and is_active and deleted_at is null) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;
  if counted_cash < 0 then raise exception using errcode = '22023', message = 'INVALID_COUNTED_CASH'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bastardos_daily_cash_close'));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('daily-cash:' || target_business_date::text, 0));
  select id into register_id from public.daily_cash_registers
  where business_date = target_business_date and closed_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'CASH_NOT_OPEN'; end if;
  perform public.snapshot_daily_cash(register_id, target_business_date);
  select expected_cash into expected_value from public.daily_cash_registers where id = register_id;
  diff_value := counted_cash - expected_value;
  update public.daily_cash_registers
  set counted_cash = declared_count, difference_cash = diff_value,
      close_mode = 'manual', reconciliation_state = 'confirmed',
      closed_at = pg_catalog.clock_timestamp()
  where id = register_id;
  return public.cash_day_as_json(target_business_date, register_id, false);
end;
$$;

create or replace function public.confirm_daily_cash(
  actor_user_id uuid, target_register_id uuid, counted_cash bigint
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_business_date date; expected_value bigint; diff_value bigint; declared_count bigint := counted_cash;
begin
  if not exists (select 1 from public.users where id = actor_user_id and role_id in (1, 2)
    and is_active and deleted_at is null) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;
  if counted_cash < 0 then raise exception using errcode = '22023', message = 'INVALID_COUNTED_CASH'; end if;
  select business_date, expected_cash into target_business_date, expected_value
  from public.daily_cash_registers
  where id = target_register_id and closed_at is not null and close_mode = 'automatic'
    and reconciliation_state = 'pending_confirmation' for update;
  if not found then raise exception using errcode = 'P0001', message = 'CASH_NOT_PENDING_CONFIRMATION'; end if;
  diff_value := counted_cash - expected_value;
  update public.daily_cash_registers
  set counted_cash = declared_count, difference_cash = diff_value, reconciliation_state = 'confirmed'
  where id = target_register_id;
  return public.cash_day_as_json(target_business_date, target_register_id, false);
end;
$$;

create or replace function public.close_pending_daily_cash()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  local_today date := (pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
  open_register record; closed_count integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bastardos_daily_cash_close'));
  insert into public.daily_cash_registers(
    business_date, sales_gross_total, sales_commission_total, sales_barbershop_net,
    service_sales_total, product_sales_total, sale_count, active_sale_count, voided_sale_count,
    opening_balance, opening_source, opened_at, opened_by, close_mode,
    expected_cash, reconciliation_state, closed_at
  )
  select candidate.business_date, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 'first_income', candidate.opened_at, candidate.opened_by,
    null, 0, 'not_applicable', null
  from (
    select i.business_date, min(i.created_at) as opened_at, min(i.registered_by::text)::uuid as opened_by
    from public.incomes i where i.business_date < local_today group by i.business_date
    union all
    select a.business_date, min(a.created_at), min(a.created_by::text)::uuid
    from public.daily_cash_adjustments a where a.business_date < local_today group by a.business_date
  ) candidate on conflict (business_date) do nothing;

  for open_register in
    select id, business_date from public.daily_cash_registers
    where business_date < local_today and closed_at is null order by business_date for update
  loop
    perform public.snapshot_daily_cash(open_register.id, open_register.business_date);
    update public.daily_cash_registers
    set close_mode = 'automatic', reconciliation_state = 'pending_confirmation',
        counted_cash = null, difference_cash = null, closed_at = pg_catalog.clock_timestamp()
    where id = open_register.id;
    closed_count := closed_count + 1;
  end loop;
  return closed_count;
end;
$$;

-- A persisted register is not a closure: same-day voids remain ordinary voids.
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

create or replace function public.get_daily_cash(requesting_user_id uuid, target_business_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  local_today date := (pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
  register_record record;
begin
  if not exists (select 1 from public.users where id = requesting_user_id and role_id in (1, 2)
    and is_active and deleted_at is null) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;
  if target_business_date is null or target_business_date > local_today then
    raise exception using errcode = '22023', message = 'INVALID_CASH_DATE';
  end if;
  if target_business_date < local_today then perform public.close_pending_daily_cash(); end if;
  select id, closed_at into register_record from public.daily_cash_registers
  where business_date = target_business_date;
  if not found then
    if target_business_date = local_today then
      return public.cash_day_as_json(target_business_date, null, true);
    end if;
    return null;
  end if;
  return public.cash_day_as_json(target_business_date, register_record.id, register_record.closed_at is null);
end;
$$;

create or replace function public.list_daily_cash(
  requesting_user_id uuid, filter_date_from date, filter_date_to date,
  page_number integer, page_size integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_page_size integer := least(greatest(coalesce(page_size, 12), 1), 100);
  total_count integer; result jsonb;
begin
  if not exists (select 1 from public.users where id = requesting_user_id and role_id in (1, 2)
    and is_active and deleted_at is null) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;
  if filter_date_from is not null and filter_date_to is not null and filter_date_from > filter_date_to then
    raise exception using errcode = '22023', message = 'INVALID_CASH_DATE_RANGE';
  end if;
  perform public.close_pending_daily_cash();
  select count(*)::integer into total_count from public.daily_cash_registers cash
  where cash.closed_at is not null
    and (filter_date_from is null or cash.business_date >= filter_date_from)
    and (filter_date_to is null or cash.business_date <= filter_date_to);
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', page.id, 'businessDate', page.business_date, 'state', 'closed', 'closedAt', page.closed_at,
      'lifecycle', jsonb_build_object(
        'openingBalance', coalesce(page.opening_balance, 0), 'openingSource', page.opening_source,
        'openedAt', page.opened_at,
        'openedBy', case when opener.id is null then null else jsonb_build_object(
          'id', opener.id, 'firstName', opener.first_name, 'lastName', opener.last_name) end,
        'expectedCash', page.expected_cash, 'countedCash', page.counted_cash,
        'difference', page.difference_cash, 'closeMode', page.close_mode,
        'reconciliationState', page.reconciliation_state),
      'summary', jsonb_build_object(
        'salesGrossTotal', page.sales_gross_total, 'salesCommissionTotal', page.sales_commission_total,
        'salesBarbershopNet', page.sales_barbershop_net,
        'adjustmentGrossTotal', page.adjustment_gross_total,
        'adjustmentCommissionTotal', page.adjustment_commission_total,
        'adjustmentBarbershopNet', page.adjustment_barbershop_net,
        'grossTotal', page.sales_gross_total + page.adjustment_gross_total,
        'commissionTotal', page.sales_commission_total + page.adjustment_commission_total,
        'barbershopNet', page.sales_barbershop_net + page.adjustment_barbershop_net,
        'serviceTotal', page.service_sales_total + page.service_adjustment_total,
        'productTotal', page.product_sales_total + page.product_adjustment_total,
        'saleCount', page.sale_count, 'activeSaleCount', page.active_sale_count,
        'voidedSaleCount', page.voided_sale_count, 'adjustmentCount', page.adjustment_count)
    ) order by page.business_date desc), '[]'::jsonb),
    'pagination', jsonb_build_object('page', safe_page, 'pageSize', safe_page_size,
      'total', total_count, 'totalPages', case when total_count = 0 then 0
        else ceiling(total_count::numeric / safe_page_size)::integer end)
  ) into result
  from (select cash.* from public.daily_cash_registers cash
    where cash.closed_at is not null
      and (filter_date_from is null or cash.business_date >= filter_date_from)
      and (filter_date_to is null or cash.business_date <= filter_date_to)
    order by cash.business_date desc limit safe_page_size
    offset (safe_page - 1) * safe_page_size) page
  left join public.users opener on opener.id = page.opened_by;
  return result;
end;
$$;

create or replace function public.trg_income_open_daily_cash()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.ensure_daily_cash_open(new.registered_by, new.business_date);
  return new;
end;
$$;
drop trigger if exists trg_income_open_daily_cash on public.incomes;
create trigger trg_income_open_daily_cash after insert on public.incomes
for each row execute function public.trg_income_open_daily_cash();

revoke execute on function public.trg_income_open_daily_cash() from public, anon, authenticated;

revoke execute on function public.current_cash_expected(date, bigint) from public, anon, authenticated;
revoke execute on function public.snapshot_daily_cash(uuid, date) from public, anon, authenticated;
revoke execute on function public.ensure_daily_cash_open(uuid, date) from public, anon, authenticated;
revoke execute on function public.open_daily_cash(uuid, date, bigint) from public, anon, authenticated;
revoke execute on function public.close_daily_cash(uuid, date, bigint) from public, anon, authenticated;
revoke execute on function public.confirm_daily_cash(uuid, uuid, bigint) from public, anon, authenticated;
revoke execute on function public.close_pending_daily_cash() from public, anon, authenticated;
revoke execute on function public.capture_post_close_cash_void() from public, anon, authenticated;
revoke execute on function public.get_daily_cash(uuid, date) from public, anon, authenticated;
revoke execute on function public.list_daily_cash(uuid, date, date, integer, integer) from public, anon, authenticated;
grant execute on function public.ensure_daily_cash_open(uuid, date) to service_role;
grant execute on function public.open_daily_cash(uuid, date, bigint) to service_role;
grant execute on function public.close_daily_cash(uuid, date, bigint) to service_role;
grant execute on function public.confirm_daily_cash(uuid, uuid, bigint) to service_role;
grant execute on function public.close_pending_daily_cash() to service_role;
grant execute on function public.get_daily_cash(uuid, date) to service_role;
grant execute on function public.list_daily_cash(uuid, date, date, integer, integer) to service_role;

notify pgrst, 'reload schema';
commit;
