-- Bastardos Barberia: audit-preserving logical user deletion.
-- Run after 006_atomic_auth_guards.sql.

alter table public.users
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null;

create index if not exists users_not_deleted_created_at_idx
  on public.users(created_at desc)
  where deleted_at is null;

create or replace function public.update_user_profile(
  target_user_id uuid,
  set_first_name boolean,
  new_first_name text,
  set_last_name boolean,
  new_last_name text,
  set_role_id boolean,
  new_role_id smallint,
  set_is_active boolean,
  new_is_active boolean
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
    is_active = case when set_is_active then new_is_active else is_active end
  where id = target_user_id
    and deleted_at is null;

  return target_user_id;
end;
$$;

create or replace function public.soft_delete_user(
  target_user_id uuid,
  actor_user_id uuid,
  deletion_time timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role_id smallint;
  target_is_active boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('bastardos_active_owner', 0)
  );

  select role_id, is_active
  into target_role_id, target_is_active
  from public.users
  where id = target_user_id
    and deleted_at is null
  for update;

  if not found then
    return null;
  end if;

  if target_user_id = actor_user_id then
    raise exception using errcode = 'P0001', message = 'CANNOT_DELETE_SELF';
  end if;

  if target_role_id = 1
    and target_is_active
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
    is_active = false,
    deleted_at = deletion_time,
    deleted_by = actor_user_id,
    updated_at = deletion_time
  where id = target_user_id;

  update public.sessions
  set revoked_at = coalesce(revoked_at, deletion_time)
  where user_id = target_user_id;

  return target_user_id;
end;
$$;

revoke execute on function public.soft_delete_user(uuid, uuid, timestamptz)
  from public, anon, authenticated;

grant execute on function public.soft_delete_user(uuid, uuid, timestamptz)
  to service_role;
