-- Bastardos Barberia: dynamic payment methods, exact allocations and method metrics.
-- Run after 015_product_item_commissions.sql as one complete migration.

begin;

-- Repair installations where the canonical sale RPC was promoted before its
-- immutable responsible-role snapshot column had been installed.
alter table public.incomes
  add column if not exists responsible_role_snapshot text;

update public.incomes i
set responsible_role_snapshot = case responsible.role_id
  when 1 then 'owner'
  when 2 then 'admin'
  when 3 then 'employee'
end
from public.users responsible
where responsible.id = i.employee_id
  and i.responsible_role_snapshot is null;

alter table public.incomes
  alter column responsible_role_snapshot set not null;

alter table public.incomes
  drop constraint if exists incomes_responsible_role_snapshot_check;

alter table public.incomes
  add constraint incomes_responsible_role_snapshot_check check (
    responsible_role_snapshot in ('owner', 'admin', 'employee')
  );

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id)
);

alter table public.payment_methods enable row level security;
revoke all on table public.payment_methods from public, anon, authenticated;
grant select, insert, update on table public.payment_methods to service_role;

-- Seed default payment methods if not present
insert into public.payment_methods (id, name, normalized_name, is_active)
values
  ('60000000-0000-4000-8000-000000000001', 'Efectivo', 'efectivo', true),
  ('60000000-0000-4000-8000-000000000002', 'Transferencia', 'transferencia', true)
on conflict (id) do nothing;

-- Add payment_method_id and method_name_snapshot to income_payments
alter table public.income_payments
  add column if not exists payment_method_id uuid references public.payment_methods(id),
  add column if not exists method_name_snapshot text;

-- Map existing legacy payment rows
update public.income_payments
set payment_method_id = '60000000-0000-4000-8000-000000000001',
    method_name_snapshot = 'Efectivo'
where payment_method_id is null and (method = 'cash' or method is null);

update public.income_payments
set payment_method_id = '60000000-0000-4000-8000-000000000002',
    method_name_snapshot = 'Transferencia'
where payment_method_id is null and method = 'transfer';

alter table public.income_payments
  alter column method drop not null,
  alter column payment_method_id set not null,
  alter column method_name_snapshot set not null;

-- RPC: create_payment_method
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
  actor_role_id smallint;
  clean_name text := trim(coalesce(payment_method_name, ''));
  normalized text;
  created_id uuid;
begin
  select role_id into actor_role_id
  from public.users
  where id = actor_user_id and is_active and deleted_at is null;

  if not found or actor_role_id not in (1, 2) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;

  if length(clean_name) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_METHOD_NAME';
  end if;

  normalized := public.normalize_catalog_name(clean_name);

  if exists (select 1 from public.payment_methods where normalized_name = normalized) then
    raise exception using errcode = '23505', message = 'PAYMENT_METHOD_NAME_EXISTS';
  end if;

  insert into public.payment_methods (name, normalized_name, created_by, updated_by)
  values (clean_name, normalized, actor_user_id, actor_user_id)
  returning id into created_id;

  return created_id;
end;
$$;

-- RPC: update_payment_method
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
  actor_role_id smallint;
  clean_name text;
  normalized text;
  current_record record;
  active_count integer;
begin
  select role_id into actor_role_id
  from public.users
  where id = actor_user_id and is_active and deleted_at is null;

  if not found or actor_role_id not in (1, 2) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;

  select * into current_record
  from public.payment_methods
  where id = target_payment_method_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_NOT_FOUND';
  end if;

  if payment_method_is_active = false and current_record.is_active = true then
    select count(*) into active_count
    from public.payment_methods
    where is_active = true;

    if active_count <= 1 then
      raise exception using errcode = 'P0001', message = 'LAST_ACTIVE_PAYMENT_METHOD';
    end if;
  end if;

  if payment_method_name is not null then
    clean_name := trim(payment_method_name);
    if length(clean_name) not between 1 and 80 then
      raise exception using errcode = '22023', message = 'INVALID_PAYMENT_METHOD_NAME';
    end if;

    normalized := public.normalize_catalog_name(clean_name);
    if normalized <> current_record.normalized_name and exists (
      select 1 from public.payment_methods where normalized_name = normalized
    ) then
      raise exception using errcode = '23505', message = 'PAYMENT_METHOD_NAME_EXISTS';
    end if;
  end if;

  update public.payment_methods
  set name = coalesce(clean_name, name),
      normalized_name = coalesce(normalized, normalized_name),
      is_active = coalesce(payment_method_is_active, is_active),
      updated_by = actor_user_id,
      updated_at = clock_timestamp()
  where id = target_payment_method_id;

  return target_payment_method_id;
end;
$$;

-- RPC: deactivate_payment_method
create or replace function public.deactivate_payment_method(
  actor_user_id uuid,
  target_payment_method_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.update_payment_method(actor_user_id, target_payment_method_id, null, false);
end;
$$;

-- RPC: income_as_json
create or replace function public.income_as_json(
  target_income_id uuid
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
  select jsonb_build_object(
    'id', i.id,
    'createdAt', i.created_at,
    'businessDate', i.business_date,
    'employee', jsonb_build_object(
      'id', employee.id,
      'firstName', employee.first_name,
      'lastName', employee.last_name
    ),
    'registeredBy', jsonb_build_object(
      'id', registrant.id,
      'firstName', registrant.first_name,
      'lastName', registrant.last_name
    ),
    'customer', case when c.id is null then null else jsonb_build_object(
      'id', c.id,
      'firstName', c.first_name,
      'lastName', c.last_name
    ) end,
    'service', (
      select case when ii.id is null then null else jsonb_build_object(
        'id', ii.service_id,
        'name', ii.name_snapshot,
        'price', ii.unit_price,
        'commission', jsonb_build_object(
          'subtotal', ii.line_subtotal,
          'rate', ii.commission_rate,
          'amount', ii.commission_amount,
          'fullCommission', ii.full_commission,
          'authorizedBy', case when item_authorizer.id is null then null
            else jsonb_build_object(
              'id', item_authorizer.id,
              'firstName', item_authorizer.first_name,
              'lastName', item_authorizer.last_name
            ) end
        )
      ) end
      from public.income_items ii
      left join public.users item_authorizer
        on item_authorizer.id = ii.full_commission_authorized_by
      where ii.income_id = i.id and ii.item_type = 'service'
      limit 1
    ),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ii.product_id,
          'name', ii.name_snapshot,
          'unitPrice', ii.unit_price,
          'quantity', ii.quantity,
          'commission', jsonb_build_object(
            'subtotal', ii.line_subtotal,
            'rate', ii.commission_rate,
            'amount', ii.commission_amount,
            'fullCommission', ii.full_commission,
            'authorizedBy', case when item_authorizer.id is null then null
              else jsonb_build_object(
                'id', item_authorizer.id,
                'firstName', item_authorizer.first_name,
                'lastName', item_authorizer.last_name
              ) end
          )
        ) order by ii.created_at, ii.id
      )
      from public.income_items ii
      left join public.users item_authorizer
        on item_authorizer.id = ii.full_commission_authorized_by
      where ii.income_id = i.id and ii.item_type = 'product'
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'paymentMethodId', ip.payment_method_id,
          'methodName', ip.method_name_snapshot,
          'amount', ip.amount
        )
        order by ip.created_at, ip.id
      )
      from public.income_payments ip
      where ip.income_id = i.id
    ), '[]'::jsonb),
    'commission', jsonb_build_object(
      'total', i.commission_total,
      'barbershopNet', i.barbershop_net
    ),
    'total', i.total,
    'status', i.status
  ) into result
  from public.incomes i
  join public.users employee on employee.id = i.employee_id
  join public.users registrant on registrant.id = i.registered_by
  left join public.customers c on c.id = i.customer_id
  where i.id = target_income_id;

  return result;
end;
$$;

-- RPC: create_income (supporting dynamic payment methods)
create or replace function public.create_income(
  actor_user_id uuid,
  responsible_employee_id uuid,
  income_request_id uuid,
  selected_customer_id uuid,
  selected_service_id uuid,
  product_items jsonb,
  payment_items jsonb,
  grant_full_service_commission boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_record record;
  employee_record record;
  effective_employee_id uuid;
  existing_income record;
  created_income_id uuid;
  sale_created_at timestamptz := pg_catalog.clock_timestamp();
  sale_total integer := 0;
  service_base integer := 0;
  product_base integer := 0;
  responsible_role text;
  effective_service_rate smallint;
  effective_product_rate smallint;
  service_amount integer := 0;
  product_amount integer := 0;
  total_commission integer;
  net_amount integer;
  product_line_subtotal integer;
  product_line_rate smallint;
  product_line_amount integer;
  service_record record;
  product_record record;
  payment_method_record record;
  requested_product_count integer;
  found_product_count integer := 0;
  requested_payment_count integer;
  payment_total bigint;
  normalized_products jsonb;
  normalized_payments jsonb;
  fingerprint text;
  full_service boolean := coalesce(grant_full_service_commission, false);
  any_full_product boolean;
begin
  select id, role_id into actor_record
  from public.users
  where id = actor_user_id and is_active and deleted_at is null;

  if not found then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  if income_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  product_items := coalesce(product_items, '[]'::jsonb);
  payment_items := coalesce(payment_items, '[]'::jsonb);

  if jsonb_typeof(product_items) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_PRODUCT_ITEMS';
  end if;
  if jsonb_typeof(payment_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
  end if;

  begin
    select count(*)::integer,
      coalesce(jsonb_agg(item order by item->>'productId'), '[]'::jsonb)
    into requested_product_count, normalized_products
    from jsonb_array_elements(product_items) item
    where (item->>'productId')::uuid is not null
      and (item->>'quantity')::integer > 0;

    if requested_product_count <> jsonb_array_length(product_items)
      or requested_product_count <> (
        select count(distinct (item->>'productId')::uuid)
        from jsonb_array_elements(product_items) item
      )
    then
      raise exception using errcode = '22023', message = 'INVALID_PRODUCT_ITEMS';
    end if;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'INVALID_PRODUCT_ITEMS';
  end;

  begin
    select count(*)::integer,
      coalesce(sum((item->>'amount')::bigint), 0),
      coalesce(jsonb_agg(item order by item->>'paymentMethodId'), '[]'::jsonb)
    into requested_payment_count, payment_total, normalized_payments
    from jsonb_array_elements(payment_items) item
    where (item->>'paymentMethodId')::uuid is not null
      and (item->>'amount')::bigint > 0;

    if requested_payment_count < 1
      or requested_payment_count <> jsonb_array_length(payment_items)
      or requested_payment_count <> (
        select count(distinct (item->>'paymentMethodId')::uuid)
        from jsonb_array_elements(payment_items) item
      )
    then
      raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
    end if;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
  end;

  fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    jsonb_build_object(
      'responsibleEmployeeId', responsible_employee_id,
      'customerId', selected_customer_id,
      'serviceId', selected_service_id,
      'products', normalized_products,
      'payments', normalized_payments,
      'grantFullServiceCommission', full_service
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_user_id::text || ':' || income_request_id::text, 0)
  );

  select id, request_fingerprint into existing_income
  from public.incomes
  where registered_by = actor_user_id and request_id = income_request_id;

  if found then
    if existing_income.request_fingerprint <> fingerprint then
      raise exception using errcode = 'P0001', message = 'INCOME_REQUEST_CONFLICT';
    end if;
    return existing_income.id;
  end if;

  perform 1
  from public.users
  where id = actor_user_id or id = responsible_employee_id
  order by id
  for share;

  select id, role_id into actor_record
  from public.users
  where id = actor_user_id and is_active and deleted_at is null;

  if not found then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  effective_employee_id := case
    when actor_record.role_id = 3 then actor_user_id
    else responsible_employee_id
  end;

  select id, role_id, service_commission_rate, product_commission_rate
  into employee_record
  from public.users
  where id = effective_employee_id and is_active and deleted_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'EMPLOYEE_NOT_ELIGIBLE';
  end if;

  responsible_role := case employee_record.role_id
    when 1 then 'owner'
    when 2 then 'admin'
    when 3 then 'employee'
    else null
  end;
  if responsible_role is null then
    raise exception using errcode = 'P0001', message = 'EMPLOYEE_NOT_ELIGIBLE';
  end if;

  if selected_service_id is not null then
    select id, name, price into service_record
    from public.services
    where id = selected_service_id and is_active and deleted_at is null
    for share;

    if not found then
      raise exception using errcode = 'P0001', message = 'SERVICE_NOT_AVAILABLE';
    end if;
    service_base := service_record.price;
    sale_total := sale_total + service_base;
  end if;

  if selected_service_id is null and requested_product_count = 0 then
    raise exception using errcode = '22023', message = 'INCOME_ITEM_REQUIRED';
  end if;

  for product_record in
    select p.id, p.name, p.price, p.stock, p.is_active, requested.quantity,
      coalesce((requested.item->>'grantFullCommission')::boolean, false) as grant_full_commission
    from public.products p
    join (
      select (item->>'productId')::uuid as product_id,
        (item->>'quantity')::integer as quantity,
        item
      from jsonb_array_elements(product_items) item
    ) requested on requested.product_id = p.id
    order by p.id
    for update of p
  loop
    found_product_count := found_product_count + 1;
    if not product_record.is_active then
      raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_AVAILABLE';
    end if;
    if product_record.stock < product_record.quantity then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK:' || product_record.name;
    end if;

    product_line_subtotal := product_record.price * product_record.quantity;
    product_base := product_base + product_line_subtotal;
  end loop;

  if requested_product_count <> found_product_count then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
  end if;

  sale_total := sale_total + product_base;
  if payment_total <> sale_total then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
  end if;

  -- Validate payment methods
  if (
    select count(*)
    from public.payment_methods pm
    join (
      select (item->>'paymentMethodId')::uuid as method_id
      from jsonb_array_elements(payment_items) item
    ) requested on requested.method_id = pm.id
    where pm.is_active = true
  ) <> requested_payment_count then
    raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_NOT_AVAILABLE';
  end if;

  if selected_customer_id is not null then
    perform 1
    from public.customers
    where id = selected_customer_id and deleted_at is null
    for no key update;

    if not found then
      raise exception using errcode = 'P0001', message = 'CUSTOMER_NOT_FOUND';
    end if;
  end if;

  if full_service and (
    actor_record.role_id not in (1, 2)
    or effective_employee_id = actor_user_id
    or responsible_role = 'owner'
    or service_base = 0
  ) then
    raise exception using errcode = '42501', message = 'INVALID_COMMISSION_OVERRIDE';
  end if;

  effective_service_rate := case
    when responsible_role = 'owner' then 0
    when full_service then 100
    else employee_record.service_commission_rate
  end;
  effective_product_rate := case
    when responsible_role = 'owner' then 0
    else employee_record.product_commission_rate
  end;

  if service_base > 0 then
    service_amount := round(service_base::numeric * effective_service_rate::numeric / 100)::integer;
  end if;

  -- Insert income row
  insert into public.incomes (
    request_id, registered_by, employee_id, responsible_role_snapshot,
    request_fingerprint, customer_id, total,
    service_commission_base, product_commission_base,
    service_commission_rate, product_commission_rate, service_commission_amount,
    product_commission_amount, commission_total, barbershop_net,
    full_service_commission, full_service_commission_authorized_by,
    created_at, business_date
  ) values (
    income_request_id, actor_user_id, effective_employee_id, responsible_role,
    fingerprint, selected_customer_id, sale_total,
    service_base, product_base, effective_service_rate,
    effective_product_rate, 0, 0, 0, sale_total,
    full_service,
    case when full_service then actor_user_id else null end,
    sale_created_at,
    (sale_created_at at time zone 'America/Argentina/Buenos_Aires')::date
  ) returning id into created_income_id;

  if selected_service_id is not null then
    insert into public.income_items (
      income_id, item_type, service_id, name_snapshot, unit_price, quantity,
      line_subtotal, commission_rate, commission_amount, full_commission,
      full_commission_authorized_by, created_at
    ) values (
      created_income_id, 'service', service_record.id, service_record.name,
      service_record.price, 1, service_base, effective_service_rate, service_amount,
      full_service, case when full_service then actor_user_id else null end,
      sale_created_at
    );
  end if;

  for product_record in
    select p.id, p.name, p.price, p.stock, requested.quantity,
      coalesce((requested.item->>'grantFullCommission')::boolean, false) as grant_full_commission
    from public.products p
    join (
      select (item->>'productId')::uuid as product_id,
        (item->>'quantity')::integer as quantity,
        item
      from jsonb_array_elements(product_items) item
    ) requested on requested.product_id = p.id
    order by p.id
  loop
    product_line_subtotal := product_record.price * product_record.quantity;
    product_line_rate := case
      when responsible_role = 'owner' then 0
      when product_record.grant_full_commission then 100
      else effective_product_rate
    end;
    product_line_amount := round(product_line_subtotal::numeric * product_line_rate::numeric / 100)::integer;
    product_amount := product_amount + product_line_amount;

    insert into public.income_items (
      income_id, item_type, product_id, name_snapshot, unit_price, quantity,
      line_subtotal, commission_rate, commission_amount, full_commission,
      full_commission_authorized_by, created_at
    ) values (
      created_income_id, 'product', product_record.id, product_record.name,
      product_record.price, product_record.quantity, product_line_subtotal,
      product_line_rate, product_line_amount, product_record.grant_full_commission,
      case when product_record.grant_full_commission then actor_user_id else null end,
      sale_created_at
    );

    update public.products
    set stock = product_record.stock - product_record.quantity,
        updated_by = actor_user_id
    where id = product_record.id;

    insert into public.inventory_movements (
      product_id, movement_type, quantity_delta, stock_after, user_id, income_id, created_at
    ) values (
      product_record.id, 'sale', -product_record.quantity,
      product_record.stock - product_record.quantity, actor_user_id,
      created_income_id, sale_created_at
    );
  end loop;

  total_commission := service_amount + product_amount;
  net_amount := sale_total - total_commission;

  update public.incomes
  set product_commission_amount = product_amount,
      service_commission_amount = service_amount,
      commission_total = total_commission,
      barbershop_net = net_amount
  where id = created_income_id;

  -- Insert income_payments
  insert into public.income_payments (
    income_id, payment_method_id, method_name_snapshot, amount, created_at
  )
  select created_income_id, pm.id, pm.name, (item->>'amount')::bigint, sale_created_at
  from jsonb_array_elements(payment_items) item
  join public.payment_methods pm on pm.id = (item->>'paymentMethodId')::uuid;

  if selected_customer_id is not null then
    update public.customers
    set visits = visits + 1, updated_by = actor_user_id
    where id = selected_customer_id;
  end if;

  return created_income_id;
end;
$$;

-- RPC: list_incomes (accepting filter_payment_method_id uuid and returning paymentTotals array)
create or replace function public.list_incomes(
  requesting_user_id uuid,
  can_view_all boolean,
  filter_user_id uuid,
  filter_date_from date,
  filter_date_to date,
  filter_payment_method_id uuid,
  filter_kind text,
  filter_status text,
  filter_query text,
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
  requester_role_id smallint;
  effective_can_view_all boolean;
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_page_size integer := least(greatest(coalesce(page_size, 10), 1), 100);
  normalized_query text := public.normalize_catalog_name(coalesce(filter_query, ''));
  result jsonb;
begin
  select role_id into requester_role_id
  from public.users
  where id = requesting_user_id and is_active and deleted_at is null;

  if not found then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  effective_can_view_all := can_view_all and requester_role_id in (1, 2);

  if filter_payment_method_id is not null and not exists (
    select 1 from public.payment_methods where id = filter_payment_method_id
  ) then
    raise exception using errcode = '22023', message = 'INVALID_INCOME_FILTER';
  end if;

  if filter_kind is not null and filter_kind not in ('service', 'products', 'combined') then
    raise exception using errcode = '22023', message = 'INVALID_INCOME_FILTER';
  end if;

  if filter_status is not null and filter_status not in ('active', 'voided') then
    raise exception using errcode = '22023', message = 'INVALID_INCOME_FILTER';
  end if;

  with filtered as materialized (
    select i.*
    from public.incomes i
    join public.users employee on employee.id = i.employee_id
    left join public.customers c on c.id = i.customer_id
    where (effective_can_view_all or i.employee_id = requesting_user_id)
      and (not effective_can_view_all or filter_user_id is null or i.employee_id = filter_user_id)
      and (filter_date_from is null or i.business_date >= filter_date_from)
      and (filter_date_to is null or i.business_date <= filter_date_to)
      and (filter_payment_method_id is null or exists (
        select 1 from public.income_payments ip
        where ip.income_id = i.id and ip.payment_method_id = filter_payment_method_id
      ))
      and (filter_status is null or i.status = filter_status)
      and (
        filter_kind is null
        or (filter_kind = 'service'
          and exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'service')
          and not exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'product'))
        or (filter_kind = 'products'
          and exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'product')
          and not exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'service'))
        or (filter_kind = 'combined'
          and exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'product')
          and exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'service'))
      )
      and (
        normalized_query = ''
        or public.normalize_catalog_name(employee.first_name || ' ' || employee.last_name) like '%' || normalized_query || '%'
        or public.normalize_catalog_name(coalesce(c.first_name || ' ' || c.last_name, '')) like '%' || normalized_query || '%'
        or exists (
          select 1 from public.income_items x
          where x.income_id = i.id
            and public.normalize_catalog_name(x.name_snapshot) like '%' || normalized_query || '%'
        )
      )
  ), totals as (
    select
      count(*)::integer as total_count,
      coalesce(sum(total) filter (where status = 'active'), 0)::bigint as gross_total,
      coalesce(sum(commission_total) filter (where status = 'active'), 0)::bigint as commission_total,
      coalesce(sum(barbershop_net) filter (where status = 'active'), 0)::bigint as barbershop_net,
      (count(*) filter (where status = 'active'))::integer as active_count
    from filtered
  ), payment_totals as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'paymentMethodId', pm.id,
      'name', pm.name,
      'amount', coalesce(sums.amount, 0)::bigint
    ) order by pm.created_at, pm.id), '[]'::jsonb) as totals_json
    from public.payment_methods pm
    left join (
      select ip.payment_method_id, sum(ip.amount) as amount
      from filtered f
      join public.income_payments ip on ip.income_id = f.id
      where f.status = 'active'
      group by ip.payment_method_id
    ) sums on sums.payment_method_id = pm.id
  ), page_rows as (
    select * from filtered
    order by created_at desc, id desc
    offset ((safe_page - 1) * safe_page_size)
    limit safe_page_size
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(public.income_as_json(p.id) order by p.created_at desc, p.id desc)
      from page_rows p
    ), '[]'::jsonb),
    'metrics', jsonb_build_object(
      'grossTotal', totals.gross_total,
      'commissionTotal', totals.commission_total,
      'barbershopNet', totals.barbershop_net,
      'count', totals.active_count,
      'average', case when totals.active_count = 0 then 0 else round(totals.gross_total::numeric / totals.active_count) end,
      'paymentTotals', payment_totals.totals_json
    ),
    'pagination', jsonb_build_object(
      'page', safe_page,
      'pageSize', safe_page_size,
      'total', totals.total_count,
      'totalPages', case when totals.total_count = 0 then 0
        else ceiling(totals.total_count::numeric / safe_page_size)::integer end
    )
  ) into result
  from totals cross join payment_totals;

  return result;
end;
$$;

revoke execute on function public.create_payment_method(uuid, text) from public, anon, authenticated;
revoke execute on function public.update_payment_method(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.deactivate_payment_method(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.create_income(uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.income_as_json(uuid) from public, anon, authenticated;
revoke execute on function public.list_incomes(uuid, boolean, uuid, date, date, uuid, text, text, text, integer, integer) from public, anon, authenticated;

grant execute on function public.create_payment_method(uuid, text) to service_role;
grant execute on function public.update_payment_method(uuid, uuid, text, boolean) to service_role;
grant execute on function public.deactivate_payment_method(uuid, uuid) to service_role;
grant execute on function public.create_income(uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean) to service_role;
grant execute on function public.income_as_json(uuid) to service_role;
grant execute on function public.list_incomes(uuid, boolean, uuid, date, date, uuid, text, text, text, integer, integer) to service_role;

notify pgrst, 'reload schema';

commit;
