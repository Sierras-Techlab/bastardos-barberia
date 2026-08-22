-- Bastardos Barberia: manual cash lifecycle with opening, automatic pending close
-- and confirmed counted-cash reconciliation. Run after 021_fixed_customer_monthly_payments.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Register lifecycle columns
-- ---------------------------------------------------------------------------

alter table public.daily_cash_registers
  add column if not exists opening_balance bigint not null default 0,
  add column if not exists opening_source text,
  add column if not exists opened_at timestamptz,
  add column if not exists opened_by uuid references public.users(id) on delete restrict,
  add column if not exists close_mode text,
  add column if not exists counted_cash bigint,
  add column if not exists expected_cash bigint,
  add column if not exists difference_cash bigint,
  add column if not exists reconciliation_state text not null default 'not_applicable';

-- ---------------------------------------------------------------------------
-- 2. Backfill legacy 018 registers
-- ---------------------------------------------------------------------------

update public.daily_cash_registers
set opening_balance = 0,
    opening_source = 'first_income',
    opened_at = closed_at,
    close_mode = 'automatic',
    expected_cash = sales_gross_total,
    difference_cash = 0,
    reconciliation_state = 'pending_confirmation'
where reconciliation_state = 'not_applicable';

alter table public.daily_cash_registers
  alter column opening_source set not null,
  alter column opened_at set not null,
  alter column opened_by set not null,
  alter column close_mode set not null,
  alter column expected_cash set not null,
  add constraint daily_cash_opening_balance_check check (opening_balance >= 0),
  add constraint daily_cash_opening_source_check check (opening_source in ('manual', 'first_income')),
  add constraint daily_cash_close_mode_check check (close_mode in ('manual', 'automatic')),
  add constraint daily_cash_reconciliation_state_check check (
    reconciliation_state in ('not_applicable', 'pending_confirmation', 'confirmed')
  ),
  add constraint daily_cash_count_difference_check check (
    (counted_cash is null and difference_cash is null)
    or (counted_cash is not null and difference_cash is not null and counted_cash - expected_cash = difference_cash)
  );

-- ---------------------------------------------------------------------------
-- 3. Ensure exactly one Efectivo payment method with system_code = 'cash'
-- ---------------------------------------------------------------------------

do $$
declare
  efectivo_count integer;
begin
  select count(*) into efectivo_count
    from public.payment_methods
    where normalized_name = 'efectivo' and deleted_at is null;
  if efectivo_count <> 1 then
    raise exception using errcode = 'P0001', message = 'CASH_PAYMENT_METHOD_REQUIRED';
  end if;
end;
$$;

alter table public.payment_methods
  add column if not exists system_code text;

update public.payment_methods
set system_code = 'cash'
where normalized_name = 'efectivo' and system_code is null;

create unique index if not exists payment_methods_cash_system_unique
    on public.payment_methods(system_code)
    where system_code = 'cash';

alter table public.payment_methods
  add constraint payment_methods_system_code_check check (
    system_code is null or system_code = 'cash'
  );

-- The 018 `create_payment_method`/`update_payment_method`/`delete_payment_method`
-- RPCs must reject rename/deactivate/delete of the protected Efectivo record.
-- They are replaced here with the additional guardrails.

create or replace function public.create_payment_method(
  actor_user_id uuid,
  payment_method_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text;
  new_id uuid;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null and role_name in ('owner', 'admin')
  ) then
    raise exception using errcode = '22023', message = 'FORBIDDEN';
  end if;

  normalized := lower(trim(payment_method_name));
  if normalized = 'efectivo' then
    raise exception using errcode = '22023', message = 'CASH_PAYMENT_METHOD_PROTECTED';
  end if;

  if exists (select 1 from public.payment_methods where normalized_name = normalized and deleted_at is null) then
    raise exception using errcode = '22023', message = 'PAYMENT_METHOD_NAME_EXISTS';
  end if;

  insert into public.payment_methods (name, normalized_name, is_active, system_code, created_by, updated_by)
  values (payment_method_name, normalized, true, null, actor_user_id, actor_user_id)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.update_payment_method(
  actor_user_id uuid,
  target_payment_method_id uuid,
  payment_method_name text,
  payment_method_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_name text;
  current_normalized text;
  normalized text;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null and role_name in ('owner', 'admin')
  ) then
    raise exception using errcode = '22023', message = 'FORBIDDEN';
  end if;

  select name, normalized_name into current_name, current_normalized
    from public.payment_methods
    where id = target_payment_method_id and deleted_at is null
    for update;
  if not found then
    return null;
  end if;

  if current_normalized = 'efectivo' then
    raise exception using errcode = '22023', message = 'CASH_PAYMENT_METHOD_PROTECTED';
  end if;

  if payment_method_name is null then
    normalized := current_normalized;
  else
    normalized := lower(trim(payment_method_name));
    if normalized = 'efectivo' then
      raise exception using errcode = '22023', message = 'CASH_PAYMENT_METHOD_PROTECTED';
    end if;
    if exists (
      select 1 from public.payment_methods
      where normalized_name = normalized and id <> target_payment_method_id and deleted_at is null
    ) then
      raise exception using errcode = '22023', message = 'PAYMENT_METHOD_NAME_EXISTS';
    end if;
    current_name := payment_method_name;
  end if;

  update public.payment_methods
  set name = current_name,
      normalized_name = normalized,
      is_active = coalesce(payment_method_is_active, is_active),
      updated_by = actor_user_id,
      updated_at = now()
  where id = target_payment_method_id;

  if payment_method_is_active = false and exists (
    select 1 from public.payment_methods where is_active and deleted_at is null
    having count(*) = 1
  ) then
    raise exception using errcode = '22023', message = 'LAST_ACTIVE_PAYMENT_METHOD';
  end if;

  return target_payment_method_id;
end;
$$;

create or replace function public.delete_payment_method(
  actor_user_id uuid,
  target_payment_method_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text;
  in_use boolean;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null and role_name in ('owner', 'admin')
  ) then
    raise exception using errcode = '22023', message = 'FORBIDDEN';
  end if;

  select normalized_name into normalized
    from public.payment_methods
    where id = target_payment_method_id and deleted_at is null
    for update;
  if not found then
    return null;
  end if;

  if normalized = 'efectivo' then
    raise exception using errcode = '22023', message = 'CASH_PAYMENT_METHOD_PROTECTED';
  end if;

  if exists (
    select 1 from public.income_payments where payment_method_id = target_payment_method_id
  ) then
    raise exception using errcode = '22023', message = 'PAYMENT_METHOD_IN_USE';
  end if;

  in_use := exists (
    select 1 from public.payment_methods
    where id <> target_payment_method_id and deleted_at is null and is_active
  );
  if not in_use then
    raise exception using errcode = '22023', message = 'LAST_ACTIVE_PAYMENT_METHOD';
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

-- ---------------------------------------------------------------------------
-- 4. ensure_daily_cash_open (used by both create_income and pay_fixed_customer_month)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_daily_cash_open(
  actor_user_id uuid,
  target_business_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  already_open boolean;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-cash:' || target_business_date::text, 0)
  );

  select true into already_open
    from public.daily_cash_registers
    where business_date = target_business_date;
  if already_open then
    return;
  end if;

  insert into public.daily_cash_registers (
    business_date, sales_gross_total, sales_commission_total, sales_barbershop_net,
    service_sales_total, product_sales_total,
    sale_count, active_sale_count, voided_sale_count,
    opening_balance, opening_source, opened_at, opened_by,
    close_mode, expected_cash, reconciliation_state
  ) values (
    target_business_date, 0, 0, 0,
    0, 0,
    0, 0, 0,
    0, 'first_income', now(), actor_user_id,
    'automatic', 0, 'pending_confirmation'
  ) on conflict (business_date) do nothing;
end;
$$;

revoke execute on function public.ensure_daily_cash_open(uuid, date) from public, anon, authenticated;
grant execute on function public.ensure_daily_cash_open(uuid, date) to service_role;

-- ---------------------------------------------------------------------------
-- 5. open_daily_cash, close_daily_cash, confirm_daily_cash
-- ---------------------------------------------------------------------------

create or replace function public.open_daily_cash(
  actor_user_id uuid,
  target_business_date date,
  opening_balance bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  register_id uuid;
  json jsonb;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null and role_name in ('owner', 'admin')
  ) then
    raise exception using errcode = '22023', message = 'FORBIDDEN';
  end if;
  if opening_balance < 0 then
    raise exception using errcode = '22023', message = 'INVALID_OPENING_BALANCE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-cash:' || target_business_date::text, 0)
  );

  select id into register_id
    from public.daily_cash_registers
    where business_date = target_business_date
    for update;
  if found then
    raise exception using errcode = 'P0001', message = 'CASH_ALREADY_OPEN';
  end if;

  insert into public.daily_cash_registers (
    business_date, sales_gross_total, sales_commission_total, sales_barbershop_net,
    service_sales_total, product_sales_total,
    sale_count, active_sale_count, voided_sale_count,
    opening_balance, opening_source, opened_at, opened_by,
    close_mode, expected_cash, reconciliation_state
  ) values (
    target_business_date, 0, 0, 0,
    0, 0,
    0, 0, 0,
    opening_balance, 'manual', now(), actor_user_id,
    'automatic', opening_balance, 'pending_confirmation'
  ) returning id into register_id;

  json := public.cash_day_as_json(register_id);
  return json;
end;
$$;

revoke execute on function public.open_daily_cash(uuid, date, bigint) from public, anon, authenticated;
grant execute on function public.open_daily_cash(uuid, date, bigint) to service_role;

create or replace function public.close_daily_cash(
  actor_user_id uuid,
  target_business_date date,
  counted_cash bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  register_id uuid;
  expected_value bigint;
  diff_value bigint;
  json jsonb;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null and role_name in ('owner', 'admin')
  ) then
    raise exception using errcode = '22023', message = 'FORBIDDEN';
  end if;
  if counted_cash < 0 then
    raise exception using errcode = '22023', message = 'INVALID_COUNTED_CASH';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-cash:' || target_business_date::text, 0)
  );

  select id, expected_cash into register_id, expected_value
    from public.daily_cash_registers
    where business_date = target_business_date
    for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CASH_NOT_OPEN';
  end if;

  diff_value := counted_cash - expected_value;

  if diff_value = 0 then
    update public.daily_cash_registers
    set counted_cash = counted_cash,
        difference_cash = diff_value,
        reconciliation_state = 'confirmed',
        close_mode = coalesce(close_mode, 'automatic'),
        closed_at = coalesce(closed_at, now())
    where id = register_id;
  else
    update public.daily_cash_registers
    set counted_cash = counted_cash,
        difference_cash = diff_value
    where id = register_id;
  end if;

  json := public.cash_day_as_json(register_id);
  return json;
end;
$$;

revoke execute on function public.close_daily_cash(uuid, date, bigint) from public, anon, authenticated;
grant execute on function public.close_daily_cash(uuid, date, bigint) to service_role;

create or replace function public.confirm_daily_cash(
  actor_user_id uuid,
  target_register_id uuid,
  counted_cash bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_value bigint;
  diff_value bigint;
  json jsonb;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null and role_name in ('owner', 'admin')
  ) then
    raise exception using errcode = '22023', message = 'FORBIDDEN';
  end if;
  if counted_cash < 0 then
    raise exception using errcode = '22023', message = 'INVALID_COUNTED_CASH';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-cash:' || (
      select business_date from public.daily_cash_registers where id = target_register_id
    )::text, 0)
  );

  select expected_cash into expected_value
    from public.daily_cash_registers
    where id = target_register_id
    for update;
  if not found then
    return null;
  end if;
  if (select reconciliation_state from public.daily_cash_registers where id = target_register_id) = 'confirmed' then
    raise exception using errcode = 'P0001', message = 'CASH_ALREADY_CONFIRMED';
  end if;

  diff_value := counted_cash - expected_value;

  update public.daily_cash_registers
  set counted_cash = counted_cash,
      difference_cash = diff_value,
      reconciliation_state = 'confirmed'
  where id = target_register_id;

  json := public.cash_day_as_json(target_register_id);
  return json;
end;
$$;

revoke execute on function public.confirm_daily_cash(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.confirm_daily_cash(uuid, uuid, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Promoted cash_day_as_json with lifecycle block
-- ---------------------------------------------------------------------------

create or replace function public.cash_day_as_json(target_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', r.id,
    'businessDate', r.business_date,
    'state', case when r.closed_at is null then 'live' else 'closed' end,
    'closedAt', r.closed_at,
    'lifecycle', jsonb_build_object(
      'openingBalance', r.opening_balance,
      'openingSource', r.opening_source,
      'openedAt', r.opened_at,
      'openedBy', case when u.id is null then null
        else jsonb_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name) end,
      'expectedCash', coalesce(r.expected_cash, r.sales_gross_total + r.opening_balance),
      'countedCash', r.counted_cash,
      'difference', r.difference_cash,
      'closeMode', r.close_mode,
      'reconciliationState', r.reconciliation_state
    ),
    'summary', jsonb_build_object(
      'salesGrossTotal', r.sales_gross_total,
      'salesCommissionTotal', r.sales_commission_total,
      'salesBarbershopNet', r.sales_barbershop_net,
      'adjustmentGrossTotal', r.adjustment_gross_total,
      'adjustmentCommissionTotal', r.adjustment_commission_total,
      'adjustmentBarbershopNet', r.adjustment_barbershop_net,
      'grossTotal', r.sales_gross_total + r.adjustment_gross_total,
      'commissionTotal', r.sales_commission_total + r.adjustment_commission_total,
      'barbershopNet', r.sales_barbershop_net + r.adjustment_barbershop_net,
      'serviceTotal', r.service_sales_total + r.service_adjustment_total,
      'productTotal', r.product_sales_total + r.product_adjustment_total,
      'saleCount', r.sale_count,
      'activeSaleCount', r.active_sale_count,
      'voidedSaleCount', r.voided_sale_count,
      'adjustmentCount', r.adjustment_count
    ),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'paymentMethodId', pm.id,
        'name', pm.name,
        'salesAmount', coalesce(sum(case when s.status = 'active' then ip.amount else 0 end), 0),
        'adjustmentAmount', coalesce(sum(case when s.status = 'voided' then -ip.amount else 0 end), 0),
        'netAmount', coalesce(sum(case when s.status = 'active' then ip.amount else -ip.amount end), 0)
      ) order by pm.name)
      from public.daily_cash_payment_totals pt
      join public.payment_methods pm on pm.id = pt.payment_method_id
      left join public.daily_cash_sales dcs on dcs.cash_register_id = r.id and dcs.payment_method_id = pt.payment_method_id
      left join public.income_payments ip on ip.payment_method_id = pt.payment_method_id
      left join public.incomes s on s.id = ip.income_id
      where pt.cash_register_id = r.id
      group by pm.id, pm.name
    ), '[]'::jsonb),
    'sales', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', dcs.income_id,
        'createdAt', dcs.created_at,
        'employee', jsonb_build_object('id', emp.id, 'firstName', emp.first_name, 'lastName', emp.last_name),
        'customerName', dcs.customer_name,
        'kind', dcs.kind,
        'statusAtClose', dcs.status_at_close,
        'currentStatus', dcs.current_status,
        'grossTotal', dcs.gross_total,
        'commissionTotal', dcs.commission_total,
        'barbershopNet', dcs.barbershop_net
      ) order by dcs.created_at)
      from public.daily_cash_sales dcs
      join public.users emp on emp.id = dcs.employee_id
      where dcs.cash_register_id = r.id
    ), '[]'::jsonb),
    'adjustments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', dca.id,
        'sourceIncomeId', dca.source_income_id,
        'originalBusinessDate', dca.original_business_date,
        'createdAt', dca.created_at,
        'createdBy', jsonb_build_object('id', creator.id, 'firstName', creator.first_name, 'lastName', creator.last_name),
        'grossDelta', dca.gross_delta,
        'commissionDelta', dca.commission_delta,
        'barbershopNetDelta', dca.barbershop_net_delta
      ) order by dca.created_at)
      from public.daily_cash_adjustments dca
      join public.users creator on creator.id = dca.created_by
      where dca.cash_register_id = r.id
    ), '[]'::jsonb)
  ) into result
  from public.daily_cash_registers r
  left join public.users u on u.id = r.opened_by
  where r.id = target_id;

  return result;
end;
$$;

revoke execute on function public.cash_day_as_json(uuid) from public, anon, authenticated;
grant execute on function public.cash_day_as_json(uuid) to service_role;

notify pgrst, 'reload schema';

commit;