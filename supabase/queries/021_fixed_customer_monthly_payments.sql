-- Bastardos Barberia: fixed-customer professional ownership and monthly payments.
-- Run after 020_income_pricing_owner_commissions_and_employee_privacy.sql.

begin;

alter table public.customer_fixed_schedules
  add column if not exists responsible_user_id uuid references public.users(id) on delete restrict,
  add column if not exists monthly_price integer;

-- Legacy schedules cannot be assigned safely without a product decision.
do $$
begin
  if exists (
    select 1 from public.customer_fixed_schedules
    where is_active and (responsible_user_id is null or monthly_price is null or monthly_price <= 0)
  ) then
    raise exception using errcode = 'P0001', message = 'LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED';
  end if;
end;
$$;

alter table public.customer_fixed_schedules
  alter column responsible_user_id set not null,
  alter column monthly_price set not null,
  add constraint customer_fixed_schedules_monthly_price_check check (monthly_price > 0);

alter table public.incomes
  add column if not exists source_type text not null default 'sale',
  add column if not exists fixed_customer_id uuid references public.customers(id) on delete restrict,
  add column if not exists fixed_period text,
  add column if not exists subscription_concept jsonb;

alter table public.incomes
  add constraint incomes_source_type_check check (source_type in ('sale', 'fixed_subscription')),
  add constraint incomes_subscription_reference_check check (
    (source_type = 'sale' and fixed_customer_id is null and fixed_period is null)
    or (source_type = 'fixed_subscription' and fixed_customer_id is not null
      and fixed_period ~ '^(\d{4})-(0[1-9]|1[0-2])$')
  ),
  add constraint incomes_subscription_concept_check check (
    (source_type = 'sale' and subscription_concept is null)
    or (source_type = 'fixed_subscription' and subscription_concept is not null)
  );

create unique index if not exists incomes_one_subscription_per_period_key
  on public.incomes(fixed_customer_id, fixed_period)
  where source_type = 'fixed_subscription' and status = 'active';

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
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
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
revoke all on table public.fixed_customer_monthly_payment_attempts from public, anon, authenticated;

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
  scoped_employee_id uuid;
  manager_view boolean;
  result jsonb;
begin
  select r.name into actor_role
  from public.users u join public.roles r on r.id = u.role_id
  where u.id = actor_user_id and u.is_active and u.deleted_at is null;
  if not found then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  if filter_period is null or filter_period !~ '^(\d{4})-(0[1-9]|1[0-2])$' then
    raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PERIOD';
  end if;

  manager_view := actor_role in ('owner', 'admin') and can_view_all;
  scoped_employee_id := case
    when manager_view then filter_employee_id
    else actor_user_id
  end;

  select coalesce(jsonb_agg(row_data order by row_data->'customer'->>'lastName', row_data->'customer'->>'firstName'), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'customer', jsonb_build_object('id', c.id, 'firstName', c.first_name, 'lastName', c.last_name),
      'responsibleProfessional', jsonb_build_object('id', responsible.id, 'firstName', responsible.first_name, 'lastName', responsible.last_name),
      'period', filter_period,
      'status', case when paid.id is null then 'pending' else 'paid' end,
      'paidAt', paid.paid_at,
      'incomeId', paid.income_id,
      'employeeEarning', coalesce(i.commission_total, 0),
      'viewer', case when manager_view then 'manager' else 'employee' end
    ) || case when manager_view then jsonb_build_object('monthlyPrice', coalesce(i.total, s.monthly_price)) else '{}'::jsonb end
      as row_data
    from public.customer_fixed_schedules s
    join public.customers c on c.id = s.customer_id and c.deleted_at is null
    left join public.fixed_customer_monthly_payment_attempts paid
      on paid.customer_id = s.customer_id and paid.period = filter_period and paid.status = 'paid'
    left join public.incomes i on i.id = paid.income_id and i.status = 'active'
    join public.users responsible
      on responsible.id = coalesce(i.employee_id, s.responsible_user_id)
    where s.is_active
      and (scoped_employee_id is null or coalesce(i.employee_id, s.responsible_user_id) = scoped_employee_id)
  ) rows;
  return result;
end;
$$;

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
  responsible record;
  schedule_price integer;
  sale_created_at timestamptz := pg_catalog.clock_timestamp();
  sale_business_date date := (sale_created_at at time zone 'America/Argentina/Buenos_Aires')::date;
  commission_amount integer;
  net_amount integer;
  fingerprint text;
  existing_income record;
  created_income_id uuid;
  payment_item jsonb;
  payment_count integer;
  payment_total bigint := 0;
  basis_total integer := 0;
  uses_basis_points boolean;
  allocated bigint := 0;
  allocation bigint;
  item_index integer;
  manager_view boolean;
  response jsonb;
begin
  select r.name into actor_role
  from public.users u join public.roles r on r.id = u.role_id
  where u.id = actor_user_id and u.is_active and u.deleted_at is null;
  if not found then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  manager_view := actor_role in ('owner', 'admin');

  if income_request_id is null or target_period is null
    or target_period !~ '^(\d{4})-(0[1-9]|1[0-2])$' then
    raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PERIOD';
  end if;
  if jsonb_typeof(payment_items) <> 'array' or jsonb_array_length(payment_items) = 0 then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_user_id::text || ':' || income_request_id::text, 0)
  );

  select id, request_fingerprint, fixed_customer_id, fixed_period into existing_income
  from public.incomes
  where registered_by = actor_user_id and request_id = income_request_id;

  select s.monthly_price, u.id, u.first_name, u.last_name, u.role_id,
    u.service_commission_rate
  into responsible
  from public.customer_fixed_schedules s
  join public.customers c on c.id = s.customer_id and c.deleted_at is null
  join public.users u on u.id = s.responsible_user_id and u.is_active and u.deleted_at is null
  where s.customer_id = target_customer_id and s.is_active
  for update of s, c, u;
  if not found then
    raise exception using errcode = '22023', message = 'FIXED_MONTH_CUSTOMER_NOT_FOUND';
  end if;
  schedule_price := responsible.monthly_price;
  if not manager_view and responsible.id <> actor_user_id then
    raise exception using errcode = '42501', message = 'FIXED_MONTH_FORBIDDEN';
  end if;

  uses_basis_points := not manager_view;
  payment_count := jsonb_array_length(payment_items);
  for item_index in 0..payment_count - 1 loop
    payment_item := payment_items->item_index;
    if jsonb_typeof(payment_item) <> 'object'
      or not (payment_item ? 'paymentMethodId')
      or ((payment_item ? 'amount') = (payment_item ? 'basisPoints')) then
      raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
    end if;
    if uses_basis_points <> (payment_item ? 'basisPoints') then
      raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
    end if;
    perform 1 from public.payment_methods pm
    where pm.id = (payment_item->>'paymentMethodId')::uuid and pm.is_active
    for share;
    if not found then
      raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_NOT_AVAILABLE';
    end if;
    if uses_basis_points then
      if (payment_item->>'basisPoints')::integer not between 0 and 10000 then
        raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
      end if;
      basis_total := basis_total + (payment_item->>'basisPoints')::integer;
    else
      if (payment_item->>'amount')::bigint <= 0 then
        raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
      end if;
      payment_total := payment_total + (payment_item->>'amount')::bigint;
    end if;
  end loop;

  if (select count(distinct item->>'paymentMethodId') from jsonb_array_elements(payment_items) item) <> payment_count
    or (uses_basis_points and basis_total <> 10000)
    or (not uses_basis_points and payment_total <> schedule_price) then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
  end if;

  fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    jsonb_build_object(
      'customerId', target_customer_id,
      'period', target_period,
      'payments', (select jsonb_agg(item order by item->>'paymentMethodId') from jsonb_array_elements(payment_items) item)
    )::text, 'UTF8'
  ), 'sha256'), 'hex');

  if existing_income.id is not null then
    if existing_income.request_fingerprint <> fingerprint
      or existing_income.fixed_customer_id <> target_customer_id
      or existing_income.fixed_period <> target_period then
      raise exception using errcode = 'P0001', message = 'INCOME_REQUEST_CONFLICT';
    end if;
    return public.get_fixed_customer_month(actor_user_id, manager_view, target_customer_id, target_period);
  end if;

  if exists (
    select 1 from public.fixed_customer_monthly_payment_attempts
    where customer_id = target_customer_id and period = target_period and status = 'paid'
  ) then
    raise exception using errcode = 'P0001', message = 'FIXED_MONTH_ALREADY_PAID';
  end if;

  commission_amount := round(schedule_price::numeric * responsible.service_commission_rate / 100)::integer;
  net_amount := schedule_price - commission_amount;

  insert into public.incomes (
    request_id, registered_by, employee_id, responsible_role_snapshot,
    request_fingerprint, customer_id, payment_method, total, gross_total,
    service_commission_base, product_commission_base,
    service_commission_rate, product_commission_rate,
    service_commission_amount, product_commission_amount,
    commission_total, barbershop_net, full_service_commission,
    source_type, fixed_customer_id, fixed_period, subscription_concept,
    status, created_at, business_date
  ) values (
    income_request_id, actor_user_id, responsible.id,
    case responsible.role_id when 1 then 'owner' when 2 then 'admin' else 'employee' end,
    fingerprint, target_customer_id, null, schedule_price, schedule_price,
    schedule_price, 0, responsible.service_commission_rate, 0,
    commission_amount, 0, commission_amount, net_amount, false,
    'fixed_subscription', target_customer_id, target_period,
    jsonb_build_object('period', target_period, 'monthlyPrice', schedule_price),
    'active', sale_created_at, sale_business_date
  ) returning id into created_income_id;

  for item_index in 0..payment_count - 1 loop
    payment_item := payment_items->item_index;
    if uses_basis_points then
      if item_index = payment_count - 1 then
        allocation := schedule_price - allocated;
      else
        allocation := schedule_price::bigint * (payment_item->>'basisPoints')::integer / 10000;
      end if;
      allocated := allocated + allocation;
    else
      allocation := (payment_item->>'amount')::bigint;
    end if;
    if allocation > 0 then
      insert into public.income_payments (
        income_id, payment_method_id, method_name_snapshot, amount, basis_points, created_at
      )
      select created_income_id, pm.id, pm.name, allocation,
        case when uses_basis_points then (payment_item->>'basisPoints')::integer else null end,
        sale_created_at
      from public.payment_methods pm
      where pm.id = (payment_item->>'paymentMethodId')::uuid and pm.is_active;
    end if;
  end loop;

  insert into public.fixed_customer_monthly_payment_attempts (
    customer_id, period, request_id, registered_by, income_id, status, paid_at
  ) values (
    target_customer_id, target_period, income_request_id, actor_user_id,
    created_income_id, 'paid', sale_created_at
  );

  response := jsonb_build_object(
    'customer', jsonb_build_object(
      'id', target_customer_id,
      'firstName', (select first_name from public.customers where id = target_customer_id),
      'lastName', (select last_name from public.customers where id = target_customer_id)
    ),
    'responsibleProfessional', jsonb_build_object(
      'id', responsible.id, 'firstName', responsible.first_name, 'lastName', responsible.last_name
    ),
    'period', target_period, 'status', 'paid', 'paidAt', sale_created_at,
    'incomeId', created_income_id, 'employeeEarning', commission_amount,
    'viewer', case when manager_view then 'manager' else 'employee' end
  );
  if manager_view then response := response || jsonb_build_object('monthlyPrice', schedule_price); end if;
  return response;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
end;
$$;

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
  manager_view boolean;
  projection jsonb;
begin
  select r.name into actor_role
  from public.users u join public.roles r on r.id = u.role_id
  where u.id = actor_user_id and u.is_active and u.deleted_at is null;
  if not found then raise exception using errcode = '22023', message = 'INVALID_ACTOR'; end if;
  manager_view := actor_role in ('owner', 'admin') and can_view_all;

  select jsonb_build_object(
    'customer', jsonb_build_object('id', c.id, 'firstName', c.first_name, 'lastName', c.last_name),
    'responsibleProfessional', jsonb_build_object('id', responsible.id, 'firstName', responsible.first_name, 'lastName', responsible.last_name),
    'period', target_period,
    'status', case when paid.id is null then 'pending' else 'paid' end,
    'paidAt', paid.paid_at,
    'incomeId', paid.income_id,
    'employeeEarning', coalesce(i.commission_total, 0),
    'viewer', case when manager_view then 'manager' else 'employee' end
  ) || case when manager_view then jsonb_build_object('monthlyPrice', coalesce(i.total, s.monthly_price)) else '{}'::jsonb end
  into projection
  from public.customer_fixed_schedules s
  join public.customers c on c.id = s.customer_id and c.deleted_at is null
  left join public.fixed_customer_monthly_payment_attempts paid
    on paid.customer_id = s.customer_id and paid.period = target_period and paid.status = 'paid'
  left join public.incomes i on i.id = paid.income_id and i.status = 'active'
  join public.users responsible on responsible.id = coalesce(i.employee_id, s.responsible_user_id)
  where s.customer_id = target_customer_id and s.is_active
    and (manager_view or coalesce(i.employee_id, s.responsible_user_id) = actor_user_id);
  return projection;
end;
$$;

create or replace function public.sync_fixed_customer_payment_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'active' and new.status = 'voided' and new.source_type = 'fixed_subscription' then
    update public.fixed_customer_monthly_payment_attempts
    set status = 'voided', voided_at = new.voided_at, voided_by = new.voided_by
    where income_id = new.id and status = 'paid';
  end if;
  return new;
end;
$$;

drop trigger if exists incomes_sync_fixed_customer_payment_void on public.incomes;
create trigger incomes_sync_fixed_customer_payment_void
after update of status on public.incomes
for each row execute function public.sync_fixed_customer_payment_void();

revoke execute on function public.list_fixed_customer_months(uuid, boolean, text, uuid) from public, anon, authenticated;
revoke execute on function public.pay_fixed_customer_month(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.get_fixed_customer_month(uuid, boolean, uuid, text) from public, anon, authenticated;
revoke execute on function public.sync_fixed_customer_payment_void() from public, anon, authenticated, service_role;
grant execute on function public.list_fixed_customer_months(uuid, boolean, text, uuid) to service_role;
grant execute on function public.pay_fixed_customer_month(uuid, uuid, uuid, text, jsonb) to service_role;
grant execute on function public.get_fixed_customer_month(uuid, boolean, uuid, text) to service_role;

notify pgrst, 'reload schema';
commit;
