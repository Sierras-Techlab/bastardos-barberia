-- Bastardos Barberia: manual cash opening, closing and reconciliation.
-- Run after 021_fixed_customer_monthly_payments.sql.

begin;

alter table public.daily_cash_registers
  alter column closed_at drop not null,
  alter column closed_at drop default,
  add column if not exists opening_balance bigint not null default 0,
  add column if not exists opening_source text,
  add column if not exists opened_at timestamptz,
  add column if not exists opened_by uuid references public.users(id) on delete restrict,
  add column if not exists close_mode text,
  add column if not exists counted_cash bigint,
  add column if not exists expected_cash bigint not null default 0,
  add column if not exists difference_cash bigint,
  add column if not exists reconciliation_state text not null default 'not_applicable';

update public.daily_cash_registers r
set opening_balance = 0,
    opening_source = 'first_income',
    opened_at = r.closed_at,
    close_mode = 'automatic',
    expected_cash = coalesce((
      select p.net_amount
      from public.daily_cash_payment_totals p
      join public.payment_methods pm on pm.id = p.payment_method_id
      where p.daily_cash_id = r.id and pm.normalized_name = 'efectivo'
    ), 0),
    counted_cash = null,
    difference_cash = null,
    reconciliation_state = 'pending_confirmation'
where r.closed_at is not null and r.reconciliation_state = 'not_applicable';

alter table public.daily_cash_registers
  drop constraint if exists daily_cash_counts_check,
  drop constraint if exists daily_cash_opening_balance_check,
  drop constraint if exists daily_cash_opening_source_check,
  drop constraint if exists daily_cash_close_mode_check,
  drop constraint if exists daily_cash_reconciliation_state_check,
  drop constraint if exists daily_cash_count_difference_check;

alter table public.daily_cash_registers
  add constraint daily_cash_counts_check check (
    sale_count >= 0 and active_sale_count >= 0 and voided_sale_count >= 0
    and active_sale_count + voided_sale_count = sale_count
    and adjustment_count >= 0
    and (closed_at is null or sale_count + adjustment_count > 0 or opening_source = 'manual')
  ),
  add constraint daily_cash_opening_balance_check check (opening_balance >= 0),
  add constraint daily_cash_opening_source_check check (
    opening_source is null or opening_source in ('manual', 'first_income')
  ),
  add constraint daily_cash_close_mode_check check (
    close_mode is null or close_mode in ('manual', 'automatic')
  ),
  add constraint daily_cash_reconciliation_state_check check (
    reconciliation_state in ('not_applicable', 'pending_confirmation', 'confirmed')
  ),
  add constraint daily_cash_count_difference_check check (
    (counted_cash is null and difference_cash is null)
    or (counted_cash is not null and difference_cash is not null
      and counted_cash - expected_cash = difference_cash)
  );

-- Efectivo is the single physical-cash method. Payment methods are physically
-- deleted only while unused, so this table deliberately has no deleted_at.
do $$
begin
  if (select count(*) from public.payment_methods where normalized_name = 'efectivo') <> 1 then
    raise exception using errcode = 'P0001', message = 'CASH_PAYMENT_METHOD_REQUIRED';
  end if;
end;
$$;

alter table public.payment_methods add column if not exists system_code text;
update public.payment_methods set system_code = 'cash'
where normalized_name = 'efectivo' and system_code is null;
create unique index if not exists payment_methods_cash_system_unique
  on public.payment_methods(system_code) where system_code = 'cash';
alter table public.payment_methods
  drop constraint if exists payment_methods_system_code_check,
  add constraint payment_methods_system_code_check check (system_code is null or system_code = 'cash');

create or replace function public.create_payment_method(actor_user_id uuid, payment_method_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare normalized text; created_id uuid;
begin
  if not exists (select 1 from public.users where id = actor_user_id and role_id in (1,2) and is_active and deleted_at is null) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;
  normalized := public.normalize_catalog_name(payment_method_name);
  if normalized = 'efectivo' then raise exception using errcode = '22023', message = 'CASH_PAYMENT_METHOD_PROTECTED'; end if;
  if exists (select 1 from public.payment_methods where normalized_name = normalized) then
    raise exception using errcode = '23505', message = 'PAYMENT_METHOD_NAME_EXISTS';
  end if;
  insert into public.payment_methods(name, normalized_name, is_active, system_code, created_by, updated_by)
  values (trim(payment_method_name), normalized, true, null, actor_user_id, actor_user_id)
  returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.update_payment_method(
  actor_user_id uuid, target_payment_method_id uuid,
  payment_method_name text, payment_method_is_active boolean
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_record record; normalized text;
begin
  if not exists (select 1 from public.users where id = actor_user_id and role_id in (1,2) and is_active and deleted_at is null) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;
  select * into current_record from public.payment_methods where id = target_payment_method_id for update;
  if not found then return null; end if;
  if current_record.system_code = 'cash' then
    if payment_method_name is not null or payment_method_is_active = false then
      raise exception using errcode = '22023', message = 'CASH_PAYMENT_METHOD_PROTECTED';
    end if;
    return target_payment_method_id;
  end if;
  if payment_method_name is not null then
    normalized := public.normalize_catalog_name(payment_method_name);
    if normalized = 'efectivo' then raise exception using errcode = '22023', message = 'CASH_PAYMENT_METHOD_PROTECTED'; end if;
    if exists (select 1 from public.payment_methods where normalized_name = normalized and id <> target_payment_method_id) then
      raise exception using errcode = '23505', message = 'PAYMENT_METHOD_NAME_EXISTS';
    end if;
  end if;
  if payment_method_is_active = false and current_record.is_active
    and not exists (select 1 from public.payment_methods where id <> target_payment_method_id and is_active) then
    raise exception using errcode = '22023', message = 'LAST_ACTIVE_PAYMENT_METHOD';
  end if;
  update public.payment_methods set
    name = case when payment_method_name is null then name else trim(payment_method_name) end,
    normalized_name = coalesce(normalized, normalized_name),
    is_active = coalesce(payment_method_is_active, is_active),
    updated_by = actor_user_id, updated_at = pg_catalog.clock_timestamp()
  where id = target_payment_method_id;
  return target_payment_method_id;
end;
$$;

create or replace function public.delete_payment_method(actor_user_id uuid, target_payment_method_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_record record;
begin
  if not exists (select 1 from public.users where id = actor_user_id and role_id in (1,2) and is_active and deleted_at is null) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;
  select * into current_record from public.payment_methods where id = target_payment_method_id for update;
  if not found then return null; end if;
  if current_record.system_code = 'cash' then raise exception using errcode = '22023', message = 'CASH_PAYMENT_METHOD_PROTECTED'; end if;
  if exists (select 1 from public.income_payments where payment_method_id = target_payment_method_id) then
    raise exception using errcode = '23503', message = 'PAYMENT_METHOD_IN_USE';
  end if;
  if current_record.is_active and not exists (select 1 from public.payment_methods where id <> target_payment_method_id and is_active) then
    raise exception using errcode = '22023', message = 'LAST_ACTIVE_PAYMENT_METHOD';
  end if;
  delete from public.payment_methods where id = target_payment_method_id;
  return target_payment_method_id;
end;
$$;

create or replace function public.ensure_daily_cash_open(actor_user_id uuid, target_business_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare existing_close timestamptz;
begin
  if not exists (select 1 from public.users where id = actor_user_id and is_active and deleted_at is null) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('daily-cash:' || target_business_date::text, 0));
  select closed_at into existing_close from public.daily_cash_registers where business_date = target_business_date for update;
  if found then
    if existing_close is not null then raise exception using errcode = 'P0001', message = 'CASH_ALREADY_CLOSED'; end if;
    return;
  end if;
  insert into public.daily_cash_registers(
    business_date, sales_gross_total, sales_commission_total, sales_barbershop_net,
    service_sales_total, product_sales_total, sale_count, active_sale_count, voided_sale_count,
    opening_balance, opening_source, opened_at, opened_by, expected_cash, reconciliation_state, closed_at
  ) values (
    target_business_date, 0,0,0,0,0,0,0,0,
    0, 'first_income', pg_catalog.clock_timestamp(), actor_user_id, 0, 'not_applicable', null
  ) on conflict (business_date) do nothing;
end;
$$;

create or replace function public.open_cash_from_income()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.ensure_daily_cash_open(new.registered_by, new.business_date);
  return new;
end;
$$;
drop trigger if exists incomes_open_daily_cash on public.incomes;
create trigger incomes_open_daily_cash after insert on public.incomes
for each row execute function public.open_cash_from_income();

create or replace function public.snapshot_daily_cash(
  target_register_id uuid, target_business_date date, requested_close_mode text, declared_counted_cash bigint
)
returns void language plpgsql security definer set search_path = '' as $$
declare expected_value bigint; opening_value bigint;
begin
  select opening_balance into opening_value from public.daily_cash_registers
  where id = target_register_id and closed_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'CASH_NOT_OPEN'; end if;

  select opening_value + coalesce(sum(movement.amount), 0) into expected_value
  from (
    select ip.amount::bigint as amount
    from public.income_payments ip join public.incomes i on i.id = ip.income_id
    join public.payment_methods pm on pm.id = ip.payment_method_id and pm.system_code = 'cash'
    where i.business_date = target_business_date and i.status = 'active'
    union all
    select ap.amount from public.daily_cash_adjustment_payments ap
    join public.daily_cash_adjustments a on a.id = ap.adjustment_id
    join public.payment_methods pm on pm.id = ap.payment_method_id and pm.system_code = 'cash'
    where a.business_date = target_business_date
  ) movement;

  update public.daily_cash_registers r set
    sales_gross_total = totals.gross, sales_commission_total = totals.commission,
    sales_barbershop_net = totals.net, service_sales_total = totals.service,
    product_sales_total = totals.product, sale_count = totals.sale_count,
    active_sale_count = totals.active_count, voided_sale_count = totals.voided_count,
    closed_at = pg_catalog.clock_timestamp(), close_mode = requested_close_mode,
    expected_cash = expected_value, counted_cash = declared_counted_cash,
    difference_cash = case when declared_counted_cash is null then null else declared_counted_cash - expected_value end,
    reconciliation_state = case when declared_counted_cash is null then 'pending_confirmation' else 'confirmed' end
  from (
    select coalesce(sum(total) filter(where status='active'),0)::bigint gross,
      coalesce(sum(commission_total) filter(where status='active'),0)::bigint commission,
      coalesce(sum(barbershop_net) filter(where status='active'),0)::bigint net,
      coalesce(sum(service_commission_base) filter(where status='active'),0)::bigint service,
      coalesce(sum(product_commission_base) filter(where status='active'),0)::bigint product,
      count(*)::integer sale_count,
      (count(*) filter(where status='active'))::integer active_count,
      (count(*) filter(where status='voided'))::integer voided_count
    from public.incomes where business_date = target_business_date
  ) totals where r.id = target_register_id;

  insert into public.daily_cash_sales(
    daily_cash_id, income_id, employee_id, employee_first_name_snapshot, employee_last_name_snapshot,
    customer_name_snapshot, kind, status_at_close, gross_total, commission_total, barbershop_net,
    service_total, product_total, created_at_snapshot
  )
  select target_register_id, i.id, u.id, u.first_name, u.last_name,
    case when c.id is null then null else trim(c.first_name || ' ' || c.last_name) end,
    case when i.source_type = 'fixed_subscription' then 'subscription'
      when i.service_commission_base > 0 and i.product_commission_base > 0 then 'combined'
      when i.service_commission_base > 0 then 'service' else 'products' end,
    i.status, i.total, i.commission_total, i.barbershop_net,
    i.service_commission_base, i.product_commission_base, i.created_at
  from public.incomes i join public.users u on u.id=i.employee_id
  left join public.customers c on c.id=i.customer_id
  where i.business_date=target_business_date;

  insert into public.daily_cash_payment_totals(
    daily_cash_id, payment_method_id, method_name_snapshot, sales_amount, adjustment_amount
  )
  select target_register_id, movement.payment_method_id, movement.method_name_snapshot,
    sum(movement.sales_amount), sum(movement.adjustment_amount)
  from (
    select ip.payment_method_id, ip.method_name_snapshot, ip.amount::bigint sales_amount, 0::bigint adjustment_amount
    from public.income_payments ip join public.incomes i on i.id=ip.income_id
    where i.business_date=target_business_date and i.status='active'
    union all
    select ap.payment_method_id, ap.method_name_snapshot, 0::bigint, ap.amount
    from public.daily_cash_adjustment_payments ap join public.daily_cash_adjustments a on a.id=ap.adjustment_id
    where a.business_date=target_business_date
  ) movement group by movement.payment_method_id, movement.method_name_snapshot;
end;
$$;

alter table public.daily_cash_sales drop constraint if exists daily_cash_sales_kind_check;
alter table public.daily_cash_sales add constraint daily_cash_sales_kind_check
  check (kind in ('service','products','combined','subscription'));

create or replace function public.open_daily_cash(actor_user_id uuid, target_business_date date, opening_balance bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare register_id uuid; local_today date := (pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not exists(select 1 from public.users where id=actor_user_id and role_id in(1,2) and is_active and deleted_at is null) then
    raise exception using errcode='42501', message='MANAGER_REQUIRED';
  end if;
  if opening_balance < 0 then raise exception using errcode='22023', message='INVALID_OPENING_BALANCE'; end if;
  if target_business_date <> local_today then raise exception using errcode='22023', message='INVALID_CASH_DATE'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('daily-cash:'||target_business_date::text,0));
  if exists(select 1 from public.daily_cash_registers where business_date=target_business_date) then
    raise exception using errcode='P0001', message='CASH_ALREADY_OPEN';
  end if;
  insert into public.daily_cash_registers(
    business_date,sales_gross_total,sales_commission_total,sales_barbershop_net,
    service_sales_total,product_sales_total,sale_count,active_sale_count,voided_sale_count,
    opening_balance,opening_source,opened_at,opened_by,expected_cash,reconciliation_state,closed_at
  ) values(target_business_date,0,0,0,0,0,0,0,0,opening_balance,'manual',pg_catalog.clock_timestamp(),actor_user_id,opening_balance,'not_applicable',null)
  returning id into register_id;
  return public.cash_day_as_json(target_business_date,register_id,true);
end;
$$;

create or replace function public.close_daily_cash(actor_user_id uuid, target_business_date date, counted_cash bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare register_id uuid;
begin
  if not exists(select 1 from public.users where id=actor_user_id and role_id in(1,2) and is_active and deleted_at is null) then
    raise exception using errcode='42501', message='MANAGER_REQUIRED';
  end if;
  if counted_cash < 0 then raise exception using errcode='22023', message='INVALID_COUNTED_CASH'; end if;
  select id into register_id from public.daily_cash_registers where business_date=target_business_date and closed_at is null;
  if not found then raise exception using errcode='P0001', message='CASH_NOT_OPEN'; end if;
  perform public.snapshot_daily_cash(register_id,target_business_date,'manual',$3);
  return public.cash_day_as_json(target_business_date,register_id,false);
end;
$$;

create or replace function public.confirm_daily_cash(actor_user_id uuid, target_register_id uuid, counted_cash bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target_date date; expected_value bigint;
begin
  if not exists(select 1 from public.users where id=actor_user_id and role_id in(1,2) and is_active and deleted_at is null) then
    raise exception using errcode='42501', message='MANAGER_REQUIRED';
  end if;
  if counted_cash < 0 then raise exception using errcode='22023', message='INVALID_COUNTED_CASH'; end if;
  select business_date,expected_cash into target_date,expected_value from public.daily_cash_registers
  where id=target_register_id and closed_at is not null for update;
  if not found then return null; end if;
  if (select reconciliation_state from public.daily_cash_registers where id=target_register_id)='confirmed' then
    raise exception using errcode='P0001', message='CASH_ALREADY_CONFIRMED';
  end if;
  update public.daily_cash_registers set counted_cash=$3,difference_cash=$3-expected_value,
    reconciliation_state='confirmed' where id=target_register_id;
  return public.cash_day_as_json(target_date,target_register_id,false);
end;
$$;

create or replace function public.close_pending_daily_cash()
returns integer language plpgsql security definer set search_path = '' as $$
declare local_today date := (pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
  target_date date; register_id uuid; created_count integer:=0; first_actor uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bastardos_daily_cash_close'));
  for target_date in
    select candidate.business_date from (
      select business_date from public.incomes where business_date < local_today
      union select business_date from public.daily_cash_adjustments where business_date < local_today
      union select business_date from public.daily_cash_registers where business_date < local_today and closed_at is null
    ) candidate order by candidate.business_date
  loop
    select id into register_id from public.daily_cash_registers where business_date=target_date for update;
    if found and (select closed_at from public.daily_cash_registers where id=register_id) is not null then continue; end if;
    if not found then
      select registered_by into first_actor from public.incomes where business_date=target_date order by created_at limit 1;
      insert into public.daily_cash_registers(
        business_date,sales_gross_total,sales_commission_total,sales_barbershop_net,
        service_sales_total,product_sales_total,sale_count,active_sale_count,voided_sale_count,
        opening_balance,opening_source,opened_at,opened_by,expected_cash,reconciliation_state,closed_at
      ) values(target_date,0,0,0,0,0,0,0,0,0,'first_income',pg_catalog.clock_timestamp(),first_actor,0,'not_applicable',null)
      returning id into register_id;
    end if;
    perform public.snapshot_daily_cash(register_id,target_date,'automatic',null);
    created_count:=created_count+1;
  end loop;
  return created_count;
end;
$$;

-- Preserve the proven live/closed projection from 018 and add lifecycle data.
alter function public.cash_day_as_json(date,uuid,boolean) rename to cash_day_base_as_json;
create or replace function public.cash_day_as_json(target_business_date date,target_cash_id uuid,is_live boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare base jsonb; register_record record; expected_value bigint; opened_by_json jsonb;
begin
  base:=public.cash_day_base_as_json(target_business_date,target_cash_id,is_live);
  select * into register_record from public.daily_cash_registers
  where id=target_cash_id or (target_cash_id is null and business_date=target_business_date) limit 1;
  if register_record.id is null then
    return base || jsonb_build_object('lifecycle',jsonb_build_object(
      'openingBalance',0,'openingSource',null,'openedAt',null,'openedBy',null,
      'expectedCash',0,'countedCash',null,'difference',null,'closeMode',null,'reconciliationState','not_applicable'));
  end if;
  if is_live then
    select register_record.opening_balance + coalesce(sum(ip.amount),0) into expected_value
    from public.income_payments ip join public.incomes i on i.id=ip.income_id
    join public.payment_methods pm on pm.id=ip.payment_method_id and pm.system_code='cash'
    where i.business_date=target_business_date and i.status='active';
  else expected_value:=register_record.expected_cash; end if;
  select case when u.id is null then null else jsonb_build_object('id',u.id,'firstName',u.first_name,'lastName',u.last_name) end
  into opened_by_json from (select 1) seed left join public.users u on u.id=register_record.opened_by;
  return base || jsonb_build_object('lifecycle',jsonb_build_object(
    'openingBalance',register_record.opening_balance,'openingSource',register_record.opening_source,
    'openedAt',register_record.opened_at,'openedBy',opened_by_json,'expectedCash',expected_value,
    'countedCash',register_record.counted_cash,'difference',register_record.difference_cash,
    'closeMode',register_record.close_mode,'reconciliationState',register_record.reconciliation_state));
end;
$$;

create or replace function public.get_daily_cash(requesting_user_id uuid,target_business_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare local_today date := (pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
  register_id uuid; register_closed_at timestamptz;
begin
  if not exists(select 1 from public.users where id=requesting_user_id and role_id in(1,2) and is_active and deleted_at is null) then
    raise exception using errcode='42501',message='MANAGER_REQUIRED';
  end if;
  if target_business_date is null or target_business_date>local_today then raise exception using errcode='22023',message='INVALID_CASH_DATE'; end if;
  perform public.close_pending_daily_cash();
  select id,closed_at into register_id,register_closed_at from public.daily_cash_registers where business_date=target_business_date;
  if register_id is null and target_business_date<local_today then return null; end if;
  return public.cash_day_as_json(target_business_date,register_id,register_closed_at is null);
end;
$$;

create or replace function public.list_daily_cash(
  requesting_user_id uuid,filter_date_from date,filter_date_to date,page_number integer,page_size integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare safe_page integer:=greatest(coalesce(page_number,1),1); safe_size integer:=least(greatest(coalesce(page_size,12),1),100);
  total_count integer; result jsonb;
begin
  if not exists(select 1 from public.users where id=requesting_user_id and role_id in(1,2) and is_active and deleted_at is null) then
    raise exception using errcode='42501',message='MANAGER_REQUIRED';
  end if;
  if filter_date_from is not null and filter_date_to is not null and filter_date_from>filter_date_to then
    raise exception using errcode='22023',message='INVALID_CASH_DATE_RANGE';
  end if;
  perform public.close_pending_daily_cash();
  select count(*)::integer into total_count from public.daily_cash_registers r where r.closed_at is not null
    and (filter_date_from is null or r.business_date>=filter_date_from)
    and (filter_date_to is null or r.business_date<=filter_date_to);
  select jsonb_build_object('items',coalesce(jsonb_agg(public.cash_day_as_json(page.business_date,page.id,false) order by page.business_date desc),'[]'::jsonb),
    'pagination',jsonb_build_object('page',safe_page,'pageSize',safe_size,'total',total_count,
      'totalPages',case when total_count=0 then 0 else ceiling(total_count::numeric/safe_size)::integer end)) into result
  from (select r.id,r.business_date from public.daily_cash_registers r where r.closed_at is not null
    and (filter_date_from is null or r.business_date>=filter_date_from)
    and (filter_date_to is null or r.business_date<=filter_date_to)
    order by r.business_date desc offset((safe_page-1)*safe_size) limit safe_size) page;
  return result;
end;
$$;

revoke execute on function public.create_payment_method(uuid,text) from public,anon,authenticated;
revoke execute on function public.update_payment_method(uuid,uuid,text,boolean) from public,anon,authenticated;
revoke execute on function public.delete_payment_method(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.ensure_daily_cash_open(uuid,date) from public,anon,authenticated;
revoke execute on function public.open_cash_from_income() from public,anon,authenticated,service_role;
revoke execute on function public.snapshot_daily_cash(uuid,date,text,bigint) from public,anon,authenticated,service_role;
revoke execute on function public.open_daily_cash(uuid,date,bigint) from public,anon,authenticated;
revoke execute on function public.close_daily_cash(uuid,date,bigint) from public,anon,authenticated;
revoke execute on function public.confirm_daily_cash(uuid,uuid,bigint) from public,anon,authenticated;
revoke execute on function public.cash_day_base_as_json(date,uuid,boolean) from public,anon,authenticated,service_role;
revoke execute on function public.cash_day_as_json(date,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.create_payment_method(uuid,text) to service_role;
grant execute on function public.update_payment_method(uuid,uuid,text,boolean) to service_role;
grant execute on function public.delete_payment_method(uuid,uuid) to service_role;
grant execute on function public.open_daily_cash(uuid,date,bigint) to service_role;
grant execute on function public.close_daily_cash(uuid,date,bigint) to service_role;
grant execute on function public.confirm_daily_cash(uuid,uuid,bigint) to service_role;
grant execute on function public.get_daily_cash(uuid,date) to service_role;
grant execute on function public.list_daily_cash(uuid,date,date,integer,integer) to service_role;

notify pgrst,'reload schema';
commit;
