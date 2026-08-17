-- Bastardos Barberia: safe physical deletion for unused product categories.
-- Run after 016_payment_methods.sql as one complete migration.

begin;

-- Migration 014 blocked every physical delete. The canonical RPC below now
-- owns that decision while the products foreign key remains ON DELETE RESTRICT.
drop trigger if exists product_categories_prevent_delete
  on public.product_categories;

drop function if exists public.prevent_product_category_delete();

create or replace function public.delete_product_category(
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

  -- Product creation/reassignment takes a shared lock on this same row. The
  -- exclusive lock serializes the reference check with those mutations.
  select id into category_record
  from public.product_categories
  where id = target_category_id
  for update;

  if not found then
    return null;
  end if;

  if exists (
    select 1
    from public.products
    where category_id = category_record.id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'PRODUCT_CATEGORY_HAS_PRODUCTS';
  end if;

  delete from public.product_categories
  where id = category_record.id;

  return category_record.id;
exception
  when foreign_key_violation then
    raise exception using
      errcode = 'P0001',
      message = 'PRODUCT_CATEGORY_HAS_PRODUCTS';
end;
$$;

revoke execute on function public.delete_product_category(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_product_category(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;
