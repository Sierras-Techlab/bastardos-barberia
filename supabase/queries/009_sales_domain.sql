-- Bastardos Barberia: persistent services, customers and transactional incomes.
-- Run after 008_products_inventory.sql.

create table if not exists public.services (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  price integer not null,
  is_active boolean not null default true,
  created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid not null references public.users(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_name_check check (char_length(trim(name)) between 1 and 120),
  constraint services_normalized_name_check check (char_length(normalized_name) between 1 and 120),
  constraint services_price_check check (price > 0),
  constraint services_deletion_check check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null and is_active = false)
  )
);

create unique index if not exists services_active_normalized_name_key
  on public.services(normalized_name)
  where deleted_at is null;
create index if not exists services_active_name_idx
  on public.services(is_active, normalized_name)
  where deleted_at is null;

create table if not exists public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  normalized_phone text not null,
  email text,
  visits integer not null default 0,
  created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid not null references public.users(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_first_name_check check (char_length(trim(first_name)) between 1 and 80),
  constraint customers_last_name_check check (char_length(trim(last_name)) between 1 and 80),
  constraint customers_phone_check check (char_length(normalized_phone) between 8 and 15),
  constraint customers_email_check check (email is null or char_length(email) between 3 and 254),
  constraint customers_visits_check check (visits >= 0),
  constraint customers_deletion_check check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  )
);

create unique index if not exists customers_active_normalized_phone_key
  on public.customers(normalized_phone)
  where deleted_at is null;
create unique index if not exists customers_active_email_key
  on public.customers(email)
  where deleted_at is null and email is not null;
create index if not exists customers_active_name_idx
  on public.customers(last_name, first_name)
  where deleted_at is null;

create table if not exists public.incomes (
  id uuid primary key default extensions.gen_random_uuid(),
  request_id uuid not null,
  user_id uuid not null references public.users(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete restrict,
  payment_method text not null,
  total integer not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  business_date date not null,
  voided_at timestamptz,
  voided_by uuid references public.users(id) on delete restrict,
  constraint incomes_request_actor_key unique (user_id, request_id),
  constraint incomes_payment_method_check check (payment_method in ('cash', 'transfer')),
  constraint incomes_total_check check (total > 0),
  constraint incomes_status_check check (status in ('active', 'voided')),
  constraint incomes_void_check check (
    (status = 'active' and voided_at is null and voided_by is null)
    or (status = 'voided' and voided_at is not null and voided_by is not null)
  )
);

create index if not exists incomes_business_date_created_at_idx
  on public.incomes(business_date desc, created_at desc);
create index if not exists incomes_user_business_date_created_at_idx
  on public.incomes(user_id, business_date desc, created_at desc);
create index if not exists incomes_customer_created_at_idx
  on public.incomes(customer_id, created_at desc)
  where customer_id is not null;

create table if not exists public.income_items (
  id uuid primary key default extensions.gen_random_uuid(),
  income_id uuid not null references public.incomes(id) on delete restrict,
  item_type text not null,
  service_id uuid references public.services(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  name_snapshot text not null,
  unit_price integer not null,
  quantity integer not null,
  subtotal integer generated always as (unit_price * quantity) stored,
  created_at timestamptz not null default now(),
  constraint income_items_type_check check (item_type in ('service', 'product')),
  constraint income_items_source_check check (
    (item_type = 'service' and service_id is not null and product_id is null)
    or (item_type = 'product' and service_id is null and product_id is not null)
  ),
  constraint income_items_name_check check (char_length(trim(name_snapshot)) between 1 and 120),
  constraint income_items_price_check check (unit_price > 0),
  constraint income_items_quantity_check check (quantity > 0),
  constraint income_items_service_quantity_check check (item_type <> 'service' or quantity = 1),
  constraint income_items_subtotal_check check (subtotal > 0)
);

create unique index if not exists income_items_one_service_per_income_key
  on public.income_items(income_id)
  where item_type = 'service';
create unique index if not exists income_items_one_product_per_income_key
  on public.income_items(income_id, product_id)
  where item_type = 'product';
create index if not exists income_items_income_idx
  on public.income_items(income_id);

alter table public.inventory_movements
  add column if not exists income_id uuid references public.incomes(id) on delete restrict;

alter table public.inventory_movements
  drop constraint if exists inventory_movements_income_check;
alter table public.inventory_movements
  add constraint inventory_movements_income_check check (
    (movement_type in ('sale', 'sale_void') and income_id is not null)
    or (movement_type in ('initial', 'entry', 'exit') and income_id is null)
  );

create unique index if not exists inventory_movements_income_product_type_key
  on public.inventory_movements(income_id, product_id, movement_type)
  where movement_type in ('sale', 'sale_void');

create or replace function public.normalize_customer_phone(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g');
$$;

create or replace function public.set_service_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := trim(new.name);
  new.normalized_name := public.normalize_catalog_name(new.name);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists services_set_fields on public.services;
create trigger services_set_fields
before insert or update of name, price, is_active, updated_by, deleted_at, deleted_by
on public.services
for each row execute function public.set_service_fields();

create or replace function public.set_customer_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.first_name := trim(new.first_name);
  new.last_name := trim(new.last_name);
  new.phone := trim(new.phone);
  new.normalized_phone := public.normalize_customer_phone(new.phone);
  new.email := nullif(lower(trim(new.email)), '');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customers_set_fields on public.customers;
create trigger customers_set_fields
before insert or update of first_name, last_name, phone, email, visits, updated_by, deleted_at, deleted_by
on public.customers
for each row execute function public.set_customer_fields();

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
      'id', u.id,
      'firstName', u.first_name,
      'lastName', u.last_name
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
    'paymentMethod', i.payment_method,
    'total', i.total,
    'status', i.status
  )
  from public.incomes i
  join public.users u on u.id = i.user_id
  left join public.customers c on c.id = i.customer_id
  where i.id = target_income_id;
$$;

create or replace function public.create_income(
  actor_user_id uuid,
  income_request_id uuid,
  selected_customer_id uuid,
  selected_service_id uuid,
  product_items jsonb,
  selected_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_income_id uuid;
  existing_income_id uuid;
  sale_created_at timestamptz := pg_catalog.clock_timestamp();
  sale_total integer := 0;
  service_record record;
  product_record record;
  requested_product_count integer;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  if income_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  if selected_payment_method not in ('cash', 'transfer') then
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_METHOD';
  end if;

  product_items := coalesce(product_items, '[]'::jsonb);
  if jsonb_typeof(product_items) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_PRODUCT_ITEMS';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_user_id::text || ':' || income_request_id::text, 0)
  );

  select id into existing_income_id
  from public.incomes
  where user_id = actor_user_id and request_id = income_request_id;

  if found then
    return existing_income_id;
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
    sale_total := sale_total + service_record.price;
  end if;

  begin
    select count(*) into requested_product_count
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

  if selected_service_id is null and requested_product_count = 0 then
    raise exception using errcode = '22023', message = 'INCOME_ITEM_REQUIRED';
  end if;

  for product_record in
    select p.id, p.name, p.price, p.stock, requested.quantity
    from public.products p
    join (
      select
        (item->>'productId')::uuid as product_id,
        (item->>'quantity')::integer as quantity
      from jsonb_array_elements(product_items) item
    ) requested on requested.product_id = p.id
    order by p.id
    for update of p
  loop
    if not exists (
      select 1 from public.products
      where id = product_record.id and is_active
    ) then
      raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_AVAILABLE';
    end if;
    if product_record.stock < product_record.quantity then
      raise exception using
        errcode = 'P0001',
        message = 'INSUFFICIENT_STOCK:' || product_record.name;
    end if;
    sale_total := sale_total + (product_record.price * product_record.quantity);
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

  insert into public.incomes (
    request_id, user_id, customer_id, payment_method, total, created_at, business_date
  ) values (
    income_request_id,
    actor_user_id,
    selected_customer_id,
    selected_payment_method,
    sale_total,
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
      select
        (item->>'productId')::uuid as product_id,
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

  if selected_customer_id is not null then
    update public.customers
    set visits = visits + 1, updated_by = actor_user_id
    where id = selected_customer_id;
  end if;

  return created_income_id;
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

  select id, customer_id, status into income_record
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

  if income_record.customer_id is not null then
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
      and ((can_view_all and requester_role_id in (1, 2)) or user_id = requesting_user_id)
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
    join public.users u on u.id = i.user_id
    left join public.customers c on c.id = i.customer_id
    where (effective_can_view_all or i.user_id = requesting_user_id)
      and (not effective_can_view_all or filter_user_id is null or i.user_id = filter_user_id)
      and (filter_date_from is null or i.business_date >= filter_date_from)
      and (filter_date_to is null or i.business_date <= filter_date_to)
      and (filter_payment_method is null or i.payment_method = filter_payment_method)
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
        or public.normalize_catalog_name(u.first_name || ' ' || u.last_name) like '%' || normalized_query || '%'
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
      coalesce(sum(total) filter (where status = 'active'), 0)::bigint as active_total,
      (count(*) filter (where status = 'active'))::integer as active_count,
      coalesce(sum(total) filter (where status = 'active' and payment_method = 'cash'), 0)::bigint as cash_total,
      coalesce(sum(total) filter (where status = 'active' and payment_method = 'transfer'), 0)::bigint as transfer_total
    from filtered
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
      'total', totals.active_total,
      'count', totals.active_count,
      'average', case when totals.active_count = 0 then 0 else round(totals.active_total::numeric / totals.active_count) end,
      'cashTotal', totals.cash_total,
      'transferTotal', totals.transfer_total
    ),
    'pagination', jsonb_build_object(
      'page', safe_page,
      'pageSize', safe_page_size,
      'total', totals.total_count,
      'totalPages', case
        when totals.total_count = 0 then 0
        else ceiling(totals.total_count::numeric / safe_page_size)::integer
      end
    )
  ) into result
  from totals;

  return result;
end;
$$;

alter table public.services enable row level security;
alter table public.customers enable row level security;
alter table public.incomes enable row level security;
alter table public.income_items enable row level security;

revoke all on table public.services from anon, authenticated;
revoke all on table public.customers from anon, authenticated;
revoke all on table public.incomes from anon, authenticated;
revoke all on table public.income_items from anon, authenticated;

revoke execute on function public.normalize_customer_phone(text) from public, anon, authenticated;
revoke execute on function public.set_service_fields() from public, anon, authenticated;
revoke execute on function public.set_customer_fields() from public, anon, authenticated;
revoke execute on function public.income_as_json(uuid) from public, anon, authenticated;
revoke execute on function public.create_income(uuid, uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.void_income(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.get_income_detail(uuid, boolean, uuid) from public, anon, authenticated;
revoke execute on function public.list_incomes(uuid, boolean, uuid, date, date, text, text, text, text, integer, integer)
  from public, anon, authenticated;

grant select, insert, update on table public.services to service_role;
grant select, insert, update on table public.customers to service_role;
grant select, insert, update on table public.incomes to service_role;
grant select, insert on table public.income_items to service_role;
grant execute on function public.normalize_customer_phone(text) to service_role;
grant execute on function public.set_service_fields() to service_role;
grant execute on function public.set_customer_fields() to service_role;
grant execute on function public.income_as_json(uuid) to service_role;
grant execute on function public.create_income(uuid, uuid, uuid, uuid, jsonb, text) to service_role;
grant execute on function public.void_income(uuid, uuid) to service_role;
grant execute on function public.get_income_detail(uuid, boolean, uuid) to service_role;
grant execute on function public.list_incomes(uuid, boolean, uuid, date, date, text, text, text, text, integer, integer)
  to service_role;

-- Read-only installation verification. Every table must report rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('services', 'customers', 'incomes', 'income_items')
order by tablename;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('create_income', 'void_income', 'list_incomes', 'get_income_detail')
order by routine_name;
