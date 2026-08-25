-- Bastardos Barberia: professional-owned fixed customers with atomic monthly
-- payments. Run after 020_income_pricing_owner_commissions_and_employee_privacy.sql
-- as one complete migration. The migration does not create a parallel
-- versioned schema: it reuses the canonical users, incomes, income_payments
-- and employee_work_sessions tables plus the existing create_income trigger.
--
-- This migration installs:
--   * attempts.status with a CHECK constraint and a partial unique index
--     that guarantees only one active attempt per (customer, period);
--   * pay_fixed_customer_month that does NOT call ensure_daily_cash_open
--     (022 owns universal opening) and uses a hexadecimal text fingerprint;
--   * list/get projections whose viewer discriminant is derived from the
--     explicit actor_user_id parameter, never from JWT settings;
--   * an AFTER UPDATE OF status trigger on incomes that flips the linked
--     attempt to voided so the canonical void_income RPC keeps its existing
--     audit/stock/post-close Caja semantics.

-- ---------------------------------------------------------------------------
-- 1. Schedule ownership: responsible professional + positive monthly price
-- ---------------------------------------------------------------------------

-- These two nullable columns are intentionally installed before the migration
-- transaction. If the legacy preflight stops the script, they remain available
-- for an operator to map each active schedule explicitly before rerunning 021.
alter table public.customer_fixed_schedules
  add column if not exists responsible_user_id uuid references public.users(id) on delete restrict,
  add column if not exists monthly_price bigint;

do $$
begin
  if exists (
    select 1
    from public.customer_fixed_schedules s
    left join public.users responsible on responsible.id = s.responsible_user_id
    where s.is_active and (
      s.responsible_user_id is null
      or s.monthly_price is null
      or s.monthly_price <= 0
      or responsible.id is null
      or not responsible.is_active
      or responsible.deleted_at is not null
    )
  ) then
    raise exception using errcode = 'P0001', message = 'LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED';
  end if;
end;
$$;

begin;

alter table public.customer_fixed_schedules
  add constraint customer_fixed_schedules_monthly_price_check
    check (monthly_price is null or monthly_price > 0),
  add constraint customer_fixed_schedules_responsible_active_check
    check (
      not is_active
      or (responsible_user_id is not null and monthly_price is not null and monthly_price > 0)
    );

create index if not exists customer_fixed_schedules_responsible_idx
  on public.customer_fixed_schedules(responsible_user_id)
  where is_active;

-- ---------------------------------------------------------------------------
-- 2. Subscription source type on the canonical income record
-- ---------------------------------------------------------------------------

alter table public.incomes
  add column if not exists source_type text not null default 'sale',
  add column if not exists fixed_customer_id uuid references public.customers(id) on delete restrict,
  add column if not exists fixed_period text,
  add column if not exists subscription_concept jsonb;

alter table public.incomes
  add constraint incomes_source_type_check check (source_type in ('sale', 'fixed_subscription')),
  add constraint incomes_subscription_reference_check check (
    (source_type = 'sale' and fixed_customer_id is null and fixed_period is null and subscription_concept is null)
    or (
      source_type = 'fixed_subscription'
      and fixed_customer_id is not null
      and fixed_period is not null
      and fixed_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
      and subscription_concept is not null
    )
  );

create unique index if not exists incomes_one_subscription_per_period_key
  on public.incomes(fixed_customer_id, fixed_period)
  where source_type = 'fixed_subscription' and status = 'active';

-- ---------------------------------------------------------------------------
-- 3. Append-only fixed_customer_monthly_payment_attempts with status
-- ---------------------------------------------------------------------------

create table if not exists public.fixed_customer_monthly_payment_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  request_id uuid not null,
  registered_by uuid not null references public.users(id) on delete restrict,
  employee_id uuid not null references public.users(id) on delete restrict,
  income_id uuid references public.incomes(id) on delete restrict,
  paid_at timestamptz,
  status text not null default 'active' check (status in ('active', 'voided')),
  voided_at timestamptz,
  voided_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint fixed_payment_attempts_request_unique
    unique (customer_id, period, request_id)
);

create unique index if not exists fixed_payment_attempts_one_active_period
  on public.fixed_customer_monthly_payment_attempts(customer_id, period)
  where status = 'active';

create index if not exists fixed_payment_attempts_period_idx
  on public.fixed_customer_monthly_payment_attempts(period);

alter table public.fixed_customer_monthly_payment_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- 4. ensure_fixed_customer_active checks that an active schedule exists for
--    (customer, period) and that the responsible professional is active.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_fixed_customer_active(
  actor_user_id uuid,
  target_customer_id uuid,
  target_period text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule_responsible uuid;
  schedule_price bigint;
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
    raise exception using errcode = '22023', message = 'FIXED_MONTH_CUSTOMER_NOT_FOUND';
  end if;

  select responsible_user_id, monthly_price
    into schedule_responsible, schedule_price
    from public.customer_fixed_schedules
    where customer_id = target_customer_id and is_active
    for update;
  if not found then
    raise exception using errcode = '22023', message = 'FIXED_MONTH_NO_ACTIVE_SCHEDULE';
  end if;
  if schedule_responsible is null or schedule_price is null or schedule_price <= 0 then
    raise exception using errcode = '22023', message = 'FIXED_MONTH_INCOMPLETE_SCHEDULE';
  end if;
  if not exists (
    select 1 from public.users
    where id = schedule_responsible and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'FIXED_MONTH_PROFESSIONAL_INACTIVE';
  end if;
end;
$$;

revoke execute on function public.ensure_fixed_customer_active(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ensure_fixed_customer_active(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. pay_fixed_customer_month
--    - Manager: distinct positive amounts summing exactly monthly_price.
--    - Employee: distinct positive basis_points summing 10000; amounts computed
--      by integer division with the last allocation absorbing the remainder.
--    - Inserts a single subscription income on public.incomes with all canonical
--      commission columns, source_type = 'fixed_subscription' and the linked
--      attempt row. The existing 019 attach_income_work_session trigger handles
--      work-session linkage and the EMPLOYEE_WORK_SESSION_REQUIRED guard.
--    - Idempotent: a retry with the same request_id returns the original income
--      without recreating the attempt. A second attempt with a different
--      request_id while the previous is still active returns
--      FIXED_MONTH_ALREADY_PAID via the partial unique index.
--    - Does NOT call ensure_daily_cash_open; migration 022 will own universal
--      opening of the daily cash register.
-- ---------------------------------------------------------------------------

create or replace function public.compute_fixed_subscription_payments(
  monthly_price bigint,
  payment_items jsonb
)
returns table (payment_method_id uuid, amount bigint, basis_points integer)
language plpgsql
immutable
as $$
declare
  raw_item record;
  total_amount bigint := 0;
  total_basis integer := 0;
  has_amount boolean := false;
  has_basis boolean := false;
  computed_amount bigint;
  computed_basis integer;
  allocated_amount bigint := 0;
  allocated_basis integer := 0;
  paid_count integer := 0;
  total_count integer := 0;
  seen_method_ids text[] := '{}'::text[];
  current_method_id uuid;
begin
  total_count := jsonb_array_length(payment_items);

  for raw_item in
    select (item->>'paymentMethodId')::uuid as payment_method_id,
      (item->>'amount')::bigint as amount,
      (item->>'basisPoints')::integer as basis_points
    from jsonb_array_elements(payment_items) item
  loop
    if raw_item.payment_method_id is null then
      raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PAYMENT';
    end if;
    current_method_id := raw_item.payment_method_id;
    if current_method_id::text = any(seen_method_ids) then
      raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PAYMENT';
    end if;
    seen_method_ids := array_append(seen_method_ids, current_method_id::text);
    if raw_item.amount is not null then
      if raw_item.amount <= 0 then
        raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PAYMENT';
      end if;
      total_amount := total_amount + raw_item.amount;
      has_amount := true;
    elsif raw_item.basis_points is not null then
      if raw_item.basis_points < 0 or raw_item.basis_points > 10000 then
        raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PAYMENT';
      end if;
      total_basis := total_basis + raw_item.basis_points;
      has_basis := true;
    else
      raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PAYMENT';
    end if;
  end loop;

  if has_amount and has_basis then
    raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PAYMENT';
  end if;

  if has_amount then
    if total_amount <> monthly_price then
      raise exception using errcode = 'P0001', message = 'FIXED_MONTH_INVALID_PAYMENT';
    end if;
    return query
      select raw_item.payment_method_id, raw_item.amount::bigint, null::integer
      from (
        select (item->>'paymentMethodId')::uuid as payment_method_id,
          (item->>'amount')::bigint as amount
        from jsonb_array_elements(payment_items) item
      ) raw_item;
    return;
  end if;

  if has_basis then
    if total_basis <> 10000 then
      raise exception using errcode = 'P0001', message = 'FIXED_MONTH_INVALID_PAYMENT';
    end if;
    -- Reject distributions that would leave any method with basis 0 because
    -- the deterministic remainder absorbs zeros and never credits them.
    for raw_item in
      select (item->>'paymentMethodId')::uuid as payment_method_id,
        (item->>'amount')::bigint as amount,
        (item->>'basisPoints')::integer as basis_points
      from jsonb_array_elements(payment_items) item
    loop
      if raw_item.basis_points is null or raw_item.basis_points <= 0 or raw_item.basis_points > 10000 then
        raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PAYMENT';
      end if;
    end loop;
    for raw_item in
      select (item->>'paymentMethodId')::uuid as payment_method_id,
        (item->>'amount')::bigint as amount,
        (item->>'basisPoints')::integer as basis_points
      from jsonb_array_elements(payment_items) item
    loop
      paid_count := paid_count + 1;
      if paid_count = total_count then
        computed_amount := monthly_price - allocated_amount;
        computed_basis := 10000 - allocated_basis;
      else
        computed_amount := (monthly_price * raw_item.basis_points) / 10000;
        computed_basis := raw_item.basis_points;
      end if;
      if computed_amount <= 0 then
        raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PAYMENT';
      end if;
      allocated_amount := allocated_amount + computed_amount;
      allocated_basis := allocated_basis + computed_basis;
      payment_method_id := raw_item.payment_method_id;
      amount := computed_amount;
      basis_points := computed_basis;
      return next;
    end loop;
    return;
  end if;

  raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PAYMENT';
end;
$$;

revoke execute on function public.compute_fixed_subscription_payments(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.compute_fixed_subscription_payments(bigint, jsonb) to service_role;

create or replace function public.pay_fixed_customer_month(
  actor_user_id uuid,
  income_request_id uuid,
  target_customer_id uuid,
  target_period text,
  payment_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  responsible_employee_id uuid;
  responsible_employee_role text;
  monthly_price bigint;
  employee_service_rate smallint;
  employee_product_rate smallint;
  total_commission bigint;
  net_amount bigint;
  new_income_id uuid;
  attempt_id uuid;
  payment_row record;
  sale_created_at timestamptz := now();
  business_date date := (sale_created_at at time zone 'America/Argentina/Buenos_Aires')::date;
  submitted_payment_method_count integer;
  locked_payment_method_count integer;
  normalized_payments jsonb;
  fingerprint text;
  existing_income record;
  violated_constraint text;
begin
  select case role_id when 1 then 'owner' when 2 then 'admin' when 3 then 'employee' end
    into actor_role
    from public.users
    where id = actor_user_id and is_active and deleted_at is null;
  if not found then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  if pg_catalog.jsonb_typeof(payment_items) <> 'array'
    or pg_catalog.jsonb_array_length(payment_items) = 0 then
    raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PAYMENT';
  end if;
  submitted_payment_method_count := pg_catalog.jsonb_array_length(payment_items);

  begin
    select coalesce(jsonb_agg(jsonb_build_object(
      'paymentMethodId', (item->>'paymentMethodId')::uuid,
      'amount', (item->>'amount')::bigint,
      'basisPoints', (item->>'basisPoints')::integer
    ) order by (item->>'paymentMethodId')::uuid), '[]'::jsonb)
    into normalized_payments
    from jsonb_array_elements(payment_items) item;
  exception when others then
    raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PAYMENT';
  end;

  fingerprint := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(jsonb_build_object(
      'customerId', target_customer_id,
      'period', target_period,
      'payments', normalized_payments
    )::text, 'UTF8'), 'sha256'),
    'hex'
  );

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_user_id::text || ':' || income_request_id::text, 0
  ));

  select id, request_fingerprint, source_type, fixed_customer_id, fixed_period
  into existing_income
  from public.incomes
  where request_id = income_request_id and registered_by = actor_user_id;

  if found then
    if existing_income.source_type <> 'fixed_subscription'
      or existing_income.fixed_customer_id is distinct from target_customer_id
      or existing_income.fixed_period is distinct from target_period
      or existing_income.request_fingerprint <> fingerprint
    then
      raise exception using errcode = 'P0001', message = 'FIXED_MONTH_REQUEST_CONFLICT';
    end if;
    if actor_role = 'employee' then
      return public.fixed_customer_month_as_employee_json(existing_income.id);
    end if;
    return public.fixed_customer_month_as_json(existing_income.id);
  end if;

  perform public.ensure_fixed_customer_active(actor_user_id, target_customer_id, target_period);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'fixed-month:' || target_customer_id::text || ':' || target_period, 0
  ));

  select s.responsible_user_id, s.monthly_price
    into responsible_employee_id, monthly_price
    from public.customer_fixed_schedules s
    where s.customer_id = target_customer_id and s.is_active
    for update;

  select
      case u.role_id when 1 then 'owner' when 2 then 'admin' when 3 then 'employee' end,
      u.service_commission_rate,
      u.product_commission_rate
    into responsible_employee_role, employee_service_rate, employee_product_rate
    from public.users u
    where u.id = responsible_employee_id;

  perform 1
  from public.compute_fixed_subscription_payments(monthly_price, payment_items);

  if exists (
    select 1 from public.fixed_customer_monthly_payment_attempts
    where customer_id = target_customer_id and period = target_period and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'FIXED_MONTH_ALREADY_PAID';
  end if;

  perform pm.id
  from public.payment_methods pm
  join pg_catalog.jsonb_array_elements(payment_items) submitted(item)
    on (submitted.item->>'paymentMethodId')::uuid = pm.id
  where pm.is_active
  order by pm.id
  for share of pm;
  get diagnostics locked_payment_method_count = row_count;

  if locked_payment_method_count <> submitted_payment_method_count then
    raise exception using errcode = 'P0001', message = 'FIXED_MONTH_PAYMENT_METHOD_NOT_AVAILABLE';
  end if;

  -- Commission is always monthly_price * service_commission_rate of the
  -- responsible professional, regardless of their role (owner included).
  total_commission := round(monthly_price::numeric * employee_service_rate / 100)::bigint;
  net_amount := monthly_price - total_commission;

  insert into public.incomes (
    request_id, registered_by, employee_id, responsible_role_snapshot,
    request_fingerprint, customer_id, payment_method, total, gross_total,
    service_commission_base, product_commission_base,
    service_commission_rate, product_commission_rate,
    service_commission_amount, product_commission_amount,
    commission_total, barbershop_net,
    full_service_commission, full_service_commission_authorized_by,
    work_session_id, outside_work_session,
    status, created_at, business_date,
    source_type, fixed_customer_id, fixed_period, subscription_concept
  ) values (
    income_request_id, actor_user_id, responsible_employee_id, responsible_employee_role,
    fingerprint,
    target_customer_id, 'mixed', monthly_price, monthly_price,
    monthly_price, 0,
    employee_service_rate, employee_product_rate,
    total_commission, 0, total_commission, net_amount,
    false, null,
    null, true,
    'active', sale_created_at, business_date,
    'fixed_subscription', target_customer_id, target_period,
    jsonb_build_object(
      'period', target_period,
      'monthlyPrice', monthly_price,
      'commissionAmount', total_commission,
      'barbershopNet', net_amount,
      'responsibleUserId', responsible_employee_id,
      'responsibleRole', responsible_employee_role,
      'label', to_char(business_date, 'YYYY-MM')
    )
  ) returning id into new_income_id;

  for payment_row in
    select * from public.compute_fixed_subscription_payments(monthly_price, payment_items)
  loop
    insert into public.income_payments (
      income_id, payment_method_id, method_name_snapshot, amount, basis_points
    ) values (
      new_income_id, payment_row.payment_method_id,
      (select name from public.payment_methods where id = payment_row.payment_method_id),
      payment_row.amount, payment_row.basis_points
    );
  end loop;

  insert into public.fixed_customer_monthly_payment_attempts (
    customer_id, period, request_id, registered_by, employee_id, income_id, paid_at
  ) values (
    target_customer_id, target_period, income_request_id, actor_user_id,
    responsible_employee_id, new_income_id, sale_created_at
  ) returning id into attempt_id;

  if actor_role = 'employee' then
    return public.fixed_customer_month_as_employee_json(new_income_id);
  end if;
  return public.fixed_customer_month_as_json(new_income_id);
exception
  when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;
    if violated_constraint in (
      'fixed_payment_attempts_one_active_period',
      'incomes_one_subscription_per_period_key'
    ) then
      raise exception using errcode = 'P0001', message = 'FIXED_MONTH_ALREADY_PAID';
    end if;
    if violated_constraint = 'fixed_payment_attempts_request_unique' then
      raise exception using errcode = 'P0001', message = 'FIXED_MONTH_REQUEST_CONFLICT';
    end if;
    raise;
end;
$$;

revoke execute on function public.pay_fixed_customer_month(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.pay_fixed_customer_month(uuid, uuid, uuid, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 6. fixed_customer_month_as_json + list/get projections
--    Viewer discriminant is derived from actor_user_id + actor_role_id,
--    never from JWT settings. get_fixed_customer_month synthesizes a
--    pending object from the active schedule when no attempt exists so the
--    first payment dialog can open for an unpaid month.
-- ---------------------------------------------------------------------------

create or replace function public.fixed_customer_month_as_json(target_income_id uuid)
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
    'customer', jsonb_build_object('id', c.id, 'firstName', c.first_name, 'lastName', c.last_name),
    'responsibleProfessional', jsonb_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name),
    'period', i.fixed_period,
    'status', case when i.status = 'active' and att.id is not null and att.status = 'active' then 'paid' else 'pending' end,
    'paidAt', att.paid_at,
    'incomeId', i.id,
    'employeeEarning', i.commission_total,
    'monthlyPrice', i.total,
    'viewer', 'manager'
  ) into result
  from public.incomes i
  join public.customers c on c.id = i.customer_id
  join public.users u on u.id = i.employee_id
  left join public.fixed_customer_monthly_payment_attempts att
    on att.income_id = i.id and att.status = 'active'
  where i.id = target_income_id;

  return result;
end;
$$;

revoke execute on function public.fixed_customer_month_as_json(uuid) from public, anon, authenticated;
grant execute on function public.fixed_customer_month_as_json(uuid) to service_role;

-- Employee-shaped projection of the same month; never exposes monthlyPrice.
create or replace function public.fixed_customer_month_as_employee_json(target_income_id uuid)
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
    'customer', jsonb_build_object('id', c.id, 'firstName', c.first_name, 'lastName', c.last_name),
    'responsibleProfessional', jsonb_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name),
    'period', i.fixed_period,
    'status', case when i.status = 'active' and att.id is not null and att.status = 'active' then 'paid' else 'pending' end,
    'paidAt', att.paid_at,
    'incomeId', i.id,
    'employeeEarning', i.commission_total,
    'viewer', 'employee'
  ) into result
  from public.incomes i
  join public.customers c on c.id = i.customer_id
  join public.users u on u.id = i.employee_id
  left join public.fixed_customer_monthly_payment_attempts att
    on att.income_id = i.id and att.status = 'active'
  where i.id = target_income_id;

  return result;
end;
$$;

revoke execute on function public.fixed_customer_month_as_employee_json(uuid) from public, anon, authenticated;
grant execute on function public.fixed_customer_month_as_employee_json(uuid) to service_role;

create or replace function public.list_fixed_customer_months(
  actor_user_id uuid,
  can_view_all boolean,
  filter_period text,
  filter_employee_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  effective_employee_id uuid;
  result jsonb;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  select case role_id when 1 then 'owner' when 2 then 'admin' when 3 then 'employee' end
    into actor_role
    from public.users where id = actor_user_id;

  if can_view_all and actor_role in ('owner', 'admin') and filter_employee_id is not null then
    effective_employee_id := filter_employee_id;
  elsif can_view_all and actor_role in ('owner', 'admin') then
    effective_employee_id := null;
  else
    effective_employee_id := actor_user_id;
  end if;

  select coalesce(jsonb_agg(row order by row->>'lastName', row->>'firstName'), '[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'customer', jsonb_build_object('id', c.id, 'firstName', c.first_name, 'lastName', c.last_name),
      'responsibleProfessional', jsonb_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name),
      'period', filter_period,
      'status', case when att.id is not null and att.status = 'active' then 'paid' else 'pending' end,
      'paidAt', att.paid_at,
      'incomeId', att.income_id,
      'employeeEarning', coalesce(i.commission_total, 0)
    ) || case when actor_role in ('owner', 'admin')
      then jsonb_build_object('monthlyPrice', s.monthly_price, 'viewer', 'manager')
      else jsonb_build_object('viewer', 'employee')
    end as row
    from public.customer_fixed_schedules s
    join public.customers c on c.id = s.customer_id and c.deleted_at is null
    join public.users u on u.id = s.responsible_user_id and u.is_active and u.deleted_at is null
    left join public.fixed_customer_monthly_payment_attempts att
      on att.customer_id = s.customer_id
     and att.period = filter_period
     and att.status = 'active'
    left join public.incomes i on i.id = att.income_id
    where s.is_active
      and s.monthly_price > 0
      and (effective_employee_id is null or s.responsible_user_id = effective_employee_id)
  ) as rows;

  return result;
end;
$$;

revoke execute on function public.list_fixed_customer_months(uuid, boolean, text, uuid) from public, anon, authenticated;
grant execute on function public.list_fixed_customer_months(uuid, boolean, text, uuid) to service_role;

create or replace function public.get_fixed_customer_month(
  actor_user_id uuid,
  can_view_all boolean,
  target_customer_id uuid,
  target_period text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  effective_employee_id uuid;
  effective_can_view_all boolean := can_view_all;
  result jsonb;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  select case role_id when 1 then 'owner' when 2 then 'admin' when 3 then 'employee' end
    into actor_role
    from public.users where id = actor_user_id;
  if actor_role not in ('owner', 'admin') then
    effective_can_view_all := false;
  end if;
  effective_employee_id := case when effective_can_view_all then null else actor_user_id end;

  if not exists (
    select 1 from public.customer_fixed_schedules
    where customer_id = target_customer_id and is_active
      and (effective_employee_id is null or responsible_user_id = effective_employee_id)
  ) then
    return null;
  end if;

  -- An active attempt is paid. A voided attempt reopens the month, so when no
  -- active attempt exists the current schedule is projected as pending.
  select case when actor_role = 'employee'
      then public.fixed_customer_month_as_employee_json(att.income_id)
      else public.fixed_customer_month_as_json(att.income_id)
    end into result
    from public.fixed_customer_monthly_payment_attempts att
    where att.customer_id = target_customer_id
      and att.period = target_period
      and att.status = 'active'
    limit 1;
  if result is not null then
    return result;
  end if;

  return public.synthesize_pending_fixed_customer_month(
    target_customer_id,
    target_period,
    actor_role
  );
end;
$$;

revoke execute on function public.get_fixed_customer_month(uuid, boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.get_fixed_customer_month(uuid, boolean, uuid, text) to service_role;

create or replace function public.synthesize_pending_fixed_customer_month(
  target_customer_id uuid,
  target_period text,
  viewer_role text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  select case when viewer_role = 'employee' then jsonb_build_object(
    'customer', jsonb_build_object('id', c.id, 'firstName', c.first_name, 'lastName', c.last_name),
    'responsibleProfessional', jsonb_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name),
    'period', target_period,
    'status', 'pending',
    'paidAt', null,
    'incomeId', null,
    'employeeEarning', 0,
    'viewer', 'employee'
  ) else jsonb_build_object(
    'customer', jsonb_build_object('id', c.id, 'firstName', c.first_name, 'lastName', c.last_name),
    'responsibleProfessional', jsonb_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name),
    'period', target_period,
    'status', 'pending',
    'paidAt', null,
    'incomeId', null,
    'employeeEarning', 0,
    'monthlyPrice', s.monthly_price,
    'viewer', 'manager'
  ) end into result
  from public.customer_fixed_schedules s
  join public.customers c on c.id = s.customer_id and c.deleted_at is null
  join public.users u on u.id = s.responsible_user_id and u.is_active and u.deleted_at is null
  where s.customer_id = target_customer_id
    and s.is_active
    and s.monthly_price > 0;
  return result;
end;
$$;

revoke execute on function public.synthesize_pending_fixed_customer_month(uuid, text, text) from public, anon, authenticated;
grant execute on function public.synthesize_pending_fixed_customer_month(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 7. void_income marks the linked attempt as voided via an AFTER UPDATE OF
--    status trigger so the canonical void_income RPC keeps its existing
--    audit/stock/post-close Caja semantics.
-- ---------------------------------------------------------------------------

create or replace function public.mark_fixed_subscription_attempt_voided()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'voided' and old.status <> 'voided' and new.source_type = 'fixed_subscription' then
    update public.fixed_customer_monthly_payment_attempts
      set status = 'voided',
          voided_at = now(),
          voided_by = coalesce(new.voided_by, new.registered_by)
      where income_id = new.id
        and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_void_fixed_subscription_attempt on public.incomes;
create trigger trg_void_fixed_subscription_attempt
  after update of status on public.incomes
  for each row execute function public.mark_fixed_subscription_attempt_voided();

notify pgrst, 'reload schema';

commit;
