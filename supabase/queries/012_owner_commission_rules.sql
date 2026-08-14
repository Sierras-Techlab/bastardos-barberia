-- Bastardos Barberia: authoritative zero commissions for owner-responsible sales.
-- Run after 011_customer_visits_and_fixed_schedules.sql as one complete migration.

begin;

-- The application already normalizes these values; make existing development data
-- conform before the database constraint makes the policy authoritative.
update public.users
set service_commission_rate = 0,
    product_commission_rate = 0
where role_id = 1;

alter table public.incomes
  add column if not exists responsible_role_snapshot text;

update public.incomes i
set responsible_role_snapshot = r.name
from public.users u
join public.roles r on r.id = u.role_id
where u.id = i.employee_id
  and i.responsible_role_snapshot is null;

alter table public.incomes
  drop constraint if exists incomes_responsible_role_snapshot_check;

alter table public.incomes
  add constraint incomes_responsible_role_snapshot_check
    check (responsible_role_snapshot in ('owner', 'admin', 'employee')),
  alter column responsible_role_snapshot set not null;

alter table public.users
  drop constraint if exists users_owner_commission_zero_check;

alter table public.users
  add constraint users_owner_commission_zero_check
    check (
      role_id <> 1
      or (service_commission_rate = 0 and product_commission_rate = 0)
    );

-- Replace the pre-010 profile signature and make this 010-compatible signature
-- the only canonical function name.
drop function if exists public.update_user_profile(
  uuid, boolean, text, boolean, text, boolean, smallint, boolean, boolean
);

create or replace function public.update_user_profile(
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
  effective_role_id smallint;
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

  effective_role_id := case when set_role_id then new_role_id else current_role_id end;

  if effective_role_id <> 1 and set_service_commission_rate
    and (new_service_commission_rate is null or new_service_commission_rate not between 0 and 100)
  then
    raise exception using errcode = '22023', message = 'COMMISSION_RATE_OUT_OF_RANGE';
  end if;

  if effective_role_id <> 1 and set_product_commission_rate
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
    role_id = effective_role_id,
    is_active = case when set_is_active then new_is_active else is_active end,
    service_commission_rate = case
      when effective_role_id = 1 then 0
      when set_service_commission_rate then new_service_commission_rate
      else service_commission_rate
    end,
    product_commission_rate = case
      when effective_role_id = 1 then 0
      when set_product_commission_rate then new_product_commission_rate
      else product_commission_rate
    end
  where id = target_user_id
    and deleted_at is null;

  return target_user_id;
end;
$$;

revoke execute on function public.update_user_profile(
  uuid, boolean, text, boolean, text, boolean, smallint, boolean, boolean,
  boolean, smallint, boolean, smallint
) from public, anon, authenticated;

grant execute on function public.update_user_profile(
  uuid, boolean, text, boolean, text, boolean, smallint, boolean, boolean,
  boolean, smallint, boolean, smallint
) to service_role;

revoke execute on function public.update_user_profile_v2(
  uuid, boolean, text, boolean, text, boolean, smallint, boolean, boolean,
  boolean, smallint, boolean, smallint
) from public, anon, authenticated, service_role;

drop function public.update_user_profile_v2(
  uuid, boolean, text, boolean, text, boolean, smallint, boolean, boolean,
  boolean, smallint, boolean, smallint
);

-- Keep the V2 sale contract until its planned canonical rename, while replacing
-- the implementation so responsible owner records independently earn zero.
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
  responsible_role text;
  effective_service_rate smallint;
  effective_product_rate smallint;
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

  -- Lock every potentially involved user in UUID order so role/eligibility cannot
  -- change after authorization and two cross-attributed sales cannot deadlock.
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
  if employee_record.service_commission_rate not between 0 and 100
    or employee_record.product_commission_rate not between 0 and 100
  then
    raise exception using errcode = 'P0001', message = 'COMMISSION_RATE_OUT_OF_RANGE';
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

  -- Products are already locked above. Serialize the eventual visit increment
  -- without a shared-lock upgrade, preserving void_income's product -> customer order.
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
  service_amount := round(service_base::numeric * effective_service_rate::numeric / 100)::integer;
  product_amount := round(product_base::numeric * effective_product_rate::numeric / 100)::integer;
  total_commission := service_amount + product_amount;
  net_amount := sale_total - total_commission;

  insert into public.incomes (
    request_id, registered_by, employee_id, responsible_role_snapshot,
    request_fingerprint, customer_id, payment_method, total,
    service_commission_base, product_commission_base,
    service_commission_rate, product_commission_rate, service_commission_amount,
    product_commission_amount, commission_total, barbershop_net,
    full_service_commission, full_service_commission_authorized_by,
    created_at, business_date
  ) values (
    income_request_id, actor_user_id, effective_employee_id, responsible_role,
    fingerprint, selected_customer_id,
    case when requested_payment_count = 1 then payment_items->0->>'method' else null end,
    sale_total, service_base, product_base, effective_service_rate,
    effective_product_rate, service_amount, product_amount, total_commission,
    net_amount, full_service,
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

-- This one-time correction is intentionally limited to pre-production data
-- whose responsible role snapshot was backfilled as owner above.
update public.incomes
set service_commission_rate = 0,
    product_commission_rate = 0,
    service_commission_amount = 0,
    product_commission_amount = 0,
    commission_total = 0,
    barbershop_net = total,
    full_service_commission = false,
    full_service_commission_authorized_by = null
where responsible_role_snapshot = 'owner';

revoke execute on function public.create_income_v2(uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean)
  from public, anon, authenticated;

grant execute on function public.create_income_v2(uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean)
  to service_role;

notify pgrst, 'reload schema';

commit;
