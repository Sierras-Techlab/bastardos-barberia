-- Bastardos Barberia: fixed-customer assignment to professionals, monthly price,
-- atomic monthly payment that creates a fixed_subscription income, and role-scoped
-- fixed-occurrence/customer projections.
-- Run after 020_income_pricing_owner_commissions_and_employee_privacy.sql as one
-- complete migration.

begin;

-- ---------------------------------------------------------------------------
-- 1. Schedule ownership and monthly price
-- ---------------------------------------------------------------------------

alter table public.customer_fixed_schedules
  add column if not exists responsible_user_id uuid references public.users(id) on delete restrict,
  add column if not exists monthly_price integer;

update public.customer_fixed_schedules
set responsible_user_id = coalesce(responsible_user_id, user_id)
where user_id is not null;

-- After the legacy user_id column was dropped (if it ever existed), the
-- preflight below validates every active row carries a non-null responsible
-- professional and a positive monthly price before allowing the migration
-- to apply.

do $$
declare
  missing_responsible integer;
  missing_price integer;
  missing_count integer;
begin
  select count(*) into missing_responsible
    from public.customer_fixed_schedules
    where is_active and responsible_user_id is null;
  select count(*) into missing_price
    from public.customer_fixed_schedules
    where is_active and (monthly_price is null or monthly_price <= 0);
  missing_count := coalesce(missing_responsible, 0) + coalesce(missing_price, 0);
  if missing_count > 0 then
    raise exception using errcode = 'P0001',
      message = 'LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED';
  end if;
end;
$$;

alter table public.customer_fixed_schedules
  alter column responsible_user_id set not null,
  alter column monthly_price set not null,
  add constraint customer_fixed_schedules_monthly_price_check check (monthly_price > 0);

-- ---------------------------------------------------------------------------
-- 2. Income source type and subscription reference
-- ---------------------------------------------------------------------------

alter table public.incomes
  add column if not exists source_type text not null default 'sale',
  add column if not exists fixed_customer_id uuid references public.customers(id) on delete restrict,
  add column if not exists fixed_period text;

update public.incomes set source_type = 'sale' where source_type is null;

alter table public.incomes
  add constraint incomes_source_type_check check (source_type in ('sale', 'fixed_subscription')),
  add constraint incomes_subscription_reference_check check (
    (source_type = 'sale' and fixed_customer_id is null and fixed_period is null)
    or (source_type = 'fixed_subscription' and fixed_customer_id is not null and fixed_period ~ '^(\d{4})-(0[1-9]|1[0-2])$')
  );

create unique index if not exists incomes_one_subscription_per_period_key
  on public.incomes(fixed_customer_id, fixed_period)
  where source_type = 'fixed_subscription' and status = 'active';

-- Subscription concept: snapshot stored on the income to render history and
-- customer detail without re-reading the schedule.
alter table public.incomes
  add column if not exists subscription_concept jsonb;

-- Subscription concept must be present for fixed_subscription rows, absent
-- for sales.
alter table public.incomes
  add constraint incomes_subscription_concept_check check (
    (source_type = 'sale' and subscription_concept is null)
    or (source_type = 'fixed_subscription' and subscription_concept is not null)
  );

-- ---------------------------------------------------------------------------
-- 3. Append-only monthly payment attempts
-- ---------------------------------------------------------------------------

create table if not exists public.fixed_customer_monthly_payment_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  period text not null check (period ~ '^(\d{4})-(0[1-9]|1[0-2])$'),
  request_id uuid not null,
  registered_by uuid not null references public.users(id) on delete restrict,
  income_id uuid references public.incomes(id) on delete restrict,
  status text not null default 'pending',
  voided_at timestamptz,
  voided_by uuid references public.users(id) on delete restrict,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fixed_payment_attempts_request_unique unique (customer_id, period, request_id),
  constraint fixed_payment_attempts_status_check check (status in ('pending', 'paid', 'voided')),
  constraint fixed_payment_attempts_income_required check (
    (status = 'pending' and income_id is null)
    or (status in ('paid', 'voided') and income_id is not null)
  ),
  constraint fixed_payment_attempts_void_check check (
    (status = 'voided' and voided_at is not null and voided_by is not null)
    or (status <> 'voided' and voided_at is null and voided_by is null)
  )
);

create unique index if not exists fixed_payment_attempts_one_active_per_period_key
  on public.fixed_customer_monthly_payment_attempts(customer_id, period)
  where status = 'paid';

create index if not exists fixed_payment_attempts_period_status_idx
  on public.fixed_customer_monthly_payment_attempts(period, status, customer_id);

alter table public.fixed_customer_monthly_payment_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- 4. list_fixed_customer_months
-- ---------------------------------------------------------------------------

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
  actor_employee_id uuid;
  result jsonb;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  select role_name into actor_role from public.users where id = actor_user_id;

  if can_view_all and filter_employee_id is not null then
    actor_employee_id := filter_employee_id;
  elsif not can_view_all then
    actor_employee_id := actor_user_id;
  else
    actor_employee_id := null;
  end if;

  select coalesce(jsonb_agg(row_data), '[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'customer', jsonb_build_object(
        'id', c.id, 'firstName', c.first_name, 'lastName', c.last_name
      ),
      'responsibleProfessional', jsonb_build_object(
        'id', u.id, 'firstName', u.first_name, 'lastName', u.last_name
      ),
      'period', s.period,
      'status', coalesce(att.status, 'pending'),
      'paidAt', att.paid_at,
      'incomeId', att.income_id,
      'employeeEarning', coalesce(att.employee_earning, 0),
      'monthlyPrice', s.monthly_price,
      'viewer', case when can_view_all and actor_role in ('owner', 'admin') then 'manager' else 'employee' end
    ) as row_data
    from public.customer_fixed_schedules s
    join public.customers c on c.id = s.customer_id and c.deleted_at is null
    join public.users u on u.id = s.responsible_user_id and u.is_active and u.deleted_at is null
    left join public.fixed_customer_monthly_payment_attempts att
      on att.customer_id = s.customer_id and att.period = s.period
    where s.is_active
      and s.period = filter_period
      and (actor_employee_id is null or s.responsible_user_id = actor_employee_id)
  ) as rows;

  return result;
end;
$$;

revoke execute on function public.list_fixed_customer_months(uuid, boolean, text, uuid)
  from public, anon, authenticated;
grant execute on function public.list_fixed_customer_months(uuid, boolean, text, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. pay_fixed_customer_month
-- ---------------------------------------------------------------------------

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
  business_date date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  actor_role text;
  responsible_employee_id uuid;
  monthly_price integer;
  commission_amount integer;
  barbershop_net integer;
  attempt_id uuid;
  new_income_id uuid;
  payment_total integer := 0;
  allocation_sum integer := 0;
  payment_record record;
  income_request_already_paid uuid;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  select role_name into actor_role from public.users where id = actor_user_id;

  select s.responsible_user_id, s.monthly_price
    into responsible_employee_id, monthly_price
  from public.customer_fixed_schedules s
  where s.customer_id = target_customer_id and s.is_active and s.period = target_period;
  if not found then
    raise exception using errcode = '22023', message = 'FIXED_MONTH_CUSTOMER_NOT_FOUND';
  end if;
  if monthly_price is null or monthly_price <= 0 then
    raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PERIOD';
  end if;
  if actor_role = 'employee' and responsible_employee_id <> actor_user_id then
    raise exception using errcode = '22023', message = 'FIXED_MONTH_FORBIDDEN';
  end if;

  -- Reject an active attempt for the same (customer, period) that already paid.
  select income_id into income_request_already_paid
    from public.fixed_customer_monthly_payment_attempts
    where customer_id = target_customer_id
      and period = target_period
      and status = 'paid';
  if income_request_already_paid is not null then
    raise exception using errcode = 'P0001', message = 'FIXED_MONTH_ALREADY_PAID';
  end if;

  -- Employee requires an open work session, manager does not.
  if actor_role = 'employee' then
    if not exists (
      select 1 from public.work_sessions
      where employee_id = actor_user_id and ended_at is null
    ) then
      raise exception using errcode = 'P0001', message = 'EMPLOYEE_WORK_SESSION_REQUIRED';
    end if;
  end if;

  -- Calculate payments.
  if jsonb_typeof(payment_items) <> 'array' or jsonb_array_length(payment_items) = 0 then
    raise exception using errcode = '22023', message = 'PAYMENT_ALLOCATION_MISMATCH';
  end if;

  for payment_record in
    select * from jsonb_to_recordset(payment_items) as x(
      payment_method_id uuid,
      amount integer,
      basis_points integer
    )
  loop
    if payment_record.payment_method_id is null then
      raise exception using errcode = '22023', message = 'PAYMENT_ALLOCATION_MISMATCH';
    end if;
    if payment_record.amount is not null then
      if payment_record.amount <= 0 then
        raise exception using errcode = '22023', message = 'PAYMENT_ALLOCATION_MISMATCH';
      end if;
      payment_total := payment_total + payment_record.amount;
    elsif payment_record.basis_points is not null then
      if payment_record.basis_points < 0 or payment_record.basis_points > 10000 then
        raise exception using errcode = '22023', message = 'PAYMENT_ALLOCATION_MISMATCH';
      end if;
      allocation_sum := allocation_sum + payment_record.basis_points;
    else
      raise exception using errcode = '22023', message = 'PAYMENT_ALLOCATION_MISMATCH';
    end if;
  end loop;

  if payment_total > 0 and payment_total <> monthly_price then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
  end if;
  if allocation_sum > 0 and allocation_sum <> 10000 then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
  end if;
  if payment_total = 0 and allocation_sum = 0 then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
  end if;

  -- Lock customer/schedule/user for the entire transaction.
  perform 1 from public.customers where id = target_customer_id and deleted_at is null for update;
  perform 1 from public.customer_fixed_schedules where customer_id = target_customer_id and is_active for update;
  perform 1 from public.users where id = responsible_employee_id and is_active and deleted_at is null for update;

  -- Commission snapshot: monthly_price * service_commission_rate / 100.
  select coalesce(round(monthly_price::numeric * service_commission_rate / 100)::integer, 0)
    into commission_amount
  from public.users where id = responsible_employee_id;
  if actor_role = 'owner' then
    commission_amount := 0;
  end if;
  barbershop_net := monthly_price - commission_amount;

  -- Insert the income (subscription).
  insert into public.incomes (
    request_id, user_id, customer_id, payment_method, total, status,
    source_type, fixed_customer_id, fixed_period, gross_total,
    subscription_concept
  ) values (
    income_request_id, actor_user_id, target_customer_id, 'mixed', monthly_price, 'active',
    'fixed_subscription', target_customer_id, target_period, monthly_price,
    jsonb_build_object(
      'period', target_period,
      'monthlyPrice', monthly_price,
      'commissionAmount', commission_amount,
      'barbershopNet', barbershop_net,
      'responsibleUserId', responsible_employee_id
    )
  ) returning id into new_income_id;

  -- Persist payment allocations.
  for payment_record in
    select * from jsonb_to_recordset(payment_items) as x(
      payment_method_id uuid,
      amount integer,
      basis_points integer
    )
  loop
    if payment_record.amount is not null then
      insert into public.income_payments (
        income_id, payment_method_id, method_name_snapshot, amount, basis_points
      ) values (
        new_income_id, payment_record.payment_method_id,
        (select name from public.payment_methods where id = payment_record.payment_method_id),
        payment_record.amount, null
      );
    else
      insert into public.income_payments (
        income_id, payment_method_id, method_name_snapshot, amount, basis_points
      ) values (
        new_income_id, payment_record.payment_method_id,
        (select name from public.payment_methods where id = payment_record.payment_method_id),
        0, payment_record.basis_points
      );
    end if;
  end loop;

  -- Register payment attempt.
  insert into public.fixed_customer_monthly_payment_attempts (
    customer_id, period, request_id, registered_by, income_id, status, paid_at
  ) values (
    target_customer_id, target_period, income_request_id, actor_user_id,
    new_income_id, 'paid', now()
  ) returning id into attempt_id;

  return jsonb_build_object(
    'customer', jsonb_build_object(
      'id', target_customer_id,
      'firstName', (select first_name from public.customers where id = target_customer_id),
      'lastName', (select last_name from public.customers where id = target_customer_id)
    ),
    'responsibleProfessional', jsonb_build_object(
      'id', responsible_employee_id,
      'firstName', (select first_name from public.users where id = responsible_employee_id),
      'lastName', (select last_name from public.users where id = responsible_employee_id)
    ),
    'period', target_period,
    'status', 'paid',
    'paidAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'incomeId', new_income_id,
    'employeeEarning', commission_amount,
    'monthlyPrice', monthly_price,
    'viewer', case when actor_role in ('owner', 'admin') then 'manager' else 'employee' end
  );
end;
$$;

revoke execute on function public.pay_fixed_customer_month(uuid, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.pay_fixed_customer_month(uuid, uuid, uuid, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6. get_fixed_customer_month
-- ---------------------------------------------------------------------------

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
  projection jsonb;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  select role_name into actor_role from public.users where id = actor_user_id;

  if not can_view_all and not exists (
    select 1 from public.customer_fixed_schedules
    where customer_id = target_customer_id and is_active and responsible_user_id = actor_user_id
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'customer', jsonb_build_object(
      'id', c.id, 'firstName', c.first_name, 'lastName', c.last_name
    ),
    'responsibleProfessional', jsonb_build_object(
      'id', u.id, 'firstName', u.first_name, 'lastName', u.last_name
    ),
    'period', s.period,
    'status', coalesce(att.status, 'pending'),
    'paidAt', att.paid_at,
    'incomeId', att.income_id,
    'employeeEarning', coalesce(att.employee_earning, 0),
    'monthlyPrice', s.monthly_price,
    'viewer', case when can_view_all and actor_role in ('owner', 'admin') then 'manager' else 'employee' end
  ) into projection
  from public.customer_fixed_schedules s
  join public.customers c on c.id = s.customer_id and c.deleted_at is null
  join public.users u on u.id = s.responsible_user_id and u.is_active and u.deleted_at is null
  left join public.fixed_customer_monthly_payment_attempts att
    on att.customer_id = s.customer_id and att.period = s.period
  where s.customer_id = target_customer_id and s.is_active and s.period = target_period;
  return projection;
end;
$$;

revoke execute on function public.get_fixed_customer_month(uuid, boolean, uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_fixed_customer_month(uuid, boolean, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 7. Update void_income to mark subscription attempts as voided
-- ---------------------------------------------------------------------------

create or replace function public.void_income(target_income_id uuid, actor_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  voided_income_id uuid;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null and role_name in ('owner', 'admin')
  ) then
    raise exception using errcode = '22023', message = 'FORBIDDEN';
  end if;

  perform 1 from public.incomes where id = target_income_id and status = 'active' for update;
  if not found then
    return null;
  end if;

  update public.incomes
    set status = 'voided', voided_at = now(), voided_by = actor_user_id
  where id = target_income_id;

  update public.fixed_customer_monthly_payment_attempts
    set status = 'voided', voided_at = now(), voided_by = actor_user_id
  where income_id = target_income_id and status = 'paid';

  return target_income_id;
end;
$$;

revoke execute on function public.void_income(uuid, uuid) from public, anon, authenticated;
grant execute on function public.void_income(uuid, uuid) to service_role;

notify pgrst, 'reload schema';

commit;
