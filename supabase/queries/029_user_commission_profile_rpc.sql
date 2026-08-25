-- Bastardos Barberia: reconcile the commission-aware user profile RPC.
-- Run after 028_open_cash_projection_repair.sql. This patch is safe for databases that
-- already installed the earlier development revision of migration 010.

begin;

drop function if exists public.update_user_profile(
  uuid, boolean, text, boolean, text, boolean, smallint, boolean, boolean
);
drop function if exists public.update_user_profile_v2(
  uuid, boolean, text, boolean, text, boolean, smallint, boolean, boolean,
  boolean, smallint, boolean, smallint
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

revoke execute on function public.update_user_profile(
  uuid, boolean, text, boolean, text, boolean, smallint, boolean, boolean,
  boolean, smallint, boolean, smallint
) from public, anon, authenticated;

grant execute on function public.update_user_profile(
  uuid, boolean, text, boolean, text, boolean, smallint, boolean, boolean,
  boolean, smallint, boolean, smallint
) to service_role;

notify pgrst, 'reload schema';

commit;
