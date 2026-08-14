-- Bastardos Barberia: responsible employees, split payments and commission snapshots.
-- Run after 009_sales_domain.sql as one complete migration.

begin;

alter table public.users
  add column if not exists service_commission_rate smallint not null default 0,
  add column if not exists product_commission_rate smallint not null default 0;

alter table public.users
  drop constraint if exists users_service_commission_rate_check,
  drop constraint if exists users_product_commission_rate_check;

alter table public.users
  add constraint users_service_commission_rate_check
    check (service_commission_rate between 0 and 100),
  add constraint users_product_commission_rate_check
    check (product_commission_rate between 0 and 100);

create or replace function public.update_user_profile_v2(
  target_user_id uuid,
  set_first_name boolean,
  new_first_name text,
  set_last_name boolean,
  new_last_name text,
  set_role_id boolean,
  new_role_id smallint,
  set_is_active boolean,
  new_is_active boolean,
  set_service_commission_rate boolean,
  new_service_commission_rate smallint,
  set_product_commission_rate boolean,
  new_product_commission_rate smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role_id smallint;
  current_is_active boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('bastardos_active_owner', 0)
  );

  select role_id, is_active
  into current_role_id, current_is_active
  from public.users
  where id = target_user_id
    and deleted_at is null
  for update;

  if not found then
    return null;
  end if;

  if set_service_commission_rate
    and (new_service_commission_rate is null or new_service_commission_rate not between 0 and 100)
  then
    raise exception using errcode = '22023', message = 'COMMISSION_RATE_OUT_OF_RANGE';
  end if;

  if set_product_commission_rate
    and (new_product_commission_rate is null or new_product_commission_rate not between 0 and 100)
  then
    raise exception using errcode = '22023', message = 'COMMISSION_RATE_OUT_OF_RANGE';
  end if;

  if current_role_id = 1
    and current_is_active
    and (
      (set_role_id and new_role_id <> 1)
      or (set_is_active and new_is_active = false)
    )
    and (
      select count(*)
      from public.users
      where role_id = 1
        and is_active
        and deleted_at is null
    ) <= 1
  then
    raise exception using errcode = 'P0001', message = 'LAST_OWNER_REQUIRED';
  end if;

  update public.users
  set
    first_name = case when set_first_name then new_first_name else first_name end,
    last_name = case when set_last_name then new_last_name else last_name end,
    role_id = case when set_role_id then new_role_id else role_id end,
    is_active = case when set_is_active then new_is_active else is_active end,
    service_commission_rate = case
      when set_service_commission_rate then new_service_commission_rate
      else service_commission_rate
    end,
    product_commission_rate = case
      when set_product_commission_rate then new_product_commission_rate
      else product_commission_rate
    end
  where id = target_user_id
    and deleted_at is null;

  return target_user_id;
end;
$$;

revoke execute on function public.update_user_profile_v2(
  uuid, boolean, text, boolean, text, boolean, smallint, boolean, boolean,
  boolean, smallint, boolean, smallint
) from public, anon, authenticated;

grant execute on function public.update_user_profile_v2(
  uuid, boolean, text, boolean, text, boolean, smallint, boolean, boolean,
  boolean, smallint, boolean, smallint
) to service_role;

-- Separate the authenticated registrant from the responsible employee and
-- retain a semantic request fingerprint for conflict-safe idempotency.
alter table public.incomes
  rename column user_id to registered_by;

alter table public.incomes
  add column if not exists employee_id uuid references public.users(id) on delete restrict,
  add column if not exists request_fingerprint text,
  add column if not exists service_commission_base integer,
  add column if not exists product_commission_base integer,
  add column if not exists service_commission_rate smallint,
  add column if not exists product_commission_rate smallint,
  add column if not exists service_commission_amount integer,
  add column if not exists product_commission_amount integer,
  add column if not exists commission_total integer,
  add column if not exists barbershop_net integer,
  add column if not exists full_service_commission boolean,
  add column if not exists full_service_commission_authorized_by uuid references public.users(id) on delete restrict;

alter table public.incomes
  alter column payment_method drop not null;

create table if not exists public.income_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  income_id uuid not null references public.incomes(id) on delete restrict,
  method text not null,
  amount bigint not null,
  created_at timestamptz not null default now(),
  constraint income_payments_method_check check (method in ('cash', 'transfer')),
  constraint income_payments_amount_check check (amount > 0),
  constraint income_payments_income_method_key unique (income_id, method)
);

create index if not exists income_payments_income_idx
  on public.income_payments(income_id);
create index if not exists income_payments_method_income_idx
  on public.income_payments(method, income_id);

update public.incomes i
set
  employee_id = i.registered_by,
  request_fingerprint = pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to('legacy:' || i.id::text, 'UTF8'), 'sha256'),
    'hex'
  ),
  service_commission_base = coalesce((
    select sum(ii.subtotal)::integer
    from public.income_items ii
    where ii.income_id = i.id and ii.item_type = 'service'
  ), 0),
  product_commission_base = coalesce((
    select sum(ii.subtotal)::integer
    from public.income_items ii
    where ii.income_id = i.id and ii.item_type = 'product'
  ), 0),
  service_commission_rate = 0,
  product_commission_rate = 0,
  service_commission_amount = 0,
  product_commission_amount = 0,
  commission_total = 0,
  barbershop_net = i.total,
  full_service_commission = false
where i.employee_id is null
   or i.request_fingerprint is null
   or i.service_commission_base is null;

insert into public.income_payments (income_id, method, amount, created_at)
select i.id, i.payment_method, i.total, i.created_at
from public.incomes i
where i.payment_method is not null
on conflict (income_id, method) do nothing;

alter table public.incomes
  alter column employee_id set not null,
  alter column request_fingerprint set not null,
  alter column service_commission_base set not null,
  alter column product_commission_base set not null,
  alter column service_commission_rate set not null,
  alter column product_commission_rate set not null,
  alter column service_commission_amount set not null,
  alter column product_commission_amount set not null,
  alter column commission_total set not null,
  alter column barbershop_net set not null,
  alter column full_service_commission set not null;

alter table public.incomes
  drop constraint if exists incomes_commission_bases_check,
  drop constraint if exists incomes_commission_rates_check,
  drop constraint if exists incomes_commission_amounts_check,
  drop constraint if exists incomes_commission_total_check,
  drop constraint if exists incomes_barbershop_net_check,
  drop constraint if exists incomes_full_service_commission_check;

alter table public.incomes
  add constraint incomes_commission_bases_check check (
    service_commission_base >= 0
    and product_commission_base >= 0
    and service_commission_base + product_commission_base = total
  ),
  add constraint incomes_commission_rates_check check (
    service_commission_rate between 0 and 100
    and product_commission_rate between 0 and 100
  ),
  add constraint incomes_commission_amounts_check check (
    service_commission_amount >= 0
    and product_commission_amount >= 0
  ),
  add constraint incomes_commission_total_check check (
    commission_total = service_commission_amount + product_commission_amount
  ),
  add constraint incomes_barbershop_net_check check (
    barbershop_net >= 0 and barbershop_net + commission_total = total
  ),
  add constraint incomes_full_service_commission_check check (
    (not full_service_commission and full_service_commission_authorized_by is null)
    or (
      full_service_commission
      and full_service_commission_authorized_by is not null
      and service_commission_base > 0
      and service_commission_rate = 100
    )
  );

drop index if exists public.incomes_user_business_date_created_at_idx;
create index if not exists incomes_employee_business_date_created_at_idx
  on public.incomes(employee_id, business_date desc, created_at desc);
create index if not exists incomes_registered_by_created_at_idx
  on public.incomes(registered_by, created_at desc);

create or replace function public.income_as_json(target_income_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
      select jsonb_build_object(
        'id', ii.service_id,
        'name', ii.name_snapshot,
        'price', ii.unit_price
      )
      from public.income_items ii
      where ii.income_id = i.id and ii.item_type = 'service'
      limit 1
    ),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ii.product_id,
          'name', ii.name_snapshot,
          'unitPrice', ii.unit_price,
          'quantity', ii.quantity
        ) order by ii.created_at, ii.id
      )
      from public.income_items ii
      where ii.income_id = i.id and ii.item_type = 'product'
    ), '[]'::jsonb),
    'paymentMethod', coalesce(i.payment_method, (
      select ip.method
      from public.income_payments ip
      where ip.income_id = i.id
      order by case ip.method when 'cash' then 1 else 2 end
      limit 1
    )),
    'payments', coalesce((
      select jsonb_agg(
        jsonb_build_object('method', ip.method, 'amount', ip.amount)
        order by case ip.method when 'cash' then 1 else 2 end
      )
      from public.income_payments ip
      where ip.income_id = i.id
    ), '[]'::jsonb),
    'commission', jsonb_build_object(
      'serviceBase', i.service_commission_base,
      'productBase', i.product_commission_base,
      'serviceRate', i.service_commission_rate,
      'productRate', i.product_commission_rate,
      'serviceAmount', i.service_commission_amount,
      'productAmount', i.product_commission_amount,
      'total', i.commission_total,
      'barbershopNet', i.barbershop_net,
      'fullServiceCommission', i.full_service_commission,
      'authorizedBy', case when authorizer.id is null then null else jsonb_build_object(
        'id', authorizer.id,
        'firstName', authorizer.first_name,
        'lastName', authorizer.last_name
      ) end
    ),
    'total', i.total,
    'status', i.status
  )
  from public.incomes i
  join public.users employee on employee.id = i.employee_id
  join public.users registrant on registrant.id = i.registered_by
  left join public.users authorizer on authorizer.id = i.full_service_commission_authorized_by
  left join public.customers c on c.id = i.customer_id
  where i.id = target_income_id;
$$;

create or replace function public.create_income_v2(
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
  effective_service_rate smallint;
  service_amount integer;
  product_amount integer;
  total_commission integer;
  net_amount integer;
  service_record record;
  product_record record;
  requested_product_count integer;
  requested_payment_count integer;
  payment_total bigint;
  normalized_products jsonb;
  normalized_payments jsonb;
  fingerprint text;
  full_service boolean := coalesce(grant_full_service_commission, false);
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
      coalesce(jsonb_agg(item order by item->>'method'), '[]'::jsonb)
    into requested_payment_count, payment_total, normalized_payments
    from jsonb_array_elements(payment_items) item
    where item->>'method' in ('cash', 'transfer')
      and (item->>'amount')::bigint > 0;

    if requested_payment_count not between 1 and 2
      or requested_payment_count <> jsonb_array_length(payment_items)
      or requested_payment_count <> (
        select count(distinct item->>'method')
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
  if employee_record.service_commission_rate not between 0 and 100
    or employee_record.product_commission_rate not between 0 and 100
  then
    raise exception using errcode = 'P0001', message = 'COMMISSION_RATE_OUT_OF_RANGE';
  end if;

  if selected_customer_id is not null and not exists (
    select 1 from public.customers
    where id = selected_customer_id and deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_NOT_FOUND';
  end if;

  if selected_service_id is not null then
    select id, name, price into service_record
    from public.services
    where id = selected_service_id and is_active and deleted_at is null;
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
    select p.id, p.name, p.price, p.stock, requested.quantity
    from public.products p
    join (
      select (item->>'productId')::uuid as product_id,
        (item->>'quantity')::integer as quantity
      from jsonb_array_elements(product_items) item
    ) requested on requested.product_id = p.id
    order by p.id
    for update of p
  loop
    if not exists (select 1 from public.products where id = product_record.id and is_active) then
      raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_AVAILABLE';
    end if;
    if product_record.stock < product_record.quantity then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK:' || product_record.name;
    end if;
    product_base := product_base + product_record.price * product_record.quantity;
  end loop;

  if requested_product_count <> (
    select count(*)
    from public.products p
    join (
      select (item->>'productId')::uuid as product_id
      from jsonb_array_elements(product_items) item
    ) requested on requested.product_id = p.id
  ) then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
  end if;

  sale_total := sale_total + product_base;
  if payment_total <> sale_total then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
  end if;

  if full_service and (
    actor_record.role_id not in (1, 2)
    or effective_employee_id = actor_user_id
    or service_base = 0
  ) then
    raise exception using errcode = '42501', message = 'INVALID_COMMISSION_OVERRIDE';
  end if;

  effective_service_rate := case
    when full_service then 100
    else employee_record.service_commission_rate
  end;
  service_amount := round(service_base::numeric * effective_service_rate::numeric / 100)::integer;
  product_amount := round(product_base::numeric * employee_record.product_commission_rate::numeric / 100)::integer;
  total_commission := service_amount + product_amount;
  net_amount := sale_total - total_commission;

  insert into public.incomes (
    request_id, registered_by, employee_id, request_fingerprint, customer_id,
    payment_method, total, service_commission_base, product_commission_base,
    service_commission_rate, product_commission_rate, service_commission_amount,
    product_commission_amount, commission_total, barbershop_net,
    full_service_commission, full_service_commission_authorized_by,
    created_at, business_date
  ) values (
    income_request_id, actor_user_id, effective_employee_id, fingerprint,
    selected_customer_id,
    case when requested_payment_count = 1 then payment_items->0->>'method' else null end,
    sale_total, service_base, product_base, effective_service_rate,
    employee_record.product_commission_rate, service_amount, product_amount,
    total_commission, net_amount, full_service,
    case when full_service then actor_user_id else null end,
    sale_created_at,
    (sale_created_at at time zone 'America/Argentina/Buenos_Aires')::date
  ) returning id into created_income_id;

  if selected_service_id is not null then
    insert into public.income_items (
      income_id, item_type, service_id, name_snapshot, unit_price, quantity, created_at
    ) values (
      created_income_id, 'service', service_record.id, service_record.name,
      service_record.price, 1, sale_created_at
    );
  end if;

  for product_record in
    select p.id, p.name, p.price, p.stock, requested.quantity
    from public.products p
    join (
      select (item->>'productId')::uuid as product_id,
        (item->>'quantity')::integer as quantity
      from jsonb_array_elements(product_items) item
    ) requested on requested.product_id = p.id
    order by p.id
  loop
    insert into public.income_items (
      income_id, item_type, product_id, name_snapshot, unit_price, quantity, created_at
    ) values (
      created_income_id, 'product', product_record.id, product_record.name,
      product_record.price, product_record.quantity, sale_created_at
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

  insert into public.income_payments (income_id, method, amount, created_at)
  select created_income_id, item->>'method', (item->>'amount')::bigint, sale_created_at
  from jsonb_array_elements(payment_items) item;

  if selected_customer_id is not null then
    update public.customers
    set visits = visits + 1, updated_by = actor_user_id
    where id = selected_customer_id;
  end if;

  return created_income_id;
end;
$$;

create or replace function public.get_income_detail(
  requesting_user_id uuid,
  can_view_all boolean,
  target_income_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requester_role_id smallint;
begin
  select role_id into requester_role_id
  from public.users
  where id = requesting_user_id and is_active and deleted_at is null;

  if not found then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  if not exists (
    select 1 from public.incomes
    where id = target_income_id
      and ((can_view_all and requester_role_id in (1, 2)) or employee_id = requesting_user_id)
  ) then
    return null;
  end if;

  return public.income_as_json(target_income_id);
end;
$$;

create or replace function public.list_incomes(
  requesting_user_id uuid,
  can_view_all boolean,
  filter_user_id uuid,
  filter_date_from date,
  filter_date_to date,
  filter_payment_method text,
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

  if filter_payment_method is not null and filter_payment_method not in ('cash', 'transfer') then
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
      and (filter_payment_method is null or exists (
        select 1 from public.income_payments ip
        where ip.income_id = i.id and ip.method = filter_payment_method
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
    select
      coalesce(sum(ip.amount) filter (where f.status = 'active' and ip.method = 'cash'), 0)::bigint as cash_total,
      coalesce(sum(ip.amount) filter (where f.status = 'active' and ip.method = 'transfer'), 0)::bigint as transfer_total
    from filtered f
    left join public.income_payments ip on ip.income_id = f.id
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
      'cashTotal', payment_totals.cash_total,
      'transferTotal', payment_totals.transfer_total
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

drop function if exists public.create_income(uuid, uuid, uuid, uuid, jsonb, text);

alter table public.income_payments enable row level security;
revoke all on table public.income_payments from public, anon, authenticated;
grant select, insert on table public.income_payments to service_role;

revoke execute on function public.create_income_v2(uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean)
  from public, anon, authenticated;
revoke execute on function public.income_as_json(uuid) from public, anon, authenticated;
revoke execute on function public.get_income_detail(uuid, boolean, uuid) from public, anon, authenticated;
revoke execute on function public.list_incomes(uuid, boolean, uuid, date, date, text, text, text, text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.create_income_v2(uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean)
  to service_role;
grant execute on function public.income_as_json(uuid) to service_role;
grant execute on function public.get_income_detail(uuid, boolean, uuid) to service_role;
grant execute on function public.list_incomes(uuid, boolean, uuid, date, date, text, text, text, text, integer, integer)
  to service_role;

notify pgrst, 'reload schema';

commit;
