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

notify pgrst, 'reload schema';

commit;