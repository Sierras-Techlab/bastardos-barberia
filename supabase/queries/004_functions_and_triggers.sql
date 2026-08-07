-- Bastardos Barbería: normalization and timestamp triggers.
-- Run after 003_sessions.sql.

create or replace function public.normalize_username_component(value text)
returns text
language sql
stable
set search_path = ''
as $$
  select regexp_replace(
    lower(extensions.unaccent(trim(value))),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

create or replace function public.set_user_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_component text;
  last_component text;
  base_username text;
  candidate text;
  suffix integer := 2;
begin
  new.first_name := trim(new.first_name);
  new.last_name := trim(new.last_name);
  first_component := public.normalize_username_component(new.first_name);
  last_component := public.normalize_username_component(new.last_name);

  if first_component = '' or last_component = '' then
    raise exception using errcode = '22023', message = 'INVALID_USERNAME_COMPONENT';
  end if;

  base_username := first_component || '.' || last_component;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(base_username, 0));
  candidate := base_username;

  while exists (select 1 from public.users where username = candidate) loop
    candidate := base_username || suffix::text;
    suffix := suffix + 1;
  end loop;

  new.username := candidate;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.touch_user_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.first_name := trim(new.first_name);
  new.last_name := trim(new.last_name);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists users_generate_username on public.users;
create trigger users_generate_username before insert on public.users
for each row execute function public.set_user_username();

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at before update on public.users
for each row execute function public.touch_user_updated_at();
