-- Bastardos Barberia: make manual and automatic closure use the charged-price
-- snapshot helper installed by 035, then remove the obsolete catalog-base helper.
-- Run after 037_remove_legacy_income_overloads.sql.

begin;

alter table public.daily_cash_sales
  drop constraint if exists daily_cash_sales_economics_check;
alter table public.daily_cash_sales
  add constraint daily_cash_sales_economics_check check (
    gross_total >= 0 and commission_total >= 0 and barbershop_net >= 0
    and commission_total + barbershop_net = gross_total
    and service_total >= 0 and product_total >= 0
    and service_total + product_total = gross_total
  );

create or replace function public.current_cash_expected(
  target_business_date date, target_opening_balance bigint
)
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

drop function if exists public.snapshot_daily_cash(uuid, date, text, bigint);

revoke execute on function public.snapshot_daily_cash(uuid, date) from public, anon, authenticated;
revoke execute on function public.current_cash_expected(date, bigint) from public, anon, authenticated;
revoke execute on function public.close_pending_daily_cash() from public, anon, authenticated;
revoke execute on function public.close_daily_cash(uuid, date, bigint) from public, anon, authenticated;
grant execute on function public.close_daily_cash(uuid, date, bigint) to service_role;

notify pgrst, 'reload schema';

commit;
