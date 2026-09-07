-- Bastardos Barberia: configurable owner commission, charged-price snapshots,
-- role-aware payment modes (manager amounts / employee basis points) and
-- sanitized employee income projections.
-- Run after 019_employee_work_sessions.sql as one complete migration.

begin;

-- ---------------------------------------------------------------------------
-- 1. Owner-zero rule removal
-- ---------------------------------------------------------------------------

drop trigger if exists enforce_owner_user_commission_rates on public.users;
drop trigger if exists enforce_owner_income_commission on public.incomes;

alter table public.users
  drop constraint if exists users_owner_commission_rates_check;

drop function if exists public.enforce_owner_user_commission_rates();
drop function if exists public.enforce_owner_income_commission();

-- ---------------------------------------------------------------------------
-- 2. Charged-price snapshots on income_items
-- ---------------------------------------------------------------------------

-- The original catalog-only model generated subtotal from unit_price. Charged
-- price overrides need both legacy fields to snapshot the amount actually paid.
alter table public.income_items
  alter column subtotal drop expression if exists;

alter table public.income_items
  add column if not exists catalog_unit_price integer,
  add column if not exists charged_unit_price integer,
  add column if not exists catalog_subtotal integer,
  add column if not exists charged_subtotal integer,
  add column if not exists adjustment_amount integer,
  add column if not exists price_override_by uuid,
  add column if not exists price_override_reason text;

-- Backfill historical rows with the same value as the existing unit_price/subtotal.
-- Migration 015 makes income-item snapshots immutable. Temporarily suspend only
-- that trigger inside this transaction so existing rows can receive the new
-- equivalent snapshot columns; any failure rolls both the backfill and trigger
-- state back atomically.
alter table public.income_items disable trigger income_items_prevent_snapshot_mutation;

update public.income_items
set
  catalog_unit_price = unit_price,
  charged_unit_price = unit_price,
  catalog_subtotal = subtotal,
  charged_subtotal = line_subtotal,
  adjustment_amount = 0
where catalog_unit_price is null;

alter table public.income_items enable trigger income_items_prevent_snapshot_mutation;

alter table public.income_items
  alter column catalog_unit_price set not null,
  alter column charged_unit_price set not null,
  alter column catalog_subtotal set not null,
  alter column charged_subtotal set not null,
  alter column adjustment_amount set not null;

alter table public.income_items
  drop constraint if exists income_items_subtotal_check,
  drop constraint if exists income_items_line_subtotal_check;

alter table public.income_items
  alter column subtotal set not null,
  add constraint income_items_subtotal_check check (
    subtotal >= 0 and subtotal = charged_subtotal
  ),
  add constraint income_items_line_subtotal_check check (
    line_subtotal >= 0
    and line_subtotal = charged_subtotal
    and subtotal = charged_subtotal
  ),
  add constraint income_items_catalog_charged_price_check check (
    catalog_unit_price >= 0
    and charged_unit_price >= 0
    and catalog_subtotal >= 0
    and charged_subtotal >= 0
    and charged_unit_price * quantity = charged_subtotal
    and catalog_unit_price * quantity = catalog_subtotal
    and adjustment_amount = charged_subtotal - catalog_subtotal
  ),
  add constraint income_items_price_override_actor_fkey
    foreign key (price_override_by) references public.users(id) on delete restrict,
  add constraint income_items_price_override_reason_required check (
    price_override_by is null
    or (price_override_reason is not null and length(trim(price_override_reason)) > 0)
  );

-- ---------------------------------------------------------------------------
-- 3. Gross total on parent incomes + basis points on income_payments
-- ---------------------------------------------------------------------------

alter table public.incomes
  add column if not exists gross_total integer;

update public.incomes
set gross_total = total
where gross_total is null;

alter table public.incomes
  alter column gross_total set not null,
  add constraint incomes_gross_total_check check (gross_total >= 0);

alter table public.incomes
  drop constraint if exists incomes_total_check,
  drop constraint if exists incomes_commission_bases_check;

alter table public.incomes
  add constraint incomes_total_check check (total >= 0),
  add constraint incomes_commission_bases_check check (
    service_commission_base >= 0
    and product_commission_base >= 0
    and service_commission_base + product_commission_base = gross_total
  );

alter table public.income_items
  drop constraint if exists income_items_price_check;

alter table public.income_items
  add constraint income_items_price_check check (unit_price >= 0);

alter table public.income_payments
  add column if not exists payment_method_id uuid,
  add column if not exists method_name_snapshot text,
  add column if not exists basis_points integer;

alter table public.income_payments
  add constraint income_payments_basis_points_range check (
    basis_points is null or (basis_points between 0 and 10000)
  );

-- ---------------------------------------------------------------------------
-- 4. Canonical create_income with charged prices and basis-point payments
-- ---------------------------------------------------------------------------

drop function if exists public.create_income(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean
);

create or replace function public.create_income(
  actor_user_id uuid,
  responsible_employee_id uuid,
  income_request_id uuid,
  selected_customer_id uuid,
  selected_service_id uuid,
  product_items jsonb,
  payment_items jsonb,
  grant_full_service_commission boolean,
  service_price_override jsonb,
  product_price_overrides jsonb
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
  gross_sale_total integer := 0;
  service_base integer := 0;
  service_charged integer := 0;
  service_override_price integer := null;
  service_override_reason text := null;
  service_override_by uuid := null;
  product_base integer := 0;
  product_charged integer := 0;
  responsible_role text;
  effective_service_rate smallint;
  effective_product_rate smallint;
  service_amount integer := 0;
  product_amount integer := 0;
  total_commission integer;
  net_amount integer;
  product_line_subtotal integer;
  product_line_charged integer;
  product_line_rate smallint;
  product_line_amount integer;
  service_record record;
  product_record record;
  charged_product_record record;
  requested_product_count integer;
  found_product_count integer := 0;
  requested_payment_count integer;
  found_payment_count integer := 0;
  payment_total bigint := 0;
  payment_basis_sum integer := 0;
  zero_total_sale boolean := false;
  payments_use_basis_points boolean := false;
  normalized_products jsonb;
  legacy_normalized_products jsonb;
  normalized_payments jsonb;
  fingerprint text;
  legacy_fingerprint text;
  full_service boolean := coalesce(grant_full_service_commission, false);
  any_full_product boolean;
  payment_item record;
  iteration_index integer;
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
  service_price_override := coalesce(service_price_override, 'null'::jsonb);
  product_price_overrides := coalesce(product_price_overrides, '{}'::jsonb);

  if jsonb_typeof(product_items) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_PRODUCT_ITEMS';
  end if;
  if jsonb_typeof(payment_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
  end if;

  -- Service price override: optional manager-only charged unit price + reason.
  if service_price_override <> 'null'::jsonb then
    if actor_record.role_id not in (1, 2) then
      raise exception using errcode = '42501', message = 'PRICE_OVERRIDE_NOT_ALLOWED_FOR_EMPLOYEE';
    end if;
    if jsonb_typeof(service_price_override) <> 'object'
      or service_price_override ? 'overrideBy'
      or not (service_price_override ? 'chargedUnitPrice')
      or not (service_price_override ? 'reason')
    then
      raise exception using errcode = '22023', message = 'INVALID_SERVICE_PRICE_OVERRIDE';
    end if;
    begin
      service_override_price := (service_price_override->>'chargedUnitPrice')::integer;
      service_override_reason := trim(service_price_override->>'reason');
    exception
      when others then
        raise exception using errcode = '22023', message = 'INVALID_SERVICE_PRICE_OVERRIDE';
    end;
    if service_override_price is null or service_override_price < 0 then
      raise exception using errcode = '22023', message = 'INVALID_SERVICE_PRICE_OVERRIDE';
    end if;
    if service_override_reason is null or length(service_override_reason) = 0 then
      raise exception using errcode = '22023', message = 'PRICE_OVERRIDE_REASON_REQUIRED';
    end if;
    service_override_by := actor_user_id;
  end if;

  -- Validate product override keys exist and only target a manager.
  if product_price_overrides <> '{}'::jsonb then
    if actor_record.role_id not in (1, 2) then
      raise exception using errcode = '42501', message = 'PRICE_OVERRIDE_NOT_ALLOWED_FOR_EMPLOYEE';
    end if;
    if jsonb_typeof(product_price_overrides) <> 'object' then
      raise exception using errcode = '22023', message = 'INVALID_PRODUCT_PRICE_OVERRIDES';
    end if;
  end if;

  begin
    select
      count(*)::integer,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'productId', (item->>'productId')::uuid,
          'quantity', (item->>'quantity')::integer,
          'grantFullCommission', (item->>'grantFullCommission')::boolean
        ) order by (item->>'productId')::uuid
      ), '[]'::jsonb)
    into requested_product_count, normalized_products
    from jsonb_array_elements(product_items) item
    where jsonb_typeof(item) = 'object'
      and jsonb_typeof(item->'productId') = 'string'
      and jsonb_typeof(item->'quantity') = 'number'
      and jsonb_typeof(item->'grantFullCommission') = 'boolean'
      and (item->>'productId')::uuid is not null
      and (item->>'quantity')::integer > 0
      and item = jsonb_build_object(
        'productId', (item->>'productId')::uuid,
        'quantity', (item->>'quantity')::integer,
        'grantFullCommission', (item->>'grantFullCommission')::boolean
      );

    if requested_product_count <> jsonb_array_length(product_items)
      or requested_product_count <> (
        select count(distinct (item->>'productId')::uuid)
        from jsonb_array_elements(normalized_products) item
      )
    then
      raise exception using errcode = '22023', message = 'INVALID_PRODUCT_ITEMS';
    end if;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'INVALID_PRODUCT_ITEMS';
  end;

  -- Pre-015 requests contained only productId/quantity. Rebuild exactly that
  -- normalized product array for a narrow, read-only idempotency comparison.
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'productId', item->'productId',
        'quantity', item->'quantity'
      ) order by item->>'productId'
    ), '[]'::jsonb),
    coalesce(bool_or((item->>'grantFullCommission')::boolean), false)
  into legacy_normalized_products, any_full_product
  from jsonb_array_elements(normalized_products) item;

  -- Payment items now accept either { paymentMethodId, amount } for managers
  -- or { paymentMethodId, basisPoints } for employees. Mixing the two modes
  -- in one request is forbidden.
  payment_basis_sum := 0;
  payments_use_basis_points := false;
  declare
    first_item jsonb;
    payment_methods_check jsonb;
  begin
    select item into first_item from jsonb_array_elements(payment_items) item limit 1;
    if first_item is not null then
      payments_use_basis_points := (first_item ? 'basisPoints') and not (first_item ? 'amount');
    end if;
  end;

  declare
    payment_methods jsonb := '[]'::jsonb;
    distinct_method_count integer := 0;
  begin
    select
      coalesce(jsonb_agg(item order by (item->>'paymentMethodId')), '[]'::jsonb)
    into payment_methods
    from jsonb_array_elements(payment_items) item
    where jsonb_typeof(item) = 'object'
      and (item->>'paymentMethodId') is not null;

    select count(distinct (item->>'paymentMethodId'))
    into distinct_method_count
    from jsonb_array_elements(payment_methods) item;

    if payments_use_basis_points then
      if actor_record.role_id <> 3 then
        raise exception using errcode = '42501', message = 'BASIS_POINTS_PAYMENTS_FORBIDDEN_FOR_MANAGER';
      end if;
      if jsonb_array_length(payment_methods) <> jsonb_array_length(payment_items) then
        raise exception using errcode = '22023', message = 'INVALID_PAYMENT_ITEMS';
      end if;
      if jsonb_array_length(payment_items) = 0 then
        raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
      end if;
      if distinct_method_count <> jsonb_array_length(payment_items) then
        raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
      end if;
      begin
        select
          coalesce(sum((item->>'basisPoints')::integer), 0)
        into payment_basis_sum
        from jsonb_array_elements(payment_items) item
        where (item->>'basisPoints')::integer between 0 and 10000;
      exception
        when others then
          raise exception using errcode = '22023', message = 'PAYMENT_BASIS_POINTS_OUT_OF_RANGE';
      end;
      if payment_basis_sum <> 10000 then
        raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
      end if;
      normalized_payments := payment_methods;
      requested_payment_count := jsonb_array_length(payment_items);
    else
      if jsonb_array_length(payment_methods) <> jsonb_array_length(payment_items)
        or distinct_method_count <> jsonb_array_length(payment_items)
      then
        raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
      end if;
      begin
        select
          count(*)::integer,
          coalesce(sum((item->>'amount')::bigint), 0)
        into requested_payment_count, payment_total
        from jsonb_array_elements(payment_items) item
        where (item->>'amount')::bigint > 0;
      exception
        when others then
          raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
      end;
      if requested_payment_count <> jsonb_array_length(payment_items) then
        raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
      end if;
      normalized_payments := payment_methods;
    end if;
  end;

  fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    jsonb_build_object(
      'responsibleEmployeeId', responsible_employee_id,
      'customerId', selected_customer_id,
      'serviceId', selected_service_id,
      'products', normalized_products,
      'payments', normalized_payments,
      'grantFullServiceCommission', full_service,
      'servicePriceOverride', service_price_override,
      'productPriceOverrides', product_price_overrides
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  legacy_fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    jsonb_build_object(
      'responsibleEmployeeId', responsible_employee_id,
      'customerId', selected_customer_id,
      'serviceId', selected_service_id,
      'products', legacy_normalized_products,
      'payments', normalized_payments,
      'grantFullServiceCommission', full_service
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      actor_user_id::text || ':' || income_request_id::text,
      0
    )
  );

  select id, request_fingerprint into existing_income
  from public.incomes
  where registered_by = actor_user_id and request_id = income_request_id;

  if found then
    -- A pre-020 hash is equivalent only when no charged-price override was
    -- supplied and every newly required product flag is false. Keep the
    -- original audit hash unchanged on that compatible retry.
    if existing_income.request_fingerprint <> fingerprint
      and (
        service_price_override <> 'null'::jsonb
        or product_price_overrides <> '{}'::jsonb
        or any_full_product
        or existing_income.request_fingerprint <> legacy_fingerprint
      )
    then
      raise exception using errcode = 'P0001', message = 'INCOME_REQUEST_CONFLICT';
    end if;
    return existing_income.id;
  end if;

  -- Lock every selected active method through commit and reject partial
  -- catalogs before any income/payment rows can be persisted. Idempotent
  -- retries return above without depending on mutable method lifecycle state.
  perform 1
  from public.payment_methods pm
  join (
    select distinct (item->>'paymentMethodId')::uuid as payment_method_id
    from jsonb_array_elements(payment_items) item
  ) requested on requested.payment_method_id = pm.id
  where pm.is_active
  order by pm.id
  for share of pm;

  select count(*)::integer
  into found_payment_count
  from public.payment_methods pm
  join (
    select distinct (item->>'paymentMethodId')::uuid as payment_method_id
    from jsonb_array_elements(payment_items) item
  ) requested on requested.payment_method_id = pm.id
  where pm.is_active;

  if found_payment_count <> requested_payment_count then
    raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_NOT_AVAILABLE';
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
    service_charged := coalesce(service_override_price, service_base);
  end if;

  if selected_service_id is null and requested_product_count = 0 then
    raise exception using errcode = '22023', message = 'INCOME_ITEM_REQUIRED';
  end if;

  perform 1
  from public.product_categories category
  join (
    select distinct p.category_id
    from public.products p
    join (
      select (item->>'productId')::uuid as product_id
      from jsonb_array_elements(normalized_products) item
    ) requested on requested.product_id = p.id
  ) requested_category on requested_category.category_id = category.id
  order by category.id
  for share of category;

  for product_record in
    select
      p.id,
      p.name,
      p.price,
      p.stock,
      p.is_active,
      requested.quantity,
      requested.full_commission
    from public.products p
    join (
      select
        (item->>'productId')::uuid as product_id,
        (item->>'quantity')::integer as quantity,
        (item->>'grantFullCommission')::boolean as full_commission
      from jsonb_array_elements(normalized_products) item
    ) requested on requested.product_id = p.id
    order by p.id
    for update of p
  loop
    found_product_count := found_product_count + 1;
    if not product_record.is_active then
      raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_AVAILABLE';
    end if;
    if product_record.stock < product_record.quantity then
      raise exception using
        errcode = 'P0001',
        message = 'INSUFFICIENT_STOCK:' || product_record.name;
    end if;
    product_line_subtotal := product_record.price * product_record.quantity;
    product_base := product_base + product_line_subtotal;
  end loop;

  if found_product_count <> requested_product_count then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
  end if;

  -- Payment validation needs the authoritative charged product total before
  -- the per-line commission snapshots are built below.
  select coalesce(sum(
    coalesce((override_entry.value->>'chargedUnitPrice')::integer, p.price)
      * requested.quantity
  ), 0)::integer
  into product_charged
  from public.products p
  join (
    select
      (item->>'productId')::uuid as product_id,
      (item->>'quantity')::integer as quantity
    from jsonb_array_elements(normalized_products) item
  ) requested on requested.product_id = p.id
  left join jsonb_each(product_price_overrides) as override_entry
    on (override_entry.key)::uuid = p.id;

  gross_sale_total := service_base + product_base;
  sale_total := service_charged + product_charged;

  zero_total_sale := sale_total = 0;
  if not zero_total_sale then
    if payments_use_basis_points then
      -- Distribute basis points across exact payment amounts.
      declare
        allocated bigint := 0;
        iteration_payment jsonb;
        iteration_amount bigint;
      begin
        for iteration_index in 0 .. (jsonb_array_length(payment_items) - 2) loop
          iteration_payment := payment_items->iteration_index;
          iteration_amount :=
            (sale_total::bigint * (iteration_payment->>'basisPoints')::integer) / 10000;
          if iteration_amount <= 0 then
            raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
          end if;
          payment_total := payment_total + iteration_amount;
          allocated := allocated + iteration_amount;
        end loop;
        iteration_amount := sale_total::bigint - allocated;
        if iteration_amount <= 0 then
          raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
        end if;
        payment_total := payment_total + iteration_amount;
      end;
    end if;
    if payment_total <> sale_total then
      raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
    end if;
  else
    if jsonb_array_length(payment_items) <> 0 then
      raise exception using errcode = 'P0001', message = 'ZERO_TOTAL_SALE_REQUIRES_NO_PAYMENTS';
    end if;
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

  if any_full_product and (
    actor_record.role_id not in (1, 2)
    or effective_employee_id = actor_user_id
    or responsible_role = 'owner'
    or requested_product_count = 0
  ) then
    raise exception using
      errcode = '42501',
      message = 'INVALID_PRODUCT_COMMISSION_OVERRIDE';
  end if;

  -- Migration 020: owners use their configured commission rates. No zero short-circuit.
  effective_service_rate := case
    when full_service then 100
    else employee_record.service_commission_rate
  end;
  effective_product_rate := employee_record.product_commission_rate;

  service_amount := round(
    service_charged::numeric * effective_service_rate::numeric / 100
  )::integer;

  -- Calculate every product line independently using charged unit prices.
  for product_record in
    select
      p.id,
      p.name,
      p.price,
      p.stock,
      requested.quantity,
      requested.full_commission,
      override_record.charged_unit_price as override_price,
      override_record.reason as override_reason,
      override_record.override_by as override_by
    from public.products p
    join (
      select
        (item->>'productId')::uuid as product_id,
        (item->>'quantity')::integer as quantity,
        (item->>'grantFullCommission')::boolean as full_commission
      from jsonb_array_elements(normalized_products) item
    ) requested on requested.product_id = p.id
    left join lateral (
      select
        (override_entry.value->>'chargedUnitPrice')::integer as charged_unit_price,
        override_entry.value->>'reason' as reason,
        actor_user_id as override_by
      from jsonb_each(product_price_overrides) override_entry
      where (override_entry.key)::uuid = p.id
      limit 1
    ) override_record on true
    order by p.id
  loop
    product_line_subtotal := product_record.price * product_record.quantity;
    declare
      line_charged_price integer := coalesce(product_record.override_price, product_record.price);
    begin
      if line_charged_price < 0 then
        raise exception using errcode = '22023', message = 'INVALID_PRODUCT_PRICE_OVERRIDE';
      end if;
      if product_record.override_price is not null and (
        product_record.override_reason is null
        or length(trim(product_record.override_reason)) = 0
      ) then
        raise exception using errcode = '22023', message = 'PRICE_OVERRIDE_REASON_REQUIRED';
      end if;
      product_line_charged := line_charged_price * product_record.quantity;
      if product_record.id = (normalized_products->0->>'productId')::uuid then
        -- First pass accumulates charged totals; persist later via the insert loop below.
        null;
      end if;
      perform 1; -- ensure block executes once per row
    end;
  end loop;

  -- Aggregate charged product totals + per-line amounts for the persisted snapshot.
  declare
    charged_totals jsonb := '[]'::jsonb;
  begin
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'productId', p.id,
        'catalogUnitPrice', p.price,
        'chargedUnitPrice', coalesce((override_entry.value->>'chargedUnitPrice')::integer, p.price),
        'catalogSubtotal', p.price * requested.quantity,
        'chargedSubtotal', coalesce((override_entry.value->>'chargedUnitPrice')::integer, p.price) * requested.quantity,
        'quantity', requested.quantity,
        'grantFullCommission', requested.full_commission,
        'overrideReason', override_entry.value->>'reason',
        'commissionRate', case
          when requested.full_commission then 100
          else effective_product_rate
        end
      ) order by p.id
    ), '[]'::jsonb)
    into charged_totals
    from public.products p
    join (
      select
        (item->>'productId')::uuid as product_id,
        (item->>'quantity')::integer as quantity,
        (item->>'grantFullCommission')::boolean as full_commission
      from jsonb_array_elements(normalized_products) item
    ) requested on requested.product_id = p.id
    left join jsonb_each(product_price_overrides) as override_entry
      on (override_entry.key)::uuid = p.id;

    product_charged := 0;
    product_amount := 0;
    for charged_product_record in
      select
        (entry->>'productId')::uuid as product_id,
        (entry->>'chargedSubtotal')::integer as charged_subtotal,
        (entry->>'quantity')::integer as quantity,
        (entry->>'grantFullCommission')::boolean as grant_full_commission,
        entry->>'commissionRate' as commission_rate,
        entry->>'overrideReason' as override_reason
      from jsonb_array_elements(charged_totals) entry
    loop
      product_charged := product_charged + charged_product_record.charged_subtotal;
      product_line_rate := charged_product_record.commission_rate::smallint;
      product_line_amount := round(
        charged_product_record.charged_subtotal::numeric * product_line_rate::numeric / 100
      )::integer;
      product_amount := product_amount + product_line_amount;
    end loop;
  end;

  sale_total := service_charged + product_charged;
  if not zero_total_sale and payment_total <> sale_total then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
  end if;

  total_commission := service_amount + product_amount;
  net_amount := sale_total - total_commission;

  insert into public.incomes (
    request_id, registered_by, employee_id, responsible_role_snapshot,
    request_fingerprint, customer_id, payment_method, total, gross_total,
    service_commission_base, product_commission_base,
    service_commission_rate, product_commission_rate,
    service_commission_amount, product_commission_amount,
    commission_total, barbershop_net,
    full_service_commission, full_service_commission_authorized_by,
    created_at, business_date
  ) values (
    income_request_id, actor_user_id, effective_employee_id, responsible_role,
    fingerprint, selected_customer_id,
    null,
    sale_total, gross_sale_total,
    service_base, product_base,
    effective_service_rate, effective_product_rate,
    service_amount, product_amount, total_commission, net_amount,
    full_service, case when full_service then actor_user_id else null end,
    sale_created_at,
    (sale_created_at at time zone 'America/Argentina/Buenos_Aires')::date
  ) returning id into created_income_id;

  if selected_service_id is not null then
    insert into public.income_items (
      income_id, item_type, service_id, name_snapshot,
      unit_price, catalog_unit_price, charged_unit_price,
      quantity, subtotal, catalog_subtotal, charged_subtotal, adjustment_amount,
      line_subtotal, commission_rate, commission_amount, full_commission,
      full_commission_authorized_by, price_override_by, price_override_reason,
      created_at
    ) values (
      created_income_id, 'service', service_record.id, service_record.name,
      service_base, service_base, service_charged,
      1, service_charged, service_base, service_charged,
      service_charged - service_base,
      service_charged, effective_service_rate, service_amount, full_service,
      case when full_service then actor_user_id else null end,
      service_override_by, service_override_reason,
      sale_created_at
    );
  end if;

  for product_record in
    select
      qi.entry
    from jsonb_array_elements(
      (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'productId', p.id,
            'name', p.name,
            'price', p.price,
            'stock', p.stock,
            'quantity', requested.quantity,
            'grantFullCommission', requested.full_commission,
            'chargedUnitPrice', coalesce((override_entry.value->>'chargedUnitPrice')::integer, p.price),
            'overrideReason', override_entry.value->>'reason',
            'overrideBy', case
              when override_entry.value is null then null
              else actor_user_id
            end
          ) order by p.id
        ), '[]'::jsonb)
        from public.products p
        join (
          select
            (item->>'productId')::uuid as product_id,
            (item->>'quantity')::integer as quantity,
            (item->>'grantFullCommission')::boolean as full_commission
          from jsonb_array_elements(normalized_products) item
        ) requested on requested.product_id = p.id
        left join jsonb_each(product_price_overrides) as override_entry
          on (override_entry.key)::uuid = p.id
      )
    ) qi(entry)
  loop
    declare
      row jsonb := product_record.entry;
      line_product_id uuid := (row->>'productId')::uuid;
      line_quantity integer := (row->>'quantity')::integer;
      line_grant boolean := (row->>'grantFullCommission')::boolean;
      line_charged integer := (row->>'chargedUnitPrice')::integer;
      line_override_by uuid := nullif(row->>'overrideBy', '')::uuid;
      line_override_reason text := row->>'overrideReason';
      line_rate smallint;
      line_amount integer;
      line_catalog integer := (row->>'price')::integer * line_quantity;
      line_charged_subtotal integer := line_charged * line_quantity;
    begin
      line_rate := case
        when line_grant then 100
        else effective_product_rate
      end;
      line_amount := round(line_charged_subtotal::numeric * line_rate::numeric / 100)::integer;

      insert into public.income_items (
        income_id, item_type, product_id, name_snapshot,
        unit_price, catalog_unit_price, charged_unit_price,
        quantity, subtotal, catalog_subtotal, charged_subtotal, adjustment_amount,
        line_subtotal, commission_rate, commission_amount, full_commission,
        full_commission_authorized_by, price_override_by, price_override_reason,
        created_at
      ) values (
        created_income_id, 'product', line_product_id, row->>'name',
        (row->>'price')::integer, (row->>'price')::integer, line_charged,
        line_quantity, line_charged_subtotal, line_catalog, line_charged_subtotal,
        line_charged_subtotal - line_catalog,
        line_charged_subtotal, line_rate, line_amount, line_grant,
        case when line_grant then actor_user_id else null end,
        line_override_by, line_override_reason,
        sale_created_at
      );

      update public.products
      set
        stock = (row->>'stock')::integer - line_quantity,
        updated_by = actor_user_id
      where id = line_product_id;

      insert into public.inventory_movements (
        product_id, movement_type, quantity_delta, stock_after,
        user_id, income_id, created_at
      ) values (
        line_product_id, 'sale', -line_quantity,
        (row->>'stock')::integer - line_quantity,
        actor_user_id, created_income_id, sale_created_at
      );
    end;
  end loop;

  if not zero_total_sale then
    if payments_use_basis_points then
      declare
        cumulative bigint := 0;
        iter_payment jsonb;
        iter_amount bigint;
        iter_index integer;
      begin
        for iter_index in 0 .. (jsonb_array_length(payment_items) - 2) loop
          iter_payment := payment_items->iter_index;
          iter_amount := (sale_total::bigint * (iter_payment->>'basisPoints')::integer) / 10000;
          cumulative := cumulative + iter_amount;
          insert into public.income_payments (
            income_id, payment_method_id, method_name_snapshot, amount, basis_points, created_at
          )
          select
            created_income_id,
            (iter_payment->>'paymentMethodId')::uuid,
            pm.name,
            iter_amount,
            (iter_payment->>'basisPoints')::integer,
            sale_created_at
          from public.payment_methods pm
          where pm.id = (iter_payment->>'paymentMethodId')::uuid
            and pm.is_active;
          if not found then
            raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_NOT_AVAILABLE';
          end if;
        end loop;
        iter_amount := sale_total::bigint - cumulative;
        iter_payment := payment_items->(jsonb_array_length(payment_items) - 1);
        insert into public.income_payments (
          income_id, payment_method_id, method_name_snapshot, amount, basis_points, created_at
        )
        select
          created_income_id,
          (iter_payment->>'paymentMethodId')::uuid,
          pm.name,
          iter_amount,
          (iter_payment->>'basisPoints')::integer,
          sale_created_at
        from public.payment_methods pm
        where pm.id = (iter_payment->>'paymentMethodId')::uuid
          and pm.is_active;
      end;
    else
      insert into public.income_payments (
        income_id, payment_method_id, method_name_snapshot, amount, basis_points, created_at
      )
      select
        created_income_id,
        (item->>'paymentMethodId')::uuid,
        pm.name,
        (item->>'amount')::bigint,
        null,
        sale_created_at
      from jsonb_array_elements(payment_items) item
      join public.payment_methods pm on pm.id = (item->>'paymentMethodId')::uuid
      where pm.is_active;
      if not found then
        raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_NOT_AVAILABLE';
      end if;
    end if;
  end if;

  if selected_customer_id is not null then
    update public.customers
    set visits = visits + 1, updated_by = actor_user_id
    where id = selected_customer_id;
  end if;

  return created_income_id;
end;
$$;

revoke execute on function public.create_income(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_income(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean, jsonb, jsonb
) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Sanitized employee income projection
-- ---------------------------------------------------------------------------

create or replace function public.income_as_employee_json(target_income_id uuid)
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
    'customer', case when c.id is null then null else jsonb_build_object(
      'id', c.id,
      'firstName', c.first_name,
      'lastName', c.last_name
    ) end,
    'concepts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', coalesce(ii.service_id, ii.product_id),
          'type', case when ii.item_type = 'service' then 'service' else 'product' end,
          'name', ii.name_snapshot,
          'quantity', ii.quantity,
          'earning', ii.commission_amount
        ) order by ii.item_type, ii.created_at, ii.id
      )
      from public.income_items ii
      where ii.income_id = i.id
    ), '[]'::jsonb),
    'employeeCommission', i.commission_total,
    'status', i.status
  )
  from public.incomes i
  left join public.customers c on c.id = i.customer_id
  where i.id = target_income_id;
$$;

revoke execute on function public.income_as_employee_json(uuid)
  from public, anon, authenticated;
grant execute on function public.income_as_employee_json(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Extend income_as_json with charged-price snapshots
-- ---------------------------------------------------------------------------

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
        'price', ii.charged_unit_price,
        'catalogUnitPrice', ii.catalog_unit_price,
        'chargedUnitPrice', ii.charged_unit_price,
        'catalogSubtotal', ii.catalog_subtotal,
        'chargedSubtotal', ii.charged_subtotal,
        'adjustmentAmount', ii.adjustment_amount,
        'priceOverrideReason', ii.price_override_reason,
        'commission', jsonb_build_object(
          'subtotal', ii.line_subtotal,
          'catalogSubtotal', ii.catalog_subtotal,
          'chargedSubtotal', ii.charged_subtotal,
          'adjustmentAmount', ii.adjustment_amount,
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
      )
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
          'unitPrice', ii.charged_unit_price,
          'catalogUnitPrice', ii.catalog_unit_price,
          'chargedUnitPrice', ii.charged_unit_price,
          'catalogSubtotal', ii.catalog_subtotal,
          'chargedSubtotal', ii.charged_subtotal,
          'adjustmentAmount', ii.adjustment_amount,
          'priceOverrideReason', ii.price_override_reason,
          'quantity', ii.quantity,
          'commission', jsonb_build_object(
            'subtotal', ii.line_subtotal,
            'catalogSubtotal', ii.catalog_subtotal,
            'chargedSubtotal', ii.charged_subtotal,
            'adjustmentAmount', ii.adjustment_amount,
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
          'amount', ip.amount,
          'basisPoints', ip.basis_points
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
    'grossTotal', i.gross_total,
    'status', i.status
  )
  from public.incomes i
  join public.users employee on employee.id = i.employee_id
  join public.users registrant on registrant.id = i.registered_by
  left join public.customers c on c.id = i.customer_id
  where i.id = target_income_id;
$$;

revoke execute on function public.income_as_json(uuid)
  from public, anon, authenticated;
grant execute on function public.income_as_json(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Role-aware list and detail RPCs
-- ---------------------------------------------------------------------------

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
  actor_record record;
  detail jsonb;
begin
  select id, role_id into actor_record
  from public.users
  where id = requesting_user_id and is_active and deleted_at is null;

  if not found then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  if actor_record.role_id = 3 then
    if not exists (
      select 1
      from public.incomes i
      where i.id = target_income_id
        and i.employee_id = requesting_user_id
    ) then
      return null;
    end if;
    detail := public.income_as_employee_json(target_income_id);
  else
    detail := public.income_as_json(target_income_id);
  end if;

  return detail;
end;
$$;

revoke execute on function public.get_income_detail(uuid, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.get_income_detail(uuid, boolean, uuid)
  to service_role;

-- list_incomes dispatches per-row projections based on the viewer's role.
-- Managers continue to receive the full income_as_json payload; employees
-- receive the sanitized income_as_employee_json projection without any
-- catalog, charged, payment or commission detail.
drop function if exists public.list_incomes(
  uuid, boolean, uuid, date, date, text, text, text, text, integer, integer
);

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
      and (filter_status is null or i.status::text = filter_status)
      and (
        filter_kind is null
        or (filter_kind = 'service'
          and exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'service')
          and not exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'product'))
        or (filter_kind = 'products'
          and exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'product')
          and not exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'service'))
        or (filter_kind = 'combined'
          and exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'service')
          and exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'product'))
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
      coalesce(sum(gross_total) filter (where status = 'active'), 0)::bigint as gross_total,
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
  select case when effective_can_view_all then
    jsonb_build_object(
      'items', coalesce((select jsonb_agg(public.income_as_json(p.id) order by p.created_at desc, p.id desc) from page_rows p), '[]'::jsonb),
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
        'totalPages', case when totals.total_count = 0 then 0 else ceiling(totals.total_count::numeric / safe_page_size)::integer end
      )
    )
  else
    jsonb_build_object(
      'items', coalesce((select jsonb_agg(public.income_as_employee_json(p.id) order by p.created_at desc, p.id desc) from page_rows p), '[]'::jsonb),
      'metrics', jsonb_build_object(
        'count', totals.active_count,
        'employeeCommissionTotal', totals.commission_total
      ),
      'pagination', jsonb_build_object(
        'page', safe_page,
        'pageSize', safe_page_size,
        'total', totals.total_count,
        'totalPages', case when totals.total_count = 0 then 0 else ceiling(totals.total_count::numeric / safe_page_size)::integer end
      )
    )
  end
  into result
  from totals cross join payment_totals;

  return result;
end;
$$;

revoke execute on function public.list_incomes(
  uuid, boolean, uuid, date, date, uuid, text, text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.list_incomes(
  uuid, boolean, uuid, date, date, uuid, text, text, text, integer, integer
) to service_role;

notify pgrst, 'reload schema';

commit;
