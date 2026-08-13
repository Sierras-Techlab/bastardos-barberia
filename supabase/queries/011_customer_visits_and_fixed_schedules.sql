-- Bastardos Barberia: customer visit projection, weekly schedules and attendance.
-- Run after 010_income_commissions_and_split_payments.sql as one complete migration.

begin;

create table public.customer_fixed_schedules (
  customer_id uuid primary key references public.customers(id) on delete restrict,
  weekday smallint not null check (weekday between 1 and 7),
  local_time time not null,
  is_active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fixed_customer_occurrences (
  id uuid primary key default extensions.gen_random_uuid(),
  schedule_customer_id uuid not null references public.customer_fixed_schedules(customer_id) on delete restrict,
  schedule_version integer not null check (schedule_version > 0),
  customer_id uuid not null references public.customers(id) on delete restrict,
  occurrence_date date not null,
  scheduled_time time not null,
  status text not null default 'pending' check (status in ('pending', 'attended', 'missed')),
  status_changed_by uuid references public.users(id) on delete restrict,
  status_changed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fixed_occurrence_resolution_check check (
    (status = 'pending' and status_changed_by is null and status_changed_at is null)
    or (status in ('attended', 'missed') and status_changed_by is not null and status_changed_at is not null)
  ),
  constraint fixed_occurrence_schedule_version_date_key
    unique (schedule_customer_id, schedule_version, occurrence_date)
);

create index fixed_occurrences_date_time_idx
  on public.fixed_customer_occurrences(occurrence_date, scheduled_time, id);
create index fixed_occurrences_customer_date_idx
  on public.fixed_customer_occurrences(customer_id, occurrence_date desc);
create index fixed_occurrences_pending_date_idx
  on public.fixed_customer_occurrences(occurrence_date, scheduled_time)
  where status = 'pending';

create or replace function public.ensure_fixed_customer_occurrences(
  date_from date,
  date_to date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if date_from is null or date_to is null
    or date_to < date_from
    or date_to - date_from > 70
  then
    raise exception using errcode = '22023', message = 'INVALID_OCCURRENCE_RANGE';
  end if;

  insert into public.fixed_customer_occurrences (
    schedule_customer_id, schedule_version, customer_id,
    occurrence_date, scheduled_time
  )
  select s.customer_id, s.version, s.customer_id, day_series.day_value::date, s.local_time
  from public.customer_fixed_schedules s
  join public.customers c on c.id = s.customer_id and c.deleted_at is null
  cross join generate_series(date_from, date_to, interval '1 day') as day_series(day_value)
  where s.is_active
    and extract(isodow from day_series.day_value)::smallint = s.weekday
  on conflict (schedule_customer_id, schedule_version, occurrence_date) do nothing;
end;
$$;

create or replace function public.sync_customer_fixed_schedule(
  target_customer_id uuid,
  actor_user_id uuid,
  new_fixed_schedule jsonb,
  business_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_schedule record;
  parsed_weekday smallint;
  parsed_time time;
  next_version integer;
begin
  select * into current_schedule
  from public.customer_fixed_schedules
  where customer_id = target_customer_id
  for update;

  if new_fixed_schedule is null or new_fixed_schedule = 'null'::jsonb then
    if found then
      update public.customer_fixed_schedules
      set is_active = false, updated_by = actor_user_id, updated_at = now()
      where customer_id = target_customer_id;

      delete from public.fixed_customer_occurrences
      where schedule_customer_id = target_customer_id
        and occurrence_date > business_date
        and status = 'pending';
    end if;
    return;
  end if;

  begin
    if jsonb_typeof(new_fixed_schedule) <> 'object'
      or not (new_fixed_schedule ? 'weekday')
      or not (new_fixed_schedule ? 'time')
      or (select count(*) from jsonb_object_keys(new_fixed_schedule)) <> 2
      or (new_fixed_schedule->>'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then
      raise exception using errcode = '22023', message = 'FIXED_SCHEDULE_INVALID';
    end if;
    parsed_weekday := (new_fixed_schedule->>'weekday')::smallint;
    parsed_time := (new_fixed_schedule->>'time')::time;
    if parsed_weekday not between 1 and 7 then
      raise exception using errcode = '22023', message = 'FIXED_SCHEDULE_INVALID';
    end if;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'FIXED_SCHEDULE_INVALID';
  end;

  if current_schedule.customer_id is null then
    insert into public.customer_fixed_schedules (
      customer_id, weekday, local_time, created_by, updated_by
    ) values (
      target_customer_id, parsed_weekday, parsed_time, actor_user_id, actor_user_id
    );
  elsif current_schedule.is_active
    and current_schedule.weekday = parsed_weekday
    and current_schedule.local_time = parsed_time
  then
    update public.customer_fixed_schedules
    set updated_by = actor_user_id, updated_at = now()
    where customer_id = target_customer_id;
  else
    next_version := current_schedule.version + 1;
    delete from public.fixed_customer_occurrences
    where schedule_customer_id = target_customer_id
      and occurrence_date > business_date
      and status = 'pending';

    update public.customer_fixed_schedules
    set weekday = parsed_weekday,
        local_time = parsed_time,
        is_active = true,
        version = next_version,
        updated_by = actor_user_id,
        updated_at = now()
    where customer_id = target_customer_id;
  end if;

  perform public.ensure_fixed_customer_occurrences(business_date, business_date + 56);
end;
$$;

create or replace function public.create_customer_v2(
  actor_user_id uuid,
  new_first_name text,
  new_last_name text,
  new_phone text,
  new_email text,
  fixed_schedule jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_customer_id uuid;
  business_date date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  insert into public.customers (
    first_name, last_name, phone, normalized_phone, email, created_by, updated_by
  ) values (
    new_first_name, new_last_name, new_phone, '', new_email, actor_user_id, actor_user_id
  ) returning id into created_customer_id;

  perform public.sync_customer_fixed_schedule(
    created_customer_id, actor_user_id, fixed_schedule, business_date
  );
  return created_customer_id;
end;
$$;

create or replace function public.update_customer_v2(
  target_customer_id uuid,
  actor_user_id uuid,
  set_first_name boolean,
  new_first_name text,
  set_last_name boolean,
  new_last_name text,
  set_phone boolean,
  new_phone text,
  set_email boolean,
  new_email text,
  set_fixed_schedule boolean,
  new_fixed_schedule jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_date date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  perform 1 from public.customers
  where id = target_customer_id and deleted_at is null
  for update;
  if not found then return null; end if;

  update public.customers
  set first_name = case when set_first_name then new_first_name else first_name end,
      last_name = case when set_last_name then new_last_name else last_name end,
      phone = case when set_phone then new_phone else phone end,
      email = case when set_email then new_email else email end,
      updated_by = actor_user_id
  where id = target_customer_id;

  if set_fixed_schedule then
    perform public.sync_customer_fixed_schedule(
      target_customer_id, actor_user_id, new_fixed_schedule, business_date
    );
  end if;
  return target_customer_id;
end;
$$;

create or replace function public.list_customer_visits(
  actor_user_id uuid,
  target_customer_id uuid,
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
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_page_size integer := least(greatest(coalesce(page_size, 20), 1), 100);
  result jsonb;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  if not exists (
    select 1 from public.customers
    where id = target_customer_id and deleted_at is null
  ) then
    return null;
  end if;

  with visits as materialized (
    select i.id, i.created_at, i.business_date
    from public.incomes i
    where i.customer_id = target_customer_id and i.status = 'active'
  ), page_rows as (
    select * from visits
    order by created_at desc, id desc
    offset ((safe_page - 1) * safe_page_size)
    limit safe_page_size
  ), totals as (
    select count(*)::integer as total from visits
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'occurredAt', p.created_at,
        'businessDate', p.business_date,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'type', ii.item_type,
            'name', ii.name_snapshot,
            'quantity', ii.quantity
          ) order by ii.created_at, ii.id)
          from public.income_items ii where ii.income_id = p.id
        ), '[]'::jsonb)
      ) order by p.created_at desc, p.id desc)
      from page_rows p
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', safe_page,
      'pageSize', safe_page_size,
      'total', totals.total,
      'totalPages', case when totals.total = 0 then 0
        else ceiling(totals.total::numeric / safe_page_size)::integer end
    )
  ) into result
  from totals;
  return result;
end;
$$;

create or replace function public.fixed_customer_occurrence_as_json(target_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'customer', jsonb_build_object(
      'id', c.id, 'firstName', c.first_name, 'lastName', c.last_name
    ),
    'date', o.occurrence_date,
    'time', to_char(o.scheduled_time, 'HH24:MI'),
    'status', o.status
  )
  from public.fixed_customer_occurrences o
  join public.customers c on c.id = o.customer_id and c.deleted_at is null
  where o.id = target_id;
$$;

create or replace function public.list_fixed_customer_occurrences(
  actor_user_id uuid,
  date_from date,
  date_to date,
  filter_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  if filter_status is not null and filter_status not in ('pending', 'attended', 'missed') then
    raise exception using errcode = '22023', message = 'INVALID_OCCURRENCE_STATUS';
  end if;

  perform public.ensure_fixed_customer_occurrences(date_from, date_to);
  select coalesce(jsonb_agg(
    public.fixed_customer_occurrence_as_json(o.id)
    order by o.occurrence_date, o.scheduled_time, o.id
  ), '[]'::jsonb) into result
  from public.fixed_customer_occurrences o
  join public.customers c on c.id = o.customer_id and c.deleted_at is null
  where o.occurrence_date between date_from and date_to
    and (filter_status is null or o.status = filter_status);
  return result;
end;
$$;

create or replace function public.resolve_fixed_customer_occurrence(
  actor_user_id uuid,
  target_occurrence_id uuid,
  new_status text,
  expected_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  if new_status not in ('attended', 'missed') or expected_status <> 'pending' then
    raise exception using errcode = '22023', message = 'INVALID_OCCURRENCE_STATUS';
  end if;

  update public.fixed_customer_occurrences
  set status = new_status,
      status_changed_by = actor_user_id,
      status_changed_at = now()
  where id = target_occurrence_id and status = expected_status;

  if not found then
    if not exists (select 1 from public.fixed_customer_occurrences where id = target_occurrence_id) then
      raise exception using errcode = 'P0001', message = 'FIXED_OCCURRENCE_NOT_FOUND';
    end if;
    raise exception using errcode = 'P0001', message = 'FIXED_OCCURRENCE_ALREADY_RESOLVED';
  end if;
  return public.fixed_customer_occurrence_as_json(target_occurrence_id);
end;
$$;

alter table public.customer_fixed_schedules enable row level security;
alter table public.fixed_customer_occurrences enable row level security;
revoke all on table public.customer_fixed_schedules from anon, authenticated;
revoke all on table public.fixed_customer_occurrences from anon, authenticated;
grant select, insert, update, delete on table public.customer_fixed_schedules to service_role;
grant select, insert, update, delete on table public.fixed_customer_occurrences to service_role;

revoke execute on function public.ensure_fixed_customer_occurrences(date, date) from public, anon, authenticated;
revoke execute on function public.sync_customer_fixed_schedule(uuid, uuid, jsonb, date) from public, anon, authenticated;
revoke execute on function public.create_customer_v2(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.update_customer_v2(uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, text, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.list_customer_visits(uuid, uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.fixed_customer_occurrence_as_json(uuid) from public, anon, authenticated;
revoke execute on function public.list_fixed_customer_occurrences(uuid, date, date, text) from public, anon, authenticated;
revoke execute on function public.resolve_fixed_customer_occurrence(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.ensure_fixed_customer_occurrences(date, date) to service_role;
grant execute on function public.sync_customer_fixed_schedule(uuid, uuid, jsonb, date) to service_role;
grant execute on function public.create_customer_v2(uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.update_customer_v2(uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, text, boolean, jsonb) to service_role;
grant execute on function public.list_customer_visits(uuid, uuid, integer, integer) to service_role;
grant execute on function public.fixed_customer_occurrence_as_json(uuid) to service_role;
grant execute on function public.list_fixed_customer_occurrences(uuid, date, date, text) to service_role;
grant execute on function public.resolve_fixed_customer_occurrence(uuid, uuid, text, text) to service_role;

notify pgrst, 'reload schema';

commit;
