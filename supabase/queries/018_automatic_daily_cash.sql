-- Bastardos Barberia: automatic daily cash closures and audited adjustments.
-- Run after 017_product_category_deletion.sql as one complete migration.

begin;

create table public.daily_cash_registers (
  id uuid primary key default extensions.gen_random_uuid(),
  business_date date not null unique,
  sales_gross_total bigint not null,
  sales_commission_total bigint not null,
  sales_barbershop_net bigint not null,
  service_sales_total bigint not null,
  product_sales_total bigint not null,
  adjustment_gross_total bigint not null default 0,
  adjustment_commission_total bigint not null default 0,
  adjustment_barbershop_net bigint not null default 0,
  service_adjustment_total bigint not null default 0,
  product_adjustment_total bigint not null default 0,
  sale_count integer not null,
  active_sale_count integer not null,
  voided_sale_count integer not null,
  adjustment_count integer not null default 0,
  closed_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint daily_cash_sales_amounts_check check (
    sales_gross_total >= 0
    and sales_commission_total >= 0
    and sales_barbershop_net >= 0
    and sales_barbershop_net + sales_commission_total = sales_gross_total
    and service_sales_total >= 0
    and product_sales_total >= 0
    and service_sales_total + product_sales_total = sales_gross_total
  ),
  constraint daily_cash_adjustment_amounts_check check (
    adjustment_gross_total <= 0
    and adjustment_commission_total <= 0
    and adjustment_barbershop_net <= 0
    and adjustment_barbershop_net + adjustment_commission_total = adjustment_gross_total
    and service_adjustment_total <= 0
    and product_adjustment_total <= 0
    and service_adjustment_total + product_adjustment_total = adjustment_gross_total
  ),
  constraint daily_cash_counts_check check (
    sale_count >= 0
    and active_sale_count >= 0
    and voided_sale_count >= 0
    and active_sale_count + voided_sale_count = sale_count
    and adjustment_count >= 0
    and sale_count + adjustment_count > 0
  )
);

create index daily_cash_registers_business_date_idx
  on public.daily_cash_registers(business_date desc);

create table public.daily_cash_sales (
  id uuid primary key default extensions.gen_random_uuid(),
  daily_cash_id uuid not null references public.daily_cash_registers(id) on delete restrict,
  income_id uuid not null unique references public.incomes(id) on delete restrict,
  employee_id uuid not null references public.users(id) on delete restrict,
  employee_first_name_snapshot text not null,
  employee_last_name_snapshot text not null,
  customer_name_snapshot text,
  kind text not null,
  status_at_close text not null,
  gross_total bigint not null,
  commission_total bigint not null,
  barbershop_net bigint not null,
  service_total bigint not null,
  product_total bigint not null,
  created_at_snapshot timestamptz not null,
  constraint daily_cash_sales_kind_check check (kind in ('service', 'products', 'combined')),
  constraint daily_cash_sales_status_check check (status_at_close in ('active', 'voided')),
  constraint daily_cash_sales_economics_check check (
    gross_total > 0
    and commission_total >= 0
    and barbershop_net >= 0
    and commission_total + barbershop_net = gross_total
    and service_total >= 0
    and product_total >= 0
    and service_total + product_total = gross_total
  )
);

create index daily_cash_sales_cash_created_idx
  on public.daily_cash_sales(daily_cash_id, created_at_snapshot desc);

create table public.daily_cash_payment_totals (
  id uuid primary key default extensions.gen_random_uuid(),
  daily_cash_id uuid not null references public.daily_cash_registers(id) on delete restrict,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  method_name_snapshot text not null,
  sales_amount bigint not null,
  adjustment_amount bigint not null default 0,
  net_amount bigint generated always as (sales_amount + adjustment_amount) stored,
  constraint daily_cash_payment_totals_key unique (
    daily_cash_id, payment_method_id, method_name_snapshot
  ),
  constraint daily_cash_payment_sales_check check (sales_amount >= 0),
  constraint daily_cash_payment_adjustment_check check (adjustment_amount <= 0),
  constraint daily_cash_payment_name_check check (char_length(trim(method_name_snapshot)) between 1 and 80)
);

create table public.daily_cash_adjustments (
  id uuid primary key default extensions.gen_random_uuid(),
  business_date date not null,
  source_income_id uuid not null references public.incomes(id) on delete restrict,
  original_daily_cash_id uuid not null references public.daily_cash_registers(id) on delete restrict,
  created_by uuid not null references public.users(id) on delete restrict,
  created_by_first_name_snapshot text not null,
  created_by_last_name_snapshot text not null,
  gross_delta bigint not null,
  commission_delta bigint not null,
  barbershop_net_delta bigint not null,
  service_delta bigint not null,
  product_delta bigint not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint daily_cash_adjustments_source_key unique (source_income_id),
  constraint daily_cash_adjustment_economics_check check (
    gross_delta < 0
    and commission_delta <= 0
    and barbershop_net_delta <= 0
    and commission_delta + barbershop_net_delta = gross_delta
    and service_delta <= 0
    and product_delta <= 0
    and service_delta + product_delta = gross_delta
  )
);

create index daily_cash_adjustments_business_date_idx
  on public.daily_cash_adjustments(business_date desc, created_at desc);

create table public.daily_cash_adjustment_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  adjustment_id uuid not null references public.daily_cash_adjustments(id) on delete restrict,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  method_name_snapshot text not null,
  amount bigint not null,
  constraint daily_cash_adjustment_payments_key unique (adjustment_id, payment_method_id),
  constraint daily_cash_adjustment_payment_amount_check check (amount < 0),
  constraint daily_cash_adjustment_payment_name_check check (char_length(trim(method_name_snapshot)) between 1 and 80)
);

alter table public.daily_cash_registers enable row level security;
alter table public.daily_cash_sales enable row level security;
alter table public.daily_cash_payment_totals enable row level security;
alter table public.daily_cash_adjustments enable row level security;
alter table public.daily_cash_adjustment_payments enable row level security;

revoke all on table public.daily_cash_registers from public, anon, authenticated;
revoke all on table public.daily_cash_sales from public, anon, authenticated;
revoke all on table public.daily_cash_payment_totals from public, anon, authenticated;
revoke all on table public.daily_cash_adjustments from public, anon, authenticated;
revoke all on table public.daily_cash_adjustment_payments from public, anon, authenticated;

grant select, insert on table public.daily_cash_registers to service_role;
grant select, insert on table public.daily_cash_sales to service_role;
grant select, insert on table public.daily_cash_payment_totals to service_role;
grant select, insert on table public.daily_cash_adjustments to service_role;
grant select, insert on table public.daily_cash_adjustment_payments to service_role;

create or replace function public.capture_post_close_cash_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  original_cash_id uuid;
  adjustment_id uuid;
  actor_record record;
  adjustment_date date := (new.voided_at at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not (old.status = 'active' and new.status = 'voided') then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bastardos_daily_cash_close'));

  select id into original_cash_id
  from public.daily_cash_registers
  where business_date = old.business_date;

  if original_cash_id is null then
    return new;
  end if;

  select first_name, last_name into actor_record
  from public.users
  where id = new.voided_by;

  insert into public.daily_cash_adjustments (
    business_date, source_income_id, original_daily_cash_id, created_by,
    created_by_first_name_snapshot, created_by_last_name_snapshot,
    gross_delta, commission_delta, barbershop_net_delta,
    service_delta, product_delta, created_at
  ) values (
    adjustment_date, new.id, original_cash_id, new.voided_by,
    actor_record.first_name, actor_record.last_name,
    -new.total::bigint, -new.commission_total::bigint, -new.barbershop_net::bigint,
    -new.service_commission_base::bigint, -new.product_commission_base::bigint,
    new.voided_at
  )
  on conflict (source_income_id) do nothing
  returning id into adjustment_id;

  if adjustment_id is not null then
    insert into public.daily_cash_adjustment_payments (
      adjustment_id, payment_method_id, method_name_snapshot, amount
    )
    select adjustment_id, ip.payment_method_id, ip.method_name_snapshot, -ip.amount
    from public.income_payments ip
    where ip.income_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists incomes_capture_post_close_cash_void on public.incomes;
create trigger incomes_capture_post_close_cash_void
after update of status on public.incomes
for each row
execute function public.capture_post_close_cash_void();

create or replace function public.close_pending_daily_cash()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_today date := (pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
  target_date date;
  created_cash_id uuid;
  created_count integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bastardos_daily_cash_close'));

  for target_date in
    select candidate.business_date
    from (
      select i.business_date from public.incomes i where i.business_date < local_today
      union
      select a.business_date from public.daily_cash_adjustments a where a.business_date < local_today
    ) candidate
    where not exists (
      select 1 from public.daily_cash_registers cash
      where cash.business_date = candidate.business_date
    )
    order by candidate.business_date
  loop
    with sale_totals as (
      select
        coalesce(sum(i.total) filter (where i.status = 'active'), 0)::bigint as gross,
        coalesce(sum(i.commission_total) filter (where i.status = 'active'), 0)::bigint as commission,
        coalesce(sum(i.barbershop_net) filter (where i.status = 'active'), 0)::bigint as net,
        coalesce(sum(i.service_commission_base) filter (where i.status = 'active'), 0)::bigint as service,
        coalesce(sum(i.product_commission_base) filter (where i.status = 'active'), 0)::bigint as product,
        count(*)::integer as sale_count,
        (count(*) filter (where i.status = 'active'))::integer as active_count,
        (count(*) filter (where i.status = 'voided'))::integer as voided_count
      from public.incomes i
      where i.business_date = target_date
    ), adjustment_totals as (
      select
        coalesce(sum(a.gross_delta), 0)::bigint as gross,
        coalesce(sum(a.commission_delta), 0)::bigint as commission,
        coalesce(sum(a.barbershop_net_delta), 0)::bigint as net,
        coalesce(sum(a.service_delta), 0)::bigint as service,
        coalesce(sum(a.product_delta), 0)::bigint as product,
        count(*)::integer as adjustment_count
      from public.daily_cash_adjustments a
      where a.business_date = target_date
    )
    insert into public.daily_cash_registers (
      business_date,
      sales_gross_total, sales_commission_total, sales_barbershop_net,
      service_sales_total, product_sales_total,
      adjustment_gross_total, adjustment_commission_total, adjustment_barbershop_net,
      service_adjustment_total, product_adjustment_total,
      sale_count, active_sale_count, voided_sale_count, adjustment_count
    )
    select
      target_date,
      s.gross, s.commission, s.net, s.service, s.product,
      a.gross, a.commission, a.net, a.service, a.product,
      s.sale_count, s.active_count, s.voided_count, a.adjustment_count
    from sale_totals s cross join adjustment_totals a
    returning id into created_cash_id;

    insert into public.daily_cash_sales (
      daily_cash_id, income_id, employee_id,
      employee_first_name_snapshot, employee_last_name_snapshot,
      customer_name_snapshot, kind, status_at_close,
      gross_total, commission_total, barbershop_net,
      service_total, product_total, created_at_snapshot
    )
    select
      created_cash_id, i.id, employee.id,
      employee.first_name, employee.last_name,
      case when customer.id is null then null
        else trim(customer.first_name || ' ' || customer.last_name) end,
      case
        when i.service_commission_base > 0 and i.product_commission_base > 0 then 'combined'
        when i.service_commission_base > 0 then 'service'
        else 'products'
      end,
      i.status, i.total, i.commission_total, i.barbershop_net,
      i.service_commission_base, i.product_commission_base, i.created_at
    from public.incomes i
    join public.users employee on employee.id = i.employee_id
    left join public.customers customer on customer.id = i.customer_id
    where i.business_date = target_date;

    with method_movements as (
      select
        ip.payment_method_id,
        ip.method_name_snapshot,
        ip.amount::bigint as sales_amount,
        0::bigint as adjustment_amount
      from public.income_payments ip
      join public.incomes i on i.id = ip.income_id
      where i.business_date = target_date and i.status = 'active'
      union all
      select
        ap.payment_method_id,
        ap.method_name_snapshot,
        0::bigint,
        ap.amount
      from public.daily_cash_adjustment_payments ap
      join public.daily_cash_adjustments a on a.id = ap.adjustment_id
      where a.business_date = target_date
    )
    insert into public.daily_cash_payment_totals (
      daily_cash_id, payment_method_id, method_name_snapshot,
      sales_amount, adjustment_amount
    )
    select
      created_cash_id,
      movement.payment_method_id,
      movement.method_name_snapshot,
      sum(movement.sales_amount),
      sum(movement.adjustment_amount)
    from method_movements movement
    group by movement.payment_method_id, movement.method_name_snapshot;

    created_count := created_count + 1;
  end loop;

  return created_count;
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
  result jsonb;
begin
  if is_live then
    with sale_totals as (
      select
        coalesce(sum(i.total) filter (where i.status = 'active'), 0)::bigint as sales_gross,
        coalesce(sum(i.commission_total) filter (where i.status = 'active'), 0)::bigint as sales_commission,
        coalesce(sum(i.barbershop_net) filter (where i.status = 'active'), 0)::bigint as sales_net,
        coalesce(sum(i.service_commission_base) filter (where i.status = 'active'), 0)::bigint as service_sales,
        coalesce(sum(i.product_commission_base) filter (where i.status = 'active'), 0)::bigint as product_sales,
        count(*)::integer as sale_count,
        (count(*) filter (where i.status = 'active'))::integer as active_count,
        (count(*) filter (where i.status = 'voided'))::integer as voided_count
      from public.incomes i where i.business_date = target_business_date
    ), adjustment_totals as (
      select
        coalesce(sum(a.gross_delta), 0)::bigint as adjustment_gross,
        coalesce(sum(a.commission_delta), 0)::bigint as adjustment_commission,
        coalesce(sum(a.barbershop_net_delta), 0)::bigint as adjustment_net,
        coalesce(sum(a.service_delta), 0)::bigint as service_adjustment,
        coalesce(sum(a.product_delta), 0)::bigint as product_adjustment,
        count(*)::integer as adjustment_count
      from public.daily_cash_adjustments a where a.business_date = target_business_date
    ), payment_totals as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'paymentMethodId', movements.payment_method_id,
        'name', movements.method_name,
        'salesAmount', movements.sales_amount,
        'adjustmentAmount', movements.adjustment_amount,
        'netAmount', movements.sales_amount + movements.adjustment_amount
      ) order by movements.method_name), '[]'::jsonb) as items
      from (
        select payment_method_id, method_name_snapshot as method_name,
          sum(sales_amount)::bigint as sales_amount,
          sum(adjustment_amount)::bigint as adjustment_amount
        from (
          select ip.payment_method_id, ip.method_name_snapshot,
            ip.amount::bigint as sales_amount, 0::bigint as adjustment_amount
          from public.income_payments ip
          join public.incomes i on i.id = ip.income_id
          where i.business_date = target_business_date and i.status = 'active'
          union all
          select ap.payment_method_id, ap.method_name_snapshot,
            0::bigint, ap.amount
          from public.daily_cash_adjustment_payments ap
          join public.daily_cash_adjustments a on a.id = ap.adjustment_id
          where a.business_date = target_business_date
        ) raw_movements
        group by payment_method_id, method_name_snapshot
      ) movements
    ), sales_json as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id,
        'createdAt', i.created_at,
        'employee', jsonb_build_object('id', employee.id, 'firstName', employee.first_name, 'lastName', employee.last_name),
        'customerName', case when customer.id is null then null else trim(customer.first_name || ' ' || customer.last_name) end,
        'kind', case when i.service_commission_base > 0 and i.product_commission_base > 0 then 'combined'
          when i.service_commission_base > 0 then 'service' else 'products' end,
        'statusAtClose', i.status,
        'currentStatus', i.status,
        'grossTotal', i.total,
        'commissionTotal', i.commission_total,
        'barbershopNet', i.barbershop_net
      ) order by i.created_at desc, i.id), '[]'::jsonb) as items
      from public.incomes i
      join public.users employee on employee.id = i.employee_id
      left join public.customers customer on customer.id = i.customer_id
      where i.business_date = target_business_date
    ), adjustments_json as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'sourceIncomeId', a.source_income_id,
        'originalBusinessDate', original.business_date,
        'createdAt', a.created_at,
        'createdBy', jsonb_build_object('id', a.created_by, 'firstName', a.created_by_first_name_snapshot, 'lastName', a.created_by_last_name_snapshot),
        'grossDelta', a.gross_delta,
        'commissionDelta', a.commission_delta,
        'barbershopNetDelta', a.barbershop_net_delta
      ) order by a.created_at desc, a.id), '[]'::jsonb) as items
      from public.daily_cash_adjustments a
      join public.daily_cash_registers original on original.id = a.original_daily_cash_id
      where a.business_date = target_business_date
    )
    select jsonb_build_object(
      'id', null,
      'businessDate', target_business_date,
      'state', 'live',
      'closedAt', null,
      'summary', jsonb_build_object(
        'salesGrossTotal', s.sales_gross,
        'salesCommissionTotal', s.sales_commission,
        'salesBarbershopNet', s.sales_net,
        'adjustmentGrossTotal', a.adjustment_gross,
        'adjustmentCommissionTotal', a.adjustment_commission,
        'adjustmentBarbershopNet', a.adjustment_net,
        'grossTotal', s.sales_gross + a.adjustment_gross,
        'commissionTotal', s.sales_commission + a.adjustment_commission,
        'barbershopNet', s.sales_net + a.adjustment_net,
        'serviceTotal', s.service_sales + a.service_adjustment,
        'productTotal', s.product_sales + a.product_adjustment,
        'saleCount', s.sale_count,
        'activeSaleCount', s.active_count,
        'voidedSaleCount', s.voided_count,
        'adjustmentCount', a.adjustment_count
      ),
      'payments', p.items,
      'sales', sj.items,
      'adjustments', aj.items
    ) into result
    from sale_totals s cross join adjustment_totals a
      cross join payment_totals p cross join sales_json sj cross join adjustments_json aj;
  else
    select jsonb_build_object(
      'id', cash.id,
      'businessDate', cash.business_date,
      'state', 'closed',
      'closedAt', cash.closed_at,
      'summary', jsonb_build_object(
        'salesGrossTotal', cash.sales_gross_total,
        'salesCommissionTotal', cash.sales_commission_total,
        'salesBarbershopNet', cash.sales_barbershop_net,
        'adjustmentGrossTotal', cash.adjustment_gross_total,
        'adjustmentCommissionTotal', cash.adjustment_commission_total,
        'adjustmentBarbershopNet', cash.adjustment_barbershop_net,
        'grossTotal', cash.sales_gross_total + cash.adjustment_gross_total,
        'commissionTotal', cash.sales_commission_total + cash.adjustment_commission_total,
        'barbershopNet', cash.sales_barbershop_net + cash.adjustment_barbershop_net,
        'serviceTotal', cash.service_sales_total + cash.service_adjustment_total,
        'productTotal', cash.product_sales_total + cash.product_adjustment_total,
        'saleCount', cash.sale_count,
        'activeSaleCount', cash.active_sale_count,
        'voidedSaleCount', cash.voided_sale_count,
        'adjustmentCount', cash.adjustment_count
      ),
      'payments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'paymentMethodId', p.payment_method_id,
          'name', p.method_name_snapshot,
          'salesAmount', p.sales_amount,
          'adjustmentAmount', p.adjustment_amount,
          'netAmount', p.net_amount
        ) order by p.method_name_snapshot)
        from public.daily_cash_payment_totals p where p.daily_cash_id = cash.id
      ), '[]'::jsonb),
      'sales', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.income_id,
          'createdAt', s.created_at_snapshot,
          'employee', jsonb_build_object('id', s.employee_id, 'firstName', s.employee_first_name_snapshot, 'lastName', s.employee_last_name_snapshot),
          'customerName', s.customer_name_snapshot,
          'kind', s.kind,
          'statusAtClose', s.status_at_close,
          'currentStatus', i.status,
          'grossTotal', s.gross_total,
          'commissionTotal', s.commission_total,
          'barbershopNet', s.barbershop_net
        ) order by s.created_at_snapshot desc, s.income_id)
        from public.daily_cash_sales s
        join public.incomes i on i.id = s.income_id
        where s.daily_cash_id = cash.id
      ), '[]'::jsonb),
      'adjustments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id,
          'sourceIncomeId', a.source_income_id,
          'originalBusinessDate', original.business_date,
          'createdAt', a.created_at,
          'createdBy', jsonb_build_object('id', a.created_by, 'firstName', a.created_by_first_name_snapshot, 'lastName', a.created_by_last_name_snapshot),
          'grossDelta', a.gross_delta,
          'commissionDelta', a.commission_delta,
          'barbershopNetDelta', a.barbershop_net_delta
        ) order by a.created_at desc, a.id)
        from public.daily_cash_adjustments a
        join public.daily_cash_registers original on original.id = a.original_daily_cash_id
        where a.business_date = cash.business_date
      ), '[]'::jsonb)
    ) into result
    from public.daily_cash_registers cash
    where cash.id = target_cash_id;
  end if;

  return result;
end;
$$;

create or replace function public.get_daily_cash(
  requesting_user_id uuid,
  target_business_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_today date := (pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
  cash_id uuid;
begin
  if not exists (
    select 1 from public.users
    where id = requesting_user_id and role_id in (1, 2)
      and is_active and deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;

  if target_business_date is null or target_business_date > local_today then
    raise exception using errcode = '22023', message = 'INVALID_CASH_DATE';
  end if;

  if target_business_date = local_today then
    return public.cash_day_as_json(target_business_date, null, true);
  end if;

  perform public.close_pending_daily_cash();

  select id into cash_id from public.daily_cash_registers
  where business_date = target_business_date;

  if cash_id is null then
    return null;
  end if;

  return public.cash_day_as_json(target_business_date, cash_id, false);
end;
$$;

create or replace function public.list_daily_cash(
  requesting_user_id uuid,
  filter_date_from date,
  filter_date_to date,
  page_number integer,
  page_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_page_size integer := least(greatest(coalesce(page_size, 12), 1), 100);
  total_count integer;
  result jsonb;
begin
  if not exists (
    select 1 from public.users
    where id = requesting_user_id and role_id in (1, 2)
      and is_active and deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;

  if filter_date_from is not null and filter_date_to is not null
    and filter_date_from > filter_date_to then
    raise exception using errcode = '22023', message = 'INVALID_CASH_DATE_RANGE';
  end if;

  perform public.close_pending_daily_cash();

  select count(*)::integer into total_count
  from public.daily_cash_registers cash
  where (filter_date_from is null or cash.business_date >= filter_date_from)
    and (filter_date_to is null or cash.business_date <= filter_date_to);

  select jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', page.id,
      'businessDate', page.business_date,
      'state', 'closed',
      'closedAt', page.closed_at,
      'summary', jsonb_build_object(
        'salesGrossTotal', page.sales_gross_total,
        'salesCommissionTotal', page.sales_commission_total,
        'salesBarbershopNet', page.sales_barbershop_net,
        'adjustmentGrossTotal', page.adjustment_gross_total,
        'adjustmentCommissionTotal', page.adjustment_commission_total,
        'adjustmentBarbershopNet', page.adjustment_barbershop_net,
        'grossTotal', page.sales_gross_total + page.adjustment_gross_total,
        'commissionTotal', page.sales_commission_total + page.adjustment_commission_total,
        'barbershopNet', page.sales_barbershop_net + page.adjustment_barbershop_net,
        'serviceTotal', page.service_sales_total + page.service_adjustment_total,
        'productTotal', page.product_sales_total + page.product_adjustment_total,
        'saleCount', page.sale_count,
        'activeSaleCount', page.active_sale_count,
        'voidedSaleCount', page.voided_sale_count,
        'adjustmentCount', page.adjustment_count
      )
    ) order by page.business_date desc), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', safe_page,
      'pageSize', safe_page_size,
      'total', total_count,
      'totalPages', case when total_count = 0 then 0
        else ceiling(total_count::numeric / safe_page_size)::integer end
    )
  ) into result
  from (
    select cash.*
    from public.daily_cash_registers cash
    where (filter_date_from is null or cash.business_date >= filter_date_from)
      and (filter_date_to is null or cash.business_date <= filter_date_to)
    order by cash.business_date desc
    limit safe_page_size offset (safe_page - 1) * safe_page_size
  ) page;

  return result;
end;
$$;

revoke execute on function public.capture_post_close_cash_void() from public, anon, authenticated;
revoke execute on function public.close_pending_daily_cash() from public, anon, authenticated;
revoke execute on function public.cash_day_as_json(date, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.get_daily_cash(uuid, date) from public, anon, authenticated;
revoke execute on function public.list_daily_cash(uuid, date, date, integer, integer) from public, anon, authenticated;

grant execute on function public.close_pending_daily_cash() to service_role;
grant execute on function public.get_daily_cash(uuid, date) to service_role;
grant execute on function public.list_daily_cash(uuid, date, date, integer, integer) to service_role;

do $cron_setup$
declare
  existing_job_id bigint;
begin
  -- Supabase permits pg_cron only in its managed `postgres` database. Skip the
  -- scheduler in disposable databases while still installing every cash RPC.
  if current_database() <> 'postgres' then
    raise notice 'Skipping pg_cron setup outside the postgres database';
    return;
  end if;

  execute 'create extension if not exists pg_cron';

  execute 'select jobid from cron.job where jobname = $1'
    into existing_job_id
    using 'bastardos-close-daily-cash';

  if existing_job_id is not null then
    execute 'select cron.unschedule($1)' using existing_job_id;
  end if;

  execute 'select cron.schedule($1, $2, $3)'
    using
      'bastardos-close-daily-cash',
      '0 * * * *',
      'select public.close_pending_daily_cash();';
end;
$cron_setup$;

notify pgrst, 'reload schema';

commit;

-- Manual acceptance scenario (run only in an isolated test project):
-- begin;
-- 1. Create one split-payment active income and one same-day voided income.
-- 2. Advance their business_date to a past date, call close_pending_daily_cash()
--    twice and assert one register with unchanged totals.
-- 3. Void the formerly active income and assert exactly one adjustment with
--    negative sale/payment snapshots on the local void date.
-- rollback;
