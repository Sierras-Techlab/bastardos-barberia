-- Bastardos Barberia: immutable per-item commission snapshots and product exceptions.
-- Run after 014_product_categories.sql as one complete migration.

begin;

alter table public.income_items
  add column line_subtotal integer,
  add column commission_rate smallint,
  add column commission_amount integer,
  add column full_commission boolean,
  add column full_commission_authorized_by uuid;

alter table public.income_items
  add constraint income_items_full_commission_authorized_by_fkey
    foreign key (full_commission_authorized_by)
    references public.users(id) on delete restrict;

-- Parent aggregates created by 010/012 must still match their immutable item
-- prices before they can be projected back onto individual rows.
do $$
begin
  if exists (
    select 1
    from public.incomes i
    left join public.income_items ii on ii.income_id = i.id
    group by i.id, i.service_commission_base, i.product_commission_base,
      i.service_commission_amount, i.product_commission_amount
    having coalesce(sum(ii.subtotal) filter (where ii.item_type = 'service'), 0)
        <> i.service_commission_base
      or coalesce(sum(ii.subtotal) filter (where ii.item_type = 'product'), 0)
        <> i.product_commission_base
      or i.service_commission_amount > i.service_commission_base
      or i.product_commission_amount > i.product_commission_base
  ) then
    raise exception 'INCOME_ITEM_COMMISSION_BACKFILL_MISMATCH';
  end if;
end;
$$;

-- There is at most one service item, so its historical parent snapshot maps
-- directly onto that row.
update public.income_items ii
set
  line_subtotal = i.service_commission_base,
  commission_rate = i.service_commission_rate,
  commission_amount = i.service_commission_amount,
  full_commission = i.full_service_commission,
  full_commission_authorized_by = i.full_service_commission_authorized_by
from public.incomes i
where i.id = ii.income_id
  and ii.item_type = 'service';

-- Allocate each historical product aggregate proportionally in deterministic
-- item-ID order. Cumulative floors keep every row within its own subtotal and
-- make the final row absorb the remaining fractional allocation exactly.
with product_allocations as (
  select
    ii.id,
    ii.subtotal::integer as line_subtotal,
    i.product_commission_rate as commission_rate,
    (
      floor(
        i.product_commission_amount::numeric
          * sum(ii.subtotal) over (
              partition by ii.income_id
              order by ii.id
              rows between unbounded preceding and current row
            )::numeric
          / i.product_commission_base::numeric
      )
      - floor(
          i.product_commission_amount::numeric
            * coalesce(sum(ii.subtotal) over (
                partition by ii.income_id
                order by ii.id
                rows between unbounded preceding and 1 preceding
              ), 0)::numeric
            / i.product_commission_base::numeric
        )
    )::integer as commission_amount
  from public.income_items ii
  join public.incomes i on i.id = ii.income_id
  where ii.item_type = 'product'
)
update public.income_items ii
set
  line_subtotal = allocation.line_subtotal,
  commission_rate = allocation.commission_rate,
  commission_amount = allocation.commission_amount,
  full_commission = false,
  full_commission_authorized_by = null
from product_allocations allocation
where allocation.id = ii.id;

-- Verify exact parent reconciliation before making the columns mandatory.
do $$
begin
  if exists (
    select 1
    from public.income_items ii
    where ii.line_subtotal is null
      or ii.commission_rate is null
      or ii.commission_amount is null
      or ii.full_commission is null
      or ii.line_subtotal <> ii.subtotal
      or ii.commission_amount < 0
      or ii.commission_amount > ii.line_subtotal
  ) or exists (
    select 1
    from public.incomes i
    left join public.income_items ii on ii.income_id = i.id
    group by i.id, i.service_commission_base, i.product_commission_base,
      i.service_commission_amount, i.product_commission_amount
    having coalesce(sum(ii.line_subtotal) filter (where ii.item_type = 'service'), 0)
        <> i.service_commission_base
      or coalesce(sum(ii.line_subtotal) filter (where ii.item_type = 'product'), 0)
        <> i.product_commission_base
      or coalesce(sum(ii.commission_amount) filter (where ii.item_type = 'service'), 0)
        <> i.service_commission_amount
      or coalesce(sum(ii.commission_amount) filter (where ii.item_type = 'product'), 0)
        <> i.product_commission_amount
  ) or exists (
    select 1
    from public.income_items ii
    join public.incomes i on i.id = ii.income_id
    where (
      ii.item_type = 'service'
      and (
        ii.commission_rate <> i.service_commission_rate
        or ii.full_commission <> i.full_service_commission
        or ii.full_commission_authorized_by
          is distinct from i.full_service_commission_authorized_by
      )
    ) or (
      ii.item_type = 'product'
      and (
        ii.commission_rate <> i.product_commission_rate
        or ii.full_commission
        or ii.full_commission_authorized_by is not null
      )
    )
  ) then
    raise exception 'INCOME_ITEM_COMMISSION_BACKFILL_MISMATCH';
  end if;
end;
$$;

alter table public.income_items
  alter column line_subtotal set not null,
  alter column commission_rate set not null,
  alter column commission_amount set not null,
  alter column full_commission set not null;

alter table public.income_items
  add constraint income_items_line_subtotal_check check (
    line_subtotal > 0 and line_subtotal = subtotal
  ),
  add constraint income_items_commission_rate_check check (
    commission_rate between 0 and 100
  ),
  add constraint income_items_commission_amount_check check (
    commission_amount >= 0 and commission_amount <= line_subtotal
  ),
  add constraint income_items_full_commission_check check (
    (not full_commission and full_commission_authorized_by is null)
    or (
      full_commission
      and full_commission_authorized_by is not null
      and commission_rate = 100
      and commission_amount = line_subtotal
    )
  );

create function public.prevent_income_item_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'INCOME_ITEM_SNAPSHOT_IMMUTABLE';
end;
$$;

create trigger income_items_prevent_snapshot_mutation
before update or delete on public.income_items
for each row execute function public.prevent_income_item_snapshot_mutation();

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
      'total', i.commission_total,
      'barbershopNet', i.barbershop_net
    ),
    'total', i.total,
    'status', i.status
  )
  from public.incomes i
  join public.users employee on employee.id = i.employee_id
  join public.users registrant on registrant.id = i.registered_by
  left join public.customers c on c.id = i.customer_id
  where i.id = target_income_id;
$$;

-- Remove every known pre-canonical overload before installing the final RPC.
drop function if exists public.create_income(uuid, uuid, uuid, uuid, jsonb, text);
drop function if exists public.create_income(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean
);

create function public.create_income(
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
  requested_product_count integer;
  found_product_count integer := 0;
  requested_payment_count integer;
  payment_total bigint;
  normalized_products jsonb;
  legacy_normalized_products jsonb;
  normalized_payments jsonb;
  fingerprint text;
  legacy_fingerprint text;
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

  begin
    select
      count(*)::integer,
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
    -- A pre-015 hash is equivalent only when every newly required product flag
    -- is false. Keep the original audit hash unchanged on that compatible retry.
    if existing_income.request_fingerprint <> fingerprint
      and (
        any_full_product
        or existing_income.request_fingerprint <> legacy_fingerprint
      )
    then
      raise exception using errcode = 'P0001', message = 'INCOME_REQUEST_CONFLICT';
    end if;
    return existing_income.id;
  end if;

  -- Lock all authorization identities in UUID order, then re-read their
  -- mutable role and lifecycle state while the shared locks are held.
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
  end if;

  if selected_service_id is null and requested_product_count = 0 then
    raise exception using errcode = '22023', message = 'INCOME_ITEM_REQUIRED';
  end if;

  -- Migration 014 established category-first mutation ordering. Hold the
  -- corresponding category locks before taking product row locks.
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

  sale_total := service_base + product_base;
  if payment_total <> sale_total then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
  end if;

  -- Products are already locked. Serialize a possible visit increment in the
  -- same product -> customer order used by void_income.
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

  effective_service_rate := case
    when responsible_role = 'owner' then 0
    when full_service then 100
    else employee_record.service_commission_rate
  end;
  effective_product_rate := case
    when responsible_role = 'owner' then 0
    else employee_record.product_commission_rate
  end;
  service_amount := round(
    service_base::numeric * effective_service_rate::numeric / 100
  )::integer;

  -- Calculate every product line independently; mixed effective rates remain
  -- represented by the item rows while the parent keeps the configured base rate.
  for product_record in
    select
      p.price,
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
  loop
    product_line_subtotal := product_record.price * product_record.quantity;
    product_line_rate := case
      when responsible_role = 'owner' then 0
      when product_record.full_commission then 100
      else effective_product_rate
    end;
    product_line_amount := round(
      product_line_subtotal::numeric * product_line_rate::numeric / 100
    )::integer;
    product_amount := product_amount + product_line_amount;
  end loop;

  total_commission := service_amount + product_amount;
  net_amount := sale_total - total_commission;

  insert into public.incomes (
    request_id, registered_by, employee_id, responsible_role_snapshot,
    request_fingerprint, customer_id, payment_method, total,
    service_commission_base, product_commission_base,
    service_commission_rate, product_commission_rate,
    service_commission_amount, product_commission_amount,
    commission_total, barbershop_net,
    full_service_commission, full_service_commission_authorized_by,
    created_at, business_date
  ) values (
    income_request_id, actor_user_id, effective_employee_id, responsible_role,
    fingerprint, selected_customer_id,
    case when requested_payment_count = 1
      then payment_items->0->>'method' else null end,
    sale_total, service_base, product_base,
    effective_service_rate, effective_product_rate,
    service_amount, product_amount, total_commission, net_amount,
    full_service, case when full_service then actor_user_id else null end,
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
      service_record.price, 1, service_base, effective_service_rate,
      service_amount, full_service,
      case when full_service then actor_user_id else null end,
      sale_created_at
    );
  end if;

  for product_record in
    select
      p.id,
      p.name,
      p.price,
      p.stock,
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
  loop
    product_line_subtotal := product_record.price * product_record.quantity;
    product_line_rate := case
      when responsible_role = 'owner' then 0
      when product_record.full_commission then 100
      else effective_product_rate
    end;
    product_line_amount := round(
      product_line_subtotal::numeric * product_line_rate::numeric / 100
    )::integer;

    insert into public.income_items (
      income_id, item_type, product_id, name_snapshot, unit_price, quantity,
      line_subtotal, commission_rate, commission_amount, full_commission,
      full_commission_authorized_by, created_at
    ) values (
      created_income_id, 'product', product_record.id, product_record.name,
      product_record.price, product_record.quantity, product_line_subtotal,
      product_line_rate, product_line_amount, product_record.full_commission,
      case when product_record.full_commission then actor_user_id else null end,
      sale_created_at
    );

    update public.products
    set
      stock = product_record.stock - product_record.quantity,
      updated_by = actor_user_id
    where id = product_record.id;

    insert into public.inventory_movements (
      product_id, movement_type, quantity_delta, stock_after,
      user_id, income_id, created_at
    ) values (
      product_record.id, 'sale', -product_record.quantity,
      product_record.stock - product_record.quantity,
      actor_user_id, created_income_id, sale_created_at
    );
  end loop;

  insert into public.income_payments (income_id, method, amount, created_at)
  select
    created_income_id,
    item->>'method',
    (item->>'amount')::bigint,
    sale_created_at
  from jsonb_array_elements(payment_items) item;

  if selected_customer_id is not null then
    update public.customers
    set visits = visits + 1, updated_by = actor_user_id
    where id = selected_customer_id;
  end if;

  return created_income_id;
end;
$$;

revoke execute on function public.prevent_income_item_snapshot_mutation()
  from public, anon, authenticated;
revoke execute on function public.income_as_json(uuid)
  from public, anon, authenticated;
revoke execute on function public.create_income(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean
) from public, anon, authenticated;

grant execute on function public.income_as_json(uuid) to service_role;
grant execute on function public.create_income(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean
) to service_role;

revoke execute on function public.create_income_v2(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean
) from public, anon, authenticated, service_role;
drop function public.create_income_v2(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean
);

notify pgrst, 'reload schema';

commit;
