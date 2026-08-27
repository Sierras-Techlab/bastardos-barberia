-- Bastardos Barberia: final production hardening after the Reports migration 039
-- lineage. Reconciles subscription visit semantics, live Caja and employee
-- fixed-customer authorization with the current canonical migrations.
-- Run after 039_business_reports.sql.

begin;

-- The normalized income_payments rows replaced this legacy discriminator in
-- 010. Removing its old two-value check also makes subscriptions compatible
-- with databases that retained the original 009 constraint.
alter table public.incomes
  drop constraint if exists incomes_payment_method_check;

create or replace function public.list_customer_visits(
  actor_user_id uuid,
  target_customer_id uuid,
  page_number integer,
  page_size integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_page_size integer := least(greatest(coalesce(page_size, 20), 1), 100);
  result jsonb;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  if not exists (
    select 1 from public.customers
    where id = target_customer_id and deleted_at is null
  ) then
    return null;
  end if;

  with visits as materialized (
    select i.id, i.created_at, i.business_date, i.total
    from public.incomes i
    where i.customer_id = target_customer_id
      and i.status = 'active'
      and i.source_type = 'sale'
  ), page_rows as (
    select * from visits
    order by created_at desc, id desc
    offset ((safe_page - 1) * safe_page_size)
    limit safe_page_size
  ), totals as (
    select count(*)::integer as total from visits
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'occurredAt', p.created_at,
        'businessDate', p.business_date,
        'totalSpent', p.total,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'type', ii.item_type,
            'name', ii.name_snapshot,
            'quantity', ii.quantity,
            'unitPrice', ii.unit_price,
            'subtotal', ii.unit_price * ii.quantity
          ) order by ii.created_at, ii.id)
          from public.income_items ii where ii.income_id = p.id
        ), '[]'::jsonb)
      ) order by p.created_at desc, p.id desc)
      from page_rows p
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', safe_page,
      'pageSize', safe_page_size,
      'total', totals.total,
      'totalPages', case when totals.total = 0 then 0
        else ceiling(totals.total::numeric / safe_page_size)::integer end
    )
  ) into result
  from totals;
  return result;
end;
$$;

create or replace function public.void_income(
  target_income_id uuid,
  actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  income_record record;
  product_record record;
  void_time timestamptz := pg_catalog.clock_timestamp();
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id
      and role_id in (1, 2)
      and is_active
      and deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;

  select id, customer_id, status, source_type into income_record
  from public.incomes
  where id = target_income_id
  for update;

  if not found then
    return null;
  end if;
  if income_record.status = 'voided' then
    return income_record.id;
  end if;

  for product_record in
    select p.id, p.stock, ii.quantity
    from public.products p
    join public.income_items ii
      on ii.product_id = p.id and ii.income_id = income_record.id
    where ii.item_type = 'product'
    order by p.id
    for update of p
  loop
    update public.products
    set stock = product_record.stock + product_record.quantity,
        updated_by = actor_user_id
    where id = product_record.id;

    insert into public.inventory_movements (
      product_id, movement_type, quantity_delta, stock_after, user_id, income_id, created_at
    ) values (
      product_record.id, 'sale_void', product_record.quantity,
      product_record.stock + product_record.quantity, actor_user_id,
      income_record.id, void_time
    );
  end loop;

  if income_record.source_type = 'sale' and income_record.customer_id is not null then
    update public.customers
    set visits = greatest(visits - 1, 0), updated_by = actor_user_id
    where id = income_record.customer_id;
  end if;

  update public.incomes
  set status = 'voided', voided_at = void_time, voided_by = actor_user_id
  where id = income_record.id;

  return income_record.id;
end;
$$;

create or replace function public.cash_day_as_json(
  target_business_date date,
  target_cash_id uuid,
  is_live boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base jsonb;
  register_record record;
  expected_value bigint;
  opened_by_json jsonb;
  charged_service_total bigint;
  charged_product_total bigint;
  normalized_sales jsonb;
begin
  if pg_catalog.to_regprocedure('public.cash_financial_day_as_json(date,uuid,boolean)') is not null then
    execute 'select public.cash_financial_day_as_json($1,$2,$3)'
      into base using target_business_date, target_cash_id, is_live;
  elsif pg_catalog.to_regprocedure('public.cash_day_base_as_json(date,uuid,boolean)') is not null then
    execute 'select public.cash_day_base_as_json($1,$2,$3)'
      into base using target_business_date, target_cash_id, is_live;
  else
    raise exception using errcode = 'P0001', message = 'CASH_FINANCIAL_PROJECTION_MISSING';
  end if;

  if is_live then
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
      from public.income_items ii where ii.income_id = i.id
    ) item_totals on true
    where i.business_date = target_business_date;
    base := jsonb_set(base, '{summary,serviceTotal}', to_jsonb(charged_service_total), true);
    base := jsonb_set(base, '{summary,productTotal}', to_jsonb(charged_product_total), true);
  end if;

  select coalesce(jsonb_agg(
    case when i.source_type = 'fixed_subscription'
      then jsonb_set(sale.item, '{kind}', to_jsonb('subscription'::text)) else sale.item end
    order by sale.ordinality
  ), '[]'::jsonb) into normalized_sales
  from jsonb_array_elements(base -> 'sales') with ordinality sale(item, ordinality)
  left join public.incomes i on i.id = (sale.item ->> 'id')::uuid;
  base := jsonb_set(base, '{sales}', normalized_sales, true);

  if is_live and target_cash_id is not null then
    base := jsonb_set(base, '{id}', to_jsonb(target_cash_id), true);
  end if;

  select * into register_record
  from public.daily_cash_registers
  where id = target_cash_id
    or (target_cash_id is null and business_date = target_business_date)
  limit 1;

  if register_record.id is null then
    return base || jsonb_build_object('lifecycle', jsonb_build_object(
      'openingBalance', 0, 'openingSource', null, 'openedAt', null, 'openedBy', null,
      'expectedCash', 0, 'countedCash', null, 'difference', null, 'closeMode', null,
      'reconciliationState', 'not_applicable'));
  end if;

  if is_live then
    expected_value := public.current_cash_expected(
      target_business_date,
      register_record.opening_balance
    );
  else
    expected_value := register_record.expected_cash;
  end if;

  select case when u.id is null then null else jsonb_build_object(
    'id', u.id, 'firstName', u.first_name, 'lastName', u.last_name
  ) end into opened_by_json
  from (select 1) seed
  left join public.users u on u.id = register_record.opened_by;

  return base || jsonb_build_object('lifecycle', jsonb_build_object(
    'openingBalance', register_record.opening_balance,
    'openingSource', register_record.opening_source,
    'openedAt', register_record.opened_at,
    'openedBy', opened_by_json,
    'expectedCash', expected_value,
    'countedCash', register_record.counted_cash,
    'difference', register_record.difference_cash,
    'closeMode', register_record.close_mode,
    'reconciliationState', register_record.reconciliation_state));
end;
$$;

create or replace function public.list_fixed_customer_occurrences(
  actor_user_id uuid,
  date_from date,
  date_to date,
  filter_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role_id integer;
  result jsonb;
begin
  select u.role_id into actor_role_id
  from public.users u
  where u.id = actor_user_id
    and u.is_active
    and u.deleted_at is null;

  if actor_role_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  if filter_status is not null and filter_status not in ('pending', 'attended', 'missed') then
    raise exception using errcode = '22023', message = 'INVALID_OCCURRENCE_STATUS';
  end if;

  perform public.ensure_fixed_customer_occurrences(date_from, date_to);
  select coalesce(jsonb_agg(
    public.fixed_customer_occurrence_as_json(o.id)
    order by o.occurrence_date, o.scheduled_time, o.id
  ), '[]'::jsonb) into result
  from public.fixed_customer_occurrences o
  join public.customers c on c.id = o.customer_id and c.deleted_at is null
  where o.occurrence_date between date_from and date_to
    and (filter_status is null or o.status = filter_status)
    and (
      actor_role_id in (1, 2)
      or exists (
        select 1
        from public.customer_fixed_schedules s
        where s.customer_id = o.schedule_customer_id
          and s.is_active
          and s.responsible_user_id = actor_user_id
      )
    );
  return result;
end;
$$;

create or replace function public.resolve_fixed_customer_occurrence(
  actor_user_id uuid,
  target_occurrence_id uuid,
  new_status text,
  expected_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role_id integer;
  occurrence_customer_id uuid;
begin
  select u.role_id into actor_role_id
  from public.users u
  where u.id = actor_user_id
    and u.is_active
    and u.deleted_at is null;

  if actor_role_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  if new_status not in ('attended', 'missed') or expected_status <> 'pending' then
    raise exception using errcode = '22023', message = 'INVALID_OCCURRENCE_STATUS';
  end if;

  select o.schedule_customer_id into occurrence_customer_id
  from public.fixed_customer_occurrences o
  where o.id = target_occurrence_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'FIXED_OCCURRENCE_NOT_FOUND';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fixed-customer-schedule:' || occurrence_customer_id::text, 0)
  );

  perform 1
  from public.fixed_customer_occurrences o
  join public.customers c on c.id = o.customer_id and c.deleted_at is null
  join public.customer_fixed_schedules s on s.customer_id = o.schedule_customer_id
  where o.id = target_occurrence_id
    and (
      actor_role_id in (1, 2)
      or (
        s.is_active
        and s.responsible_user_id = actor_user_id
      )
    );

  if not found then
    raise exception using errcode = 'P0001', message = 'FIXED_OCCURRENCE_NOT_FOUND';
  end if;

  perform 1
  from public.fixed_customer_occurrences o
  where o.id = target_occurrence_id
  for update;

  update public.fixed_customer_occurrences as occurrence
  set status = new_status,
      status_changed_by = actor_user_id,
      status_changed_at = now()
  where occurrence.id = target_occurrence_id
    and occurrence.status = expected_status;

  if not found then
    raise exception using errcode = 'P0001', message = 'FIXED_OCCURRENCE_ALREADY_RESOLVED';
  end if;
  return public.fixed_customer_occurrence_as_json(target_occurrence_id);
end;
$$;

revoke execute on function public.list_fixed_customer_occurrences(uuid, date, date, text) from public, anon, authenticated;
revoke execute on function public.resolve_fixed_customer_occurrence(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.list_customer_visits(uuid, uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.void_income(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.cash_day_as_json(date, uuid, boolean) from public, anon, authenticated, service_role;
do $internal_grants$
begin
  if pg_catalog.to_regprocedure('public.mark_fixed_subscription_attempt_voided()') is not null then
    execute 'revoke execute on function public.mark_fixed_subscription_attempt_voided() from public, anon, authenticated';
  end if;
  if pg_catalog.to_regprocedure('public.trg_income_open_daily_cash()') is not null then
    execute 'revoke execute on function public.trg_income_open_daily_cash() from public, anon, authenticated';
  end if;
end;
$internal_grants$;
grant execute on function public.list_fixed_customer_occurrences(uuid, date, date, text) to service_role;
grant execute on function public.resolve_fixed_customer_occurrence(uuid, uuid, text, text) to service_role;
grant execute on function public.list_customer_visits(uuid, uuid, integer, integer) to service_role;
grant execute on function public.void_income(uuid, uuid) to service_role;
grant execute on function public.cash_day_as_json(date, uuid, boolean) to service_role;

notify pgrst, 'reload schema';

commit;
