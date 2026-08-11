-- Bastardos Barberia: persistent products and auditable inventory.
-- Run after 007_user_soft_deletion.sql.

create or replace function public.normalize_catalog_name(value text)
returns text
language sql
stable
set search_path = ''
as $$
  select regexp_replace(
    lower(extensions.unaccent(trim(value))),
    '[[:space:]]+',
    ' ',
    'g'
  );
$$;

create table if not exists public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  category text not null,
  price integer not null,
  stock integer not null default 0,
  is_active boolean not null default true,
  created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_check check (char_length(trim(name)) between 1 and 120),
  constraint products_normalized_name_check check (char_length(normalized_name) between 1 and 120),
  constraint products_category_check check (
    category in ('hair-care', 'styling', 'beard-care', 'fragrance')
  ),
  constraint products_price_check check (price >= 0),
  constraint products_stock_check check (stock >= 0)
);

create table if not exists public.inventory_movements (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null,
  quantity_delta integer not null,
  stock_after integer not null,
  user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint inventory_movements_type_check check (
    movement_type in ('initial', 'entry', 'exit', 'sale', 'sale_void')
  ),
  constraint inventory_movements_quantity_check check (quantity_delta <> 0),
  constraint inventory_movements_stock_check check (stock_after >= 0)
);

create index if not exists products_active_name_idx
  on public.products(is_active, normalized_name);
create index if not exists products_category_idx
  on public.products(category);
create index if not exists products_created_at_idx
  on public.products(created_at desc);
create index if not exists inventory_movements_product_created_at_idx
  on public.inventory_movements(product_id, created_at desc);
create index if not exists inventory_movements_user_created_at_idx
  on public.inventory_movements(user_id, created_at desc);

create or replace function public.set_product_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := trim(new.name);
  new.normalized_name := public.normalize_catalog_name(new.name);

  if new.normalized_name = '' then
    raise exception using errcode = '22023', message = 'INVALID_PRODUCT_NAME';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_set_fields on public.products;
create trigger products_set_fields
before insert or update of name, category, price, is_active, stock, updated_by
on public.products
for each row execute function public.set_product_fields();

create or replace function public.create_product(
  product_name text,
  product_category text,
  product_price integer,
  initial_stock integer,
  actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_product_name text;
  created_product_id uuid;
begin
  if not exists (
    select 1
    from public.users
    where id = actor_user_id
      and is_active
      and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  normalized_product_name := public.normalize_catalog_name(product_name);
  if normalized_product_name = '' then
    raise exception using errcode = '22023', message = 'INVALID_PRODUCT_NAME';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('product:' || normalized_product_name, 0)
  );

  if exists (
    select 1
    from public.products
    where normalized_name = normalized_product_name
  ) then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NAME_EXISTS';
  end if;

  insert into public.products (
    name,
    normalized_name,
    category,
    price,
    stock,
    created_by,
    updated_by
  ) values (
    product_name,
    normalized_product_name,
    product_category,
    product_price,
    initial_stock,
    actor_user_id,
    actor_user_id
  )
  returning id into created_product_id;

  if initial_stock > 0 then
    insert into public.inventory_movements (
      product_id,
      movement_type,
      quantity_delta,
      stock_after,
      user_id
    ) values (
      created_product_id,
      'initial',
      initial_stock,
      initial_stock,
      actor_user_id
    );
  end if;

  return created_product_id;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NAME_EXISTS';
end;
$$;

create or replace function public.adjust_product_stock(
  target_product_id uuid,
  actor_user_id uuid,
  movement_kind text,
  movement_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_stock integer;
  next_stock integer;
  quantity_delta integer;
begin
  if movement_kind not in ('entry', 'exit') or movement_quantity <= 0 then
    raise exception using errcode = '22023', message = 'INVALID_STOCK_ADJUSTMENT';
  end if;

  if not exists (
    select 1
    from public.users
    where id = actor_user_id
      and is_active
      and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  select stock
  into current_stock
  from public.products
  where id = target_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
  end if;

  quantity_delta := case
    when movement_kind = 'entry' then movement_quantity
    else -movement_quantity
  end;
  next_stock := current_stock + quantity_delta;

  if next_stock < 0 then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK';
  end if;

  update public.products
  set stock = next_stock
  where id = target_product_id;

  insert into public.inventory_movements (
    product_id,
    movement_type,
    quantity_delta,
    stock_after,
    user_id
  ) values (
    target_product_id,
    movement_kind,
    quantity_delta,
    next_stock,
    actor_user_id
  );

  return target_product_id;
end;
$$;

alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on table public.products from anon, authenticated;
revoke all on table public.inventory_movements from anon, authenticated;
revoke execute on function public.normalize_catalog_name(text)
  from public, anon, authenticated;
revoke execute on function public.set_product_fields()
  from public, anon, authenticated;
revoke execute on function public.create_product(text, text, integer, integer, uuid)
  from public, anon, authenticated;
revoke execute on function public.adjust_product_stock(uuid, uuid, text, integer)
  from public, anon, authenticated;

grant select, insert, update on table public.products to service_role;
grant select, insert on table public.inventory_movements to service_role;
grant execute on function public.normalize_catalog_name(text) to service_role;
grant execute on function public.set_product_fields() to service_role;
grant execute on function public.create_product(text, text, integer, integer, uuid)
  to service_role;
grant execute on function public.adjust_product_stock(uuid, uuid, text, integer)
  to service_role;

-- Read-only installation verification. Both rows must report rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('products', 'inventory_movements')
order by tablename;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('create_product', 'adjust_product_stock')
order by routine_name;
