-- Bastardos Barberia: administrable, audited product categories.
-- Run after 013_customer_visit_financials.sql as one complete migration.

begin;

create table public.product_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  is_active boolean not null default true,
  -- The four installation seeds can be created before the first owner exists.
  -- Application creation provides both actors; later seed updates retain their
  -- system creator and record the manager who performed the update.
  created_by uuid references public.users(id) on delete restrict,
  updated_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_name_check check (char_length(trim(name)) between 1 and 80),
  constraint product_categories_normalized_name_check check (
    char_length(normalized_name) between 1 and 80
  ),
  constraint product_categories_audit_check check (
    created_by is null or updated_by is not null
  )
);

create index product_categories_active_normalized_name_idx
  on public.product_categories(normalized_name)
  where is_active;

create or replace function public.set_product_category_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := trim(new.name);
  new.normalized_name := public.normalize_catalog_name(new.name);

  if new.normalized_name = '' then
    raise exception using errcode = '22023', message = 'INVALID_PRODUCT_CATEGORY_NAME';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger product_categories_set_fields
before insert or update
on public.product_categories
for each row execute function public.set_product_category_fields();

create or replace function public.prevent_product_category_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '23503', message = 'PRODUCT_CATEGORY_PHYSICAL_DELETE_FORBIDDEN';
end;
$$;

create trigger product_categories_prevent_delete
before delete on public.product_categories
for each row execute function public.prevent_product_category_delete();

insert into public.product_categories (name, normalized_name)
values
  ('Cuidado capilar', ''),
  ('Peinado y styling', ''),
  ('Cuidado de barba', ''),
  ('Fragancias', '');

alter table public.products add column category_id uuid;

update public.products p
set category_id = c.id
from public.product_categories c
where (p.category = 'hair-care' and c.normalized_name = 'cuidado capilar')
   or (p.category = 'styling' and c.normalized_name = 'peinado y styling')
   or (p.category = 'beard-care' and c.normalized_name = 'cuidado de barba')
   or (p.category = 'fragrance' and c.normalized_name = 'fragancias');

do $$
begin
  if exists (select 1 from public.products where category_id is null) then
    raise exception 'PRODUCT_CATEGORY_BACKFILL_INCOMPLETE';
  end if;

  if exists (
    select 1
    from public.products p
    left join public.product_categories c on c.id = p.category_id
    where c.id is null
  ) then
    raise exception 'PRODUCT_CATEGORY_BACKFILL_ORPHAN';
  end if;
end;
$$;

alter table public.products
  alter column category_id set not null,
  add constraint products_category_id_fkey
    foreign key (category_id) references public.product_categories(id) on delete restrict;

drop index if exists public.products_category_idx;
create index products_category_id_idx on public.products(category_id);

drop trigger if exists products_set_fields on public.products;
create trigger products_set_fields
before insert or update of name, category_id, price, is_active, stock, updated_by
on public.products
for each row execute function public.set_product_fields();

alter table public.products drop constraint products_category_check;
alter table public.products drop column category;

-- The old text overload cannot coexist with the canonical UUID contract.
revoke execute on function public.create_product(text, text, integer, integer, uuid)
  from public, anon, authenticated, service_role;
drop function public.create_product(text, text, integer, integer, uuid);

-- Older development installations can retain the text category update
-- overload. Remove it before the UUID contract is installed so PostgREST
-- exposes exactly one canonical update_product signature.
do $$
begin
  if to_regprocedure('public.update_product(uuid,text,text,integer,boolean,uuid)') is not null then
    revoke execute on function public.update_product(
      uuid, text, text, integer, boolean, uuid
    ) from public, anon, authenticated, service_role;
    drop function public.update_product(uuid, text, text, integer, boolean, uuid);
  end if;
end;
$$;

create function public.create_product(
  product_name text,
  product_category_id uuid,
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
  category_record record;
begin
  if not exists (
    select 1
    from public.users
    where id = actor_user_id
      and role_id in (1, 2)
      and is_active
      and deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;

  select id, is_active into category_record
  from public.product_categories
  where id = product_category_id
  for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'PRODUCT_CATEGORY_NOT_FOUND';
  end if;
  if not category_record.is_active then
    raise exception using errcode = 'P0001', message = 'PRODUCT_CATEGORY_INACTIVE';
  end if;

  normalized_product_name := public.normalize_catalog_name(product_name);
  if normalized_product_name = '' then
    raise exception using errcode = '22023', message = 'INVALID_PRODUCT_NAME';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('product:' || normalized_product_name, 0)
  );

  if exists (
    select 1 from public.products where normalized_name = normalized_product_name
  ) then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NAME_EXISTS';
  end if;

  insert into public.products (
    name, normalized_name, category_id, price, stock, created_by, updated_by
  ) values (
    product_name, normalized_product_name, category_record.id, product_price,
    initial_stock, actor_user_id, actor_user_id
  ) returning id into created_product_id;

  if initial_stock > 0 then
    insert into public.inventory_movements (
      product_id, movement_type, quantity_delta, stock_after, user_id
    ) values (
      created_product_id, 'initial', initial_stock, initial_stock, actor_user_id
    );
  end if;

  return created_product_id;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NAME_EXISTS';
end;
$$;

create function public.update_product(
  target_product_id uuid,
  product_name text,
  product_category_id uuid,
  product_price integer,
  product_is_active boolean,
  actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  observed_category_id uuid;
  category_record record;
  updated_product_id uuid;
  normalized_product_name text;
begin
  if not exists (
    select 1
    from public.users
    where id = actor_user_id
      and role_id in (1, 2)
      and is_active
      and deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;

  loop
    select category_id into observed_category_id
    from public.products
    where id = target_product_id;

    if not found then
      return null;
    end if;

    select id, is_active into category_record
    from public.product_categories
    where id = coalesce(product_category_id, observed_category_id)
    for share;

    if not found then
      raise exception using errcode = 'P0001', message = 'PRODUCT_CATEGORY_NOT_FOUND';
    end if;
    if not category_record.is_active then
      raise exception using errcode = 'P0001', message = 'PRODUCT_CATEGORY_INACTIVE';
    end if;

    if product_name is not null then
      normalized_product_name := public.normalize_catalog_name(product_name);
      if normalized_product_name = '' then
        raise exception using errcode = '22023', message = 'INVALID_PRODUCT_NAME';
      end if;
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('product:' || normalized_product_name, 0)
      );
    end if;

    -- Lock the selected category before the product. When no new category was
    -- supplied, retry if another transaction moved the product meanwhile.
    update public.products
    set
      name = coalesce(product_name, name),
      category_id = coalesce(product_category_id, category_id),
      price = coalesce(product_price, price),
      is_active = coalesce(product_is_active, is_active),
      updated_by = actor_user_id
    where id = target_product_id
      and (product_category_id is not null or category_id = observed_category_id)
    returning id into updated_product_id;

    if found then
      return updated_product_id;
    end if;
  end loop;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NAME_EXISTS';
end;
$$;

create function public.deactivate_product_category(
  actor_user_id uuid,
  target_category_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_record record;
begin
  if not exists (
    select 1
    from public.users
    where id = actor_user_id
      and role_id in (1, 2)
      and is_active
      and deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;

  -- This exclusive category lock is intentionally acquired before inspecting
  -- products; create/update_product hold the corresponding shared lock.
  select id, is_active into category_record
  from public.product_categories
  where id = target_category_id
  for update;

  if not found then
    return null;
  end if;
  if not category_record.is_active then
    return category_record.id;
  end if;

  if exists (
    select 1
    from public.products
    where category_id = category_record.id and is_active
  ) then
    raise exception using errcode = 'P0001', message = 'PRODUCT_CATEGORY_IN_USE';
  end if;

  update public.product_categories
  set is_active = false, updated_by = actor_user_id
  where id = category_record.id;

  return category_record.id;
end;
$$;

alter table public.product_categories enable row level security;

revoke all on table public.product_categories from public, anon, authenticated;
grant select, insert, update on table public.product_categories to service_role;

revoke execute on function public.set_product_category_fields()
  from public, anon, authenticated;
revoke execute on function public.prevent_product_category_delete()
  from public, anon, authenticated;
revoke execute on function public.create_product(text, uuid, integer, integer, uuid)
  from public, anon, authenticated;
revoke execute on function public.update_product(uuid, text, uuid, integer, boolean, uuid)
  from public, anon, authenticated;
revoke execute on function public.deactivate_product_category(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.set_product_category_fields() to service_role;
grant execute on function public.prevent_product_category_delete() to service_role;
grant execute on function public.create_product(text, uuid, integer, integer, uuid)
  to service_role;
grant execute on function public.update_product(uuid, text, uuid, integer, boolean, uuid)
  to service_role;
grant execute on function public.deactivate_product_category(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;
