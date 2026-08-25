-- Bastardos Barberia: employee work sessions, audited corrections and sale linkage.
-- Run after 018_automatic_daily_cash.sql as one complete migration.

begin;

create table public.employee_work_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  employee_id uuid not null references public.users(id) on delete restrict,
  business_date date not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  started_by uuid not null references public.users(id) on delete restrict,
  ended_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint employee_work_sessions_range_check check (
    ended_at is null or ended_at > started_at
  ),
  constraint employee_work_sessions_business_date_check check (
    business_date = (started_at at time zone 'America/Argentina/Buenos_Aires')::date
  ),
  constraint employee_work_sessions_end_actor_check check (
    (ended_at is null and ended_by is null)
    or (ended_at is not null and ended_by is not null)
  )
);

create unique index employee_work_sessions_one_open_idx
  on public.employee_work_sessions(employee_id)
  where ended_at is null;

create index employee_work_sessions_employee_date_idx
  on public.employee_work_sessions(employee_id, business_date desc, started_at desc);

create index employee_work_sessions_date_started_idx
  on public.employee_work_sessions(business_date desc, started_at desc);

create table public.employee_work_session_corrections (
  id uuid primary key default extensions.gen_random_uuid(),
  work_session_id uuid not null
    references public.employee_work_sessions(id) on delete restrict,
  corrected_by uuid not null references public.users(id) on delete restrict,
  reason text not null,
  prior_started_at timestamptz not null,
  prior_ended_at timestamptz,
  corrected_started_at timestamptz not null,
  corrected_ended_at timestamptz,
  corrected_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint employee_work_session_corrections_reason_check check (
    char_length(trim(reason)) between 1 and 500
  ),
  constraint employee_work_session_corrections_range_check check (
    corrected_ended_at is null or corrected_ended_at > corrected_started_at
  )
);

create index employee_work_session_corrections_session_idx
  on public.employee_work_session_corrections(work_session_id, corrected_at desc);

create function public.prevent_work_session_correction_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'WORK_SESSION_CORRECTION_IMMUTABLE';
end;
$$;

create trigger employee_work_session_corrections_prevent_mutation
before update or delete on public.employee_work_session_corrections
for each row execute function public.prevent_work_session_correction_mutation();

alter table public.incomes
  add column work_session_id uuid
    references public.employee_work_sessions(id) on delete restrict,
  add column outside_work_session boolean not null default false;

-- Historical employee-attributed incomes predate work sessions and therefore
-- cannot be assigned to a fabricated session.
update public.incomes
set outside_work_session = responsible_role_snapshot = 'employee'
where work_session_id is null;

alter table public.incomes
  add constraint incomes_work_session_audit_check check (
    work_session_id is null or not outside_work_session
  );

create index incomes_work_session_created_idx
  on public.incomes(work_session_id, created_at desc)
  where work_session_id is not null;

create or replace function public.work_session_as_json(
  target_session_id uuid,
  include_manager_metrics boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', session.id,
    'employee', jsonb_build_object(
      'id', employee.id,
      'firstName', employee.first_name,
      'lastName', employee.last_name
    ),
    'businessDate', session.business_date,
    'startedAt', session.started_at,
    'endedAt', session.ended_at,
    'updatedAt', session.updated_at,
    'state', case when session.ended_at is null then 'open' else 'closed' end,
    'metrics', case when include_manager_metrics then
      jsonb_build_object(
        'workedMinutes', greatest(
          floor(extract(epoch from (
            coalesce(session.ended_at, pg_catalog.clock_timestamp())
              - session.started_at
          )) / 60),
          0
        )::integer,
        'saleCount', metrics.sale_count,
        'employeeCommission', metrics.employee_commission,
        'grossTotal', metrics.gross_total,
        'barbershopNet', metrics.barbershop_net
      )
    else
      jsonb_build_object(
        'workedMinutes', greatest(
          floor(extract(epoch from (
            coalesce(session.ended_at, pg_catalog.clock_timestamp())
              - session.started_at
          )) / 60),
          0
        )::integer,
        'saleCount', metrics.sale_count,
        'employeeCommission', metrics.employee_commission
      )
    end
  ) into result
  from public.employee_work_sessions session
  join public.users employee on employee.id = session.employee_id
  cross join lateral (
    select
      count(*)::integer as sale_count,
      coalesce(sum(income.commission_total), 0)::bigint as employee_commission,
      coalesce(sum(income.total), 0)::bigint as gross_total,
      coalesce(sum(income.barbershop_net), 0)::bigint as barbershop_net
    from public.incomes income
    where income.work_session_id = session.id
      and income.status = 'active'
  ) metrics
  where session.id = target_session_id;

  return result;
end;
$$;

create or replace function public.start_work_session(
  employee_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee_role_id smallint;
  session_started_at timestamptz := pg_catalog.clock_timestamp();
  created_session_id uuid;
begin
  select role_id into employee_role_id
  from public.users
  where id = employee_user_id and is_active and deleted_at is null
  for share;

  if not found or employee_role_id <> 3 then
    raise exception using errcode = '42501', message = 'EMPLOYEE_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('employee-work-session:' || employee_user_id::text, 0)
  );

  if exists (
    select 1
    from public.employee_work_sessions
    where employee_id = employee_user_id and ended_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'WORK_SESSION_ALREADY_OPEN';
  end if;

  if exists (
    select 1
    from public.employee_work_sessions
    where employee_id = employee_user_id
      and coalesce(ended_at, 'infinity'::timestamptz) > session_started_at
  ) then
    raise exception using errcode = 'P0001', message = 'WORK_SESSION_CONFLICT';
  end if;

  insert into public.employee_work_sessions (
    employee_id, business_date, started_at, started_by
  ) values (
    employee_user_id,
    (session_started_at at time zone 'America/Argentina/Buenos_Aires')::date,
    session_started_at,
    employee_user_id
  ) returning id into created_session_id;

  return public.work_session_as_json(created_session_id, false);
end;
$$;

create or replace function public.end_work_session(
  employee_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee_role_id smallint;
  current_session record;
  session_ended_at timestamptz := pg_catalog.clock_timestamp();
begin
  select role_id into employee_role_id
  from public.users
  where id = employee_user_id and is_active and deleted_at is null
  for share;

  if not found or employee_role_id <> 3 then
    raise exception using errcode = '42501', message = 'EMPLOYEE_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('employee-work-session:' || employee_user_id::text, 0)
  );

  select id, started_at into current_session
  from public.employee_work_sessions
  where employee_id = employee_user_id and ended_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'WORK_SESSION_NOT_OPEN';
  end if;

  if session_ended_at <= current_session.started_at then
    raise exception using errcode = '22023', message = 'INVALID_WORK_SESSION_RANGE';
  end if;

  update public.employee_work_sessions
  set
    ended_at = session_ended_at,
    ended_by = employee_user_id,
    updated_at = session_ended_at
  where id = current_session.id;

  return public.work_session_as_json(current_session.id, false);
end;
$$;

create or replace function public.get_current_work_session(
  employee_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee_role_id smallint;
  current_session_id uuid;
begin
  select role_id into employee_role_id
  from public.users
  where id = employee_user_id and is_active and deleted_at is null;

  if not found or employee_role_id <> 3 then
    raise exception using errcode = '42501', message = 'EMPLOYEE_REQUIRED';
  end if;

  select id into current_session_id
  from public.employee_work_sessions
  where employee_id = employee_user_id and ended_at is null;

  if current_session_id is null then
    return null;
  end if;

  return public.work_session_as_json(current_session_id, false);
end;
$$;

drop function if exists public.correct_work_session(
  uuid, uuid, timestamptz, timestamptz, text
);

create or replace function public.correct_work_session(
  manager_user_id uuid,
  target_session_id uuid,
  expected_updated_at timestamptz,
  corrected_started_at timestamptz,
  corrected_ended_at timestamptz,
  correction_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_employee_id uuid;
  manager_role_id smallint;
  current_session record;
  clean_reason text := trim(coalesce(correction_reason, ''));
  correction_time timestamptz := pg_catalog.clock_timestamp();
begin
  if corrected_started_at is null
    or (corrected_ended_at is not null and corrected_ended_at <= corrected_started_at)
    or char_length(clean_reason) not between 1 and 500
  then
    raise exception using errcode = '22023', message = 'INVALID_WORK_SESSION_RANGE';
  end if;

  select employee_id into target_employee_id
  from public.employee_work_sessions
  where id = target_session_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'WORK_SESSION_NOT_FOUND';
  end if;

  perform 1
  from public.users
  where id in (manager_user_id, target_employee_id)
  order by id
  for share;

  select role_id into manager_role_id
  from public.users
  where id = manager_user_id and is_active and deleted_at is null;

  if not found or manager_role_id not in (1, 2) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('employee-work-session:' || target_employee_id::text, 0)
  );

  select * into current_session
  from public.employee_work_sessions
  where id = target_session_id
  for update;

  if current_session.updated_at is distinct from expected_updated_at then
    raise exception using errcode = 'P0001', message = 'WORK_SESSION_CONFLICT';
  end if;

  if exists (
    select 1
    from public.employee_work_sessions other
    where other.employee_id = current_session.employee_id
      and other.id <> current_session.id
      and tstzrange(
        other.started_at,
        coalesce(other.ended_at, 'infinity'::timestamptz),
        '[)'
      ) && tstzrange(
        corrected_started_at,
        coalesce(corrected_ended_at, 'infinity'::timestamptz),
        '[)'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'WORK_SESSION_CONFLICT';
  end if;

  insert into public.employee_work_session_corrections (
    work_session_id, corrected_by, reason,
    prior_started_at, prior_ended_at,
    corrected_started_at, corrected_ended_at, corrected_at
  ) values (
    current_session.id, manager_user_id, clean_reason,
    current_session.started_at, current_session.ended_at,
    corrected_started_at, corrected_ended_at, correction_time
  );

  update public.employee_work_sessions
  set
    business_date = (
      corrected_started_at at time zone 'America/Argentina/Buenos_Aires'
    )::date,
    started_at = corrected_started_at,
    ended_at = corrected_ended_at,
    ended_by = case
      when corrected_ended_at is null then null
      when current_session.ended_at is distinct from corrected_ended_at
        then manager_user_id
      else current_session.ended_by
    end,
    updated_at = correction_time
  where id = current_session.id;

  return public.work_session_as_json(current_session.id, true);
end;
$$;

create or replace function public.list_work_sessions(
  requesting_user_id uuid,
  filter_employee_id uuid,
  filter_date_from date,
  filter_date_to date,
  page_number integer,
  page_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_role_id smallint;
  effective_employee_id uuid;
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_page_size integer := least(greatest(coalesce(page_size, 12), 1), 100);
  total_count integer;
  result jsonb;
begin
  select role_id into requester_role_id
  from public.users
  where id = requesting_user_id and is_active and deleted_at is null;

  if not found then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  if filter_date_from is not null and filter_date_to is not null
    and filter_date_from > filter_date_to
  then
    raise exception using errcode = '22023', message = 'INVALID_WORK_SESSION_RANGE';
  end if;

  if requester_role_id = 3 then
    effective_employee_id := requesting_user_id;
  elsif requester_role_id in (1, 2) then
    effective_employee_id := filter_employee_id;
  else
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;

  select count(*)::integer into total_count
  from public.employee_work_sessions session
  where (effective_employee_id is null or session.employee_id = effective_employee_id)
    and (filter_date_from is null or session.business_date >= filter_date_from)
    and (filter_date_to is null or session.business_date <= filter_date_to);

  if requester_role_id = 3 then
    select jsonb_build_object(
      'items', coalesce(jsonb_agg(
        public.work_session_as_json(page.id, false)
        order by page.business_date desc, page.started_at desc, page.id desc
      ), '[]'::jsonb),
      'pagination', jsonb_build_object(
        'page', safe_page,
        'pageSize', safe_page_size,
        'total', total_count,
        'totalPages', case when total_count = 0 then 0
          else ceiling(total_count::numeric / safe_page_size)::integer end
      )
    ) into result
    from (
      select session.id, session.business_date, session.started_at
      from public.employee_work_sessions session
      where session.employee_id = requesting_user_id
        and (filter_date_from is null or session.business_date >= filter_date_from)
        and (filter_date_to is null or session.business_date <= filter_date_to)
      order by session.business_date desc, session.started_at desc, session.id desc
      limit safe_page_size offset (safe_page - 1) * safe_page_size
    ) page;
  else
    select jsonb_build_object(
      'items', coalesce(jsonb_agg(
        public.work_session_as_json(page.id, true)
        order by page.business_date desc, page.started_at desc, page.id desc
      ), '[]'::jsonb),
      'pagination', jsonb_build_object(
        'page', safe_page,
        'pageSize', safe_page_size,
        'total', total_count,
        'totalPages', case when total_count = 0 then 0
          else ceiling(total_count::numeric / safe_page_size)::integer end
      )
    ) into result
    from (
      select session.id, session.business_date, session.started_at
      from public.employee_work_sessions session
      where (filter_employee_id is null or session.employee_id = filter_employee_id)
        and (filter_date_from is null or session.business_date >= filter_date_from)
        and (filter_date_to is null or session.business_date <= filter_date_to)
      order by session.business_date desc, session.started_at desc, session.id desc
      limit safe_page_size offset (safe_page - 1) * safe_page_size
    ) page;
  end if;

  return result;
end;
$$;

create or replace function public.attach_income_work_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  responsible_role text;
  open_session_id uuid;
begin
  -- Use the same UUID-ordered identity locks as the canonical sale RPC, then
  -- derive both roles from authoritative current user rows.
  perform 1
  from public.users
  where id in (new.registered_by, new.employee_id)
  order by id
  for share;

  select case role_id
    when 1 then 'owner'
    when 2 then 'admin'
    when 3 then 'employee'
  end into actor_role
  from public.users
  where id = new.registered_by and is_active and deleted_at is null;

  if not found then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  select case role_id
    when 1 then 'owner'
    when 2 then 'admin'
    when 3 then 'employee'
  end into responsible_role
  from public.users
  where id = new.employee_id and is_active and deleted_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'EMPLOYEE_NOT_ELIGIBLE';
  end if;

  if responsible_role = 'employee' then
    select id into open_session_id
    from public.employee_work_sessions
    where employee_id = new.employee_id and ended_at is null
    for update;
  end if;

  if actor_role = 'employee' then
    if new.registered_by <> new.employee_id or open_session_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'EMPLOYEE_WORK_SESSION_REQUIRED';
    end if;
    new.work_session_id := open_session_id;
    new.outside_work_session := false;
  elsif responsible_role = 'employee' and open_session_id is not null then
    new.work_session_id := open_session_id;
    new.outside_work_session := false;
  else
    new.work_session_id := null;
    new.outside_work_session := responsible_role = 'employee';
  end if;

  return new;
end;
$$;

create trigger attach_income_work_session
before insert on public.incomes
for each row execute function public.attach_income_work_session();

alter table public.employee_work_sessions enable row level security;
alter table public.employee_work_session_corrections enable row level security;

revoke all on table public.employee_work_sessions from public, anon, authenticated;
revoke all on table public.employee_work_session_corrections from public, anon, authenticated;
revoke all on table public.employee_work_sessions from service_role;
revoke all on table public.employee_work_session_corrections from service_role;
grant select on table public.employee_work_sessions to service_role;
grant select on table public.employee_work_session_corrections to service_role;

revoke execute on function public.work_session_as_json(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke execute on function public.start_work_session(uuid)
  from public, anon, authenticated;
revoke execute on function public.end_work_session(uuid)
  from public, anon, authenticated;
revoke execute on function public.get_current_work_session(uuid)
  from public, anon, authenticated;
revoke execute on function public.correct_work_session(
  uuid, uuid, timestamptz, timestamptz, timestamptz, text
) from public, anon, authenticated;
revoke execute on function public.list_work_sessions(
  uuid, uuid, date, date, integer, integer
) from public, anon, authenticated;
revoke execute on function public.attach_income_work_session()
  from public, anon, authenticated, service_role;
revoke execute on function public.prevent_work_session_correction_mutation()
  from public, anon, authenticated, service_role;

grant execute on function public.start_work_session(uuid) to service_role;
grant execute on function public.end_work_session(uuid) to service_role;
grant execute on function public.get_current_work_session(uuid) to service_role;
grant execute on function public.correct_work_session(
  uuid, uuid, timestamptz, timestamptz, timestamptz, text
) to service_role;
grant execute on function public.list_work_sessions(
  uuid, uuid, date, date, integer, integer
) to service_role;

notify pgrst, 'reload schema';

commit;
