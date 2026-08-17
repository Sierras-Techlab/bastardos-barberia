-- Bastardos Barberia: atomic lockout and final-owner invariants.
-- Run after 005_security.sql.

create or replace function public.record_failed_login(
  target_user_id uuid,
  max_attempts smallint,
  attempted_at timestamptz,
  lock_until timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempts smallint;
  current_locked_until timestamptz;
  next_attempts smallint;
begin
  select failed_login_attempts, locked_until
  into current_attempts, current_locked_until
  from public.users
  where id = target_user_id
  for update;

  if not found then
    return;
  end if;

  if current_locked_until is not null and current_locked_until <= attempted_at then
    next_attempts := 1;
  else
    next_attempts := current_attempts + 1;
  end if;

  update public.users
  set
    failed_login_attempts = next_attempts,
    locked_until = case when next_attempts >= max_attempts then lock_until else null end
  where id = target_user_id;
end;
$$;

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
    and (select count(*) from public.users where role_id = 1 and is_active) <= 1
  then
    raise exception using errcode = 'P0001', message = 'LAST_OWNER_REQUIRED';
  end if;

  update public.users
  set
    first_name = case when set_first_name then new_first_name else first_name end,
    last_name = case when set_last_name then new_last_name else last_name end,
    role_id = case when set_role_id then new_role_id else role_id end,
    is_active = case when set_is_active then new_is_active else is_active end
  where id = target_user_id;

  return target_user_id;
end;
$$;

revoke execute on function public.record_failed_login(uuid, smallint, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.update_user_profile(uuid, boolean, text, boolean, text, boolean, smallint, boolean, boolean)
  from public, anon, authenticated;

grant execute on function public.record_failed_login(uuid, smallint, timestamptz, timestamptz)
  to service_role;
grant execute on function public.update_user_profile(uuid, boolean, text, boolean, text, boolean, smallint, boolean, boolean)
  to service_role;
