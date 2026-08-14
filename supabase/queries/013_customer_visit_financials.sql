-- Bastardos Barberia: immutable financial detail in customer visit history.
-- Run after 012_owner_commission_rules.sql as one complete migration.

begin;

-- Promote the schedule-aware customer mutations without changing their V2
-- signatures or bodies. The application already calls these canonical names.
create or replace function public.create_customer(
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
    created_customer_id, actor_user_id, fixed_schedule, null, business_date
  );
  return created_customer_id;
end;
$$;

create or replace function public.update_customer(
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
  new_fixed_schedule jsonb,
  expected_schedule_version integer
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

  if set_fixed_schedule then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('fixed-customer-schedule:' || target_customer_id::text, 0)
    );
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
      target_customer_id, actor_user_id, new_fixed_schedule,
      expected_schedule_version, business_date
    );
  end if;
  return target_customer_id;
end;
$$;

-- Active-sale snapshots only. This intentionally exposes historical catalog
-- prices and the immutable sale total, never operational or audit identities.
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
    select i.id, i.created_at, i.business_date, i.total
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
        'totalSpent', p.total,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'type', ii.item_type,
            'name', ii.name_snapshot,
            'quantity', ii.quantity,
            'unitPrice', ii.unit_price,
            'subtotal', ii.unit_price * ii.quantity
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

revoke execute on function public.create_customer(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.update_customer(
  uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, text,
  boolean, jsonb, integer
) from public, anon, authenticated;
revoke execute on function public.list_customer_visits(uuid, uuid, integer, integer)
  from public, anon, authenticated;

grant execute on function public.create_customer(uuid, text, text, text, text, jsonb)
  to service_role;
grant execute on function public.update_customer(
  uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, text,
  boolean, jsonb, integer
) to service_role;
grant execute on function public.list_customer_visits(uuid, uuid, integer, integer)
  to service_role;

revoke execute on function public.create_customer_v2(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.update_customer_v2(
  uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, text,
  boolean, jsonb, integer
) from public, anon, authenticated, service_role;

drop function public.create_customer_v2(uuid, text, text, text, text, jsonb);
drop function public.update_customer_v2(
  uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, text,
  boolean, jsonb, integer
);

notify pgrst, 'reload schema';

commit;
