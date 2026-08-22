-- Bastardos Barberia: derive each customer's last qualifying visit from active
-- normal sales. Run after 022_manual_cash_lifecycle.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. Supporting partial index
-- ---------------------------------------------------------------------------

create index if not exists incomes_active_sale_customer_business_idx
  on public.incomes(customer_id, business_date desc, created_at desc)
  where status = 'active' and source_type = 'sale' and customer_id is not null;

-- ---------------------------------------------------------------------------
-- 2. list_customers: promotes the canonical customer RPC
-- ---------------------------------------------------------------------------

create or replace function public.list_customers(actor_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id and is_active and deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  with latest_sale as (
    select distinct on (i.customer_id)
      i.customer_id,
      to_char(
        (i.business_date at time zone 'America/Argentina/Buenos_Aires')::date,
        'YYYY-MM-DD'
      ) as last_visit_business_date
    from public.incomes i
    where i.status = 'active'
      and i.source_type = 'sale'
      and i.customer_id is not null
    order by i.customer_id, i.business_date desc, i.created_at desc
  )
  select coalesce(jsonb_agg(row_data order by row_data ->> 'lastName', row_data ->> 'firstName'), '[]'::jsonb)
    into result
  from (
    select jsonb_build_object(
      'id', c.id,
      'firstName', c.first_name,
      'lastName', c.last_name,
      'email', c.email,
      'phone', c.phone,
      'visits', c.visits,
      'createdAt', c.created_at,
      'lastVisitBusinessDate', ls.last_visit_business_date,
      'fixedSchedule', case when s.is_active then jsonb_build_object(
        'weekday', s.weekday,
        'time', to_char(s.local_time, 'HH24:MI'),
        'responsibleProfessional', jsonb_build_object(
          'id', u.id, 'firstName', u.first_name, 'lastName', u.last_name
        ),
        'monthlyPrice', s.monthly_price
      ) else null end,
      'fixedScheduleVersion', case when s.is_active then s.version else null end
    ) as row_data
    from public.customers c
    left join latest_sale ls on ls.customer_id = c.id
    left join public.customer_fixed_schedules s on s.customer_id = c.id and s.is_active
    left join public.users u on u.id = s.responsible_user_id
    where c.deleted_at is null
  ) as customers;

  return result;
end;
$$;

revoke execute on function public.list_customers(uuid) from public, anon, authenticated;
grant execute on function public.list_customers(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. get_customer_visits: also derive lastVisitBusinessDate from the active
--    sale projection, ensuring consistent shape across the customer RPCs.
-- ---------------------------------------------------------------------------

create or replace function public.get_customer_visits(
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
    where i.customer_id = target_customer_id and i.status = 'active' and i.source_type = 'sale'
  ), page_rows as (
    select * from visits
    order by created_at desc, id desc
    offset ((safe_page - 1) * safe_page_size) limit safe_page_size
  ), totals as (
    select count(*)::integer as total from visits
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'occurredAt', p.created_at,
        'businessDate', to_char((p.business_date at time zone 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD'),
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

revoke execute on function public.get_customer_visits(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.get_customer_visits(uuid, uuid, integer, integer) to service_role;

notify pgrst, 'reload schema';

commit;
