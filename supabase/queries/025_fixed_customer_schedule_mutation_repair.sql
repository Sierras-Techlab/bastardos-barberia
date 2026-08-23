-- Bastardos Barberia: repair habitual-customer schedule mutations after 021.
-- Run once after 024_income_list_contract_repair.sql.

begin;

create or replace function public.sync_customer_fixed_schedule(
  target_customer_id uuid,
  actor_user_id uuid,
  new_fixed_schedule jsonb,
  expected_schedule_version integer,
  business_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_schedule record;
  actor_role text;
  parsed_weekday smallint;
  parsed_time time;
  parsed_responsible_user_id uuid;
  parsed_monthly_price integer;
  next_version integer;
  actual_version integer;
  generation_from date;
  schedule_exists boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fixed-customer-schedule:' || target_customer_id::text, 0)
  );

  select r.name into actor_role
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = actor_user_id and u.is_active and u.deleted_at is null;

  if actor_role is null then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  select * into current_schedule
  from public.customer_fixed_schedules
  where customer_id = target_customer_id
  for update;

  schedule_exists := found;
  actual_version := case when schedule_exists then current_schedule.version else 0 end;
  if expected_schedule_version is not null
    and expected_schedule_version <> actual_version
  then
    raise exception using errcode = 'P0001', message = 'FIXED_SCHEDULE_CONFLICT';
  end if;

  if new_fixed_schedule is null or new_fixed_schedule = 'null'::jsonb then
    if schedule_exists and current_schedule.is_active then
      update public.customer_fixed_schedules
      set is_active = false,
          version = current_schedule.version + 1,
          updated_by = actor_user_id,
          updated_at = now()
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
      or not (new_fixed_schedule ? 'responsible_user_id')
      or not (new_fixed_schedule ? 'monthly_price')
      or (select count(*) from jsonb_object_keys(new_fixed_schedule)) <> 4
      or (new_fixed_schedule->>'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then
      raise exception using errcode = '22023', message = 'FIXED_SCHEDULE_INVALID';
    end if;

    parsed_weekday := (new_fixed_schedule->>'weekday')::smallint;
    parsed_time := (new_fixed_schedule->>'time')::time;
    parsed_responsible_user_id := (new_fixed_schedule->>'responsible_user_id')::uuid;
    parsed_monthly_price := (new_fixed_schedule->>'monthly_price')::integer;

    if parsed_weekday not between 1 and 7 or parsed_monthly_price <= 0 then
      raise exception using errcode = '22023', message = 'FIXED_SCHEDULE_INVALID';
    end if;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'FIXED_SCHEDULE_INVALID';
  end;

  if not exists (
    select 1 from public.users
    where id = parsed_responsible_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'FIXED_SCHEDULE_INVALID';
  end if;

  if actor_role = 'employee' and parsed_responsible_user_id <> actor_user_id then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if not schedule_exists then
    insert into public.customer_fixed_schedules (
      customer_id, weekday, local_time, responsible_user_id, monthly_price,
      effective_from, created_by, updated_by
    ) values (
      target_customer_id, parsed_weekday, parsed_time,
      parsed_responsible_user_id, parsed_monthly_price,
      business_date, actor_user_id, actor_user_id
    );
    generation_from := business_date;
  elsif current_schedule.is_active
    and current_schedule.weekday = parsed_weekday
    and current_schedule.local_time = parsed_time
    and current_schedule.responsible_user_id = parsed_responsible_user_id
    and current_schedule.monthly_price = parsed_monthly_price
  then
    update public.customer_fixed_schedules
    set updated_by = actor_user_id, updated_at = now()
    where customer_id = target_customer_id;
    generation_from := greatest(business_date, current_schedule.effective_from);
  elsif not current_schedule.is_active then
    next_version := current_schedule.version + 1;
    generation_from := case when exists (
      select 1
      from public.fixed_customer_occurrences
      where schedule_customer_id = target_customer_id
        and occurrence_date = business_date
    ) then business_date + 1 else business_date end;

    delete from public.fixed_customer_occurrences
    where schedule_customer_id = target_customer_id
      and occurrence_date > business_date
      and status = 'pending';

    update public.customer_fixed_schedules
    set weekday = parsed_weekday,
        local_time = parsed_time,
        responsible_user_id = parsed_responsible_user_id,
        monthly_price = parsed_monthly_price,
        is_active = true,
        version = next_version,
        effective_from = generation_from,
        updated_by = actor_user_id,
        updated_at = now()
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
        responsible_user_id = parsed_responsible_user_id,
        monthly_price = parsed_monthly_price,
        is_active = true,
        version = next_version,
        effective_from = business_date + 1,
        updated_by = actor_user_id,
        updated_at = now()
    where customer_id = target_customer_id;
    generation_from := business_date + 1;
  end if;

  perform public.ensure_fixed_customer_occurrences_for_customer(
    target_customer_id, generation_from, business_date + 56
  );
end;
$$;

revoke all on function public.sync_customer_fixed_schedule(uuid, uuid, jsonb, integer, date) from public, anon, authenticated;
grant execute on function public.sync_customer_fixed_schedule(uuid, uuid, jsonb, integer, date) to service_role;

commit;
