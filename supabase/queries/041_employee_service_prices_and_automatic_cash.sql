-- Bastardos Barberia: employee service-price overrides and automatic Caja.
-- Run after 040_production_hardening.sql as one complete migration.

begin;

-- Employees may change only the selected service price. Product-price
-- overrides remain manager-only and every override still requires a reason.
do $repair$
declare
  target_function oid;
  function_definition text;
  repaired_definition text;
  service_guard_pattern text :=
    '(if[[:space:]]+service_price_override[[:space:]]*<>[[:space:]]*''null''::jsonb[[:space:]]+then[[:space:]]+)'
    || 'if[[:space:]]+actor_record[.]role_id[[:space:]]+not[[:space:]]+in[[:space:]]*[(]1,[[:space:]]*2[)][[:space:]]+then[[:space:]]+'
    || 'raise[[:space:]]+exception[[:space:]]+using[[:space:]]+errcode[[:space:]]*=[[:space:]]*''42501'',[[:space:]]*message[[:space:]]*=[[:space:]]*''PRICE_OVERRIDE_NOT_ALLOWED_FOR_EMPLOYEE'';[[:space:]]+'
    || 'end[[:space:]]+if;[[:space:]]+';
  service_override_header_pattern text :=
    '(if[[:space:]]+service_price_override[[:space:]]*<>[[:space:]]*''null''::jsonb[[:space:]]+then)';
  service_override_target_pattern text :=
    'if[[:space:]]+selected_service_id[[:space:]]+is[[:space:]]+null[[:space:]]+then[[:space:]]+'
    || 'raise[[:space:]]+exception[[:space:]]+using[[:space:]]+errcode[[:space:]]*=[[:space:]]*''22023'',[[:space:]]*message[[:space:]]*=[[:space:]]*''INVALID_SERVICE_PRICE_OVERRIDE'';[[:space:]]+'
    || 'end[[:space:]]+if;';
  product_guard_pattern text :=
    'if[[:space:]]+product_price_overrides[[:space:]]*<>[[:space:]]*''[{][}]''::jsonb[[:space:]]+then[[:space:]]+'
    || 'if[[:space:]]+actor_record[.]role_id[[:space:]]+not[[:space:]]+in[[:space:]]*[(]1,[[:space:]]*2[)][[:space:]]+then[[:space:]]+'
    || 'raise[[:space:]]+exception[[:space:]]+using[[:space:]]+errcode[[:space:]]*=[[:space:]]*''42501'',[[:space:]]*message[[:space:]]*=[[:space:]]*''PRICE_OVERRIDE_NOT_ALLOWED_FOR_EMPLOYEE'';';
begin
  target_function := pg_catalog.to_regprocedure(
    'public.create_income(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb)'
  )::oid;

  if target_function is null then
    raise exception using
      errcode = 'P0001',
      message = 'CREATE_INCOME_EMPLOYEE_SERVICE_OVERRIDE_TARGET_MISSING';
  end if;

  select pg_catalog.pg_get_functiondef(target_function)
  into function_definition;

  if function_definition !~* 'if[[:space:]]+service_price_override'
    or function_definition !~* product_guard_pattern
  then
    raise exception using
      errcode = 'P0001',
      message = 'CREATE_INCOME_EMPLOYEE_SERVICE_OVERRIDE_TARGET_UNEXPECTED';
  end if;

  repaired_definition := pg_catalog.regexp_replace(
    function_definition,
    service_guard_pattern,
    '\1',
    'i'
  );

  if repaired_definition !~* service_override_target_pattern then
    repaired_definition := pg_catalog.regexp_replace(
      repaired_definition,
      service_override_header_pattern,
      '\1' || pg_catalog.chr(10)
        || '    if selected_service_id is null then' || pg_catalog.chr(10)
        || '      raise exception using errcode = ''22023'', message = ''INVALID_SERVICE_PRICE_OVERRIDE'';'
        || pg_catalog.chr(10) || '    end if;',
      'i'
    );
  end if;

  if repaired_definition ~* service_guard_pattern
    or repaired_definition !~* product_guard_pattern
    or repaired_definition !~* service_override_target_pattern
  then
    raise exception using
      errcode = 'P0001',
      message = 'CREATE_INCOME_EMPLOYEE_SERVICE_OVERRIDE_REPAIR_FAILED';
  end if;

  if repaired_definition <> function_definition then
    execute repaired_definition;
  end if;
end;
$repair$;

revoke execute on function public.create_income(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_income(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean, jsonb, jsonb
) to service_role;

-- Keep historical manual sources readable while marking new balance-driven
-- live rows accurately: setting a balance is not a manual Caja opening.
alter table public.daily_cash_registers
  drop constraint if exists daily_cash_opening_source_check;
alter table public.daily_cash_registers
  add constraint daily_cash_opening_source_check check (
    opening_source is null
    or opening_source in ('manual', 'first_income', 'initial_balance')
  );

create or replace function public.set_daily_cash_opening_balance(
  actor_user_id uuid,
  target_business_date date,
  new_opening_balance bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  register_record public.daily_cash_registers%rowtype;
  local_today date := (
    pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires'
  )::date;
begin
  if not exists (
    select 1
    from public.users
    where id = actor_user_id
      and role_id in (1, 2)
      and is_active
      and deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;

  if new_opening_balance is null or new_opening_balance < 0 then
    raise exception using errcode = '22023', message = 'INVALID_OPENING_BALANCE';
  end if;
  if target_business_date <> local_today then
    raise exception using errcode = '22023', message = 'INVALID_CASH_DATE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('daily-cash:' || target_business_date::text, 0)
  );

  select *
  into register_record
  from public.daily_cash_registers
  where business_date = target_business_date
  for update;

  if found then
    if register_record.closed_at is not null then
      raise exception using errcode = 'P0001', message = 'CASH_ALREADY_CLOSED';
    end if;

    update public.daily_cash_registers
    set opening_balance = new_opening_balance,
        opening_source = 'initial_balance',
        opened_at = coalesce(opened_at, pg_catalog.clock_timestamp()),
        opened_by = actor_user_id,
        expected_cash = public.current_cash_expected(
          target_business_date,
          new_opening_balance
        )
    where id = register_record.id
      and closed_at is null;
  else
    insert into public.daily_cash_registers (
      business_date,
      sales_gross_total,
      sales_commission_total,
      sales_barbershop_net,
      service_sales_total,
      product_sales_total,
      sale_count,
      active_sale_count,
      voided_sale_count,
      opening_balance,
      opening_source,
      opened_at,
      opened_by,
      close_mode,
      expected_cash,
      reconciliation_state,
      closed_at
    ) values (
      target_business_date,
      0, 0, 0, 0, 0, 0, 0, 0,
      new_opening_balance,
      'initial_balance',
      pg_catalog.clock_timestamp(),
      actor_user_id,
      null,
      new_opening_balance,
      'not_applicable',
      null
    )
    returning * into register_record;
  end if;

  return public.cash_day_as_json(target_business_date, register_record.id, true);
end;
$$;

-- The only supported manual Caja mutations are opening-balance entry and
-- post-close physical-count confirmation. Opening and closing stay automatic.
drop function if exists public.open_daily_cash(uuid, date, bigint);
drop function if exists public.close_daily_cash(uuid, date, bigint);

revoke execute on function public.set_daily_cash_opening_balance(uuid, date, bigint)
  from public, anon, authenticated;
grant execute on function public.set_daily_cash_opening_balance(uuid, date, bigint)
  to service_role;

notify pgrst, 'reload schema';

commit;
