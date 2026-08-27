-- Bastardos Barberia: repair the role-aware income list JSON contract.
-- Run after 023_customer_last_visit.sql when migrations 020-023 are already installed.

begin;

create or replace function public.income_as_employee_json(target_income_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', i.id,
    'createdAt', i.created_at,
    'businessDate', i.business_date,
    'customer', case when c.id is null then null else jsonb_build_object(
      'id', c.id,
      'firstName', c.first_name,
      'lastName', c.last_name
    ) end,
    'concepts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', coalesce(ii.service_id, ii.product_id),
          'type', case when ii.item_type = 'service' then 'service' else 'product' end,
          'name', ii.name_snapshot,
          'quantity', ii.quantity,
          'earning', ii.commission_amount
        ) order by ii.item_type, ii.created_at, ii.id
      )
      from public.income_items ii
      where ii.income_id = i.id
    ), '[]'::jsonb),
    'employeeCommission', i.commission_total,
    'status', i.status
  )
  from public.incomes i
  left join public.customers c on c.id = i.customer_id
  where i.id = target_income_id;
$$;

revoke execute on function public.income_as_employee_json(uuid)
  from public, anon, authenticated;
grant execute on function public.income_as_employee_json(uuid) to service_role;

create or replace function public.get_income_detail(
  requesting_user_id uuid,
  can_view_all boolean,
  target_income_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role_id smallint;
begin
  select role_id into actor_role_id
  from public.users
  where id = requesting_user_id and is_active and deleted_at is null;

  if not found then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;

  if actor_role_id = 3 then
    if not exists (
      select 1
      from public.incomes i
      where i.id = target_income_id
        and i.employee_id = requesting_user_id
    ) then
      return null;
    end if;
    return public.income_as_employee_json(target_income_id);
  end if;

  return public.income_as_json(target_income_id);
end;
$$;

revoke execute on function public.get_income_detail(uuid, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.get_income_detail(uuid, boolean, uuid)
  to service_role;

create or replace function public.list_incomes(
  requesting_user_id uuid,
  can_view_all boolean,
  filter_user_id uuid,
  filter_date_from date,
  filter_date_to date,
  filter_payment_method_id uuid,
  filter_kind text,
  filter_status text,
  filter_query text,
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
  requester_role_id smallint;
  effective_can_view_all boolean;
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_page_size integer := least(greatest(coalesce(page_size, 10), 1), 100);
  normalized_query text := public.normalize_catalog_name(coalesce(filter_query, ''));
  result jsonb;
begin
  select role_id into requester_role_id
  from public.users
  where id = requesting_user_id and is_active and deleted_at is null;

  if not found then
    raise exception using errcode = '22023', message = 'INVALID_ACTOR';
  end if;
  effective_can_view_all := can_view_all and requester_role_id in (1, 2);

  if filter_payment_method_id is not null and not exists (
    select 1 from public.payment_methods where id = filter_payment_method_id
  ) then
    raise exception using errcode = '22023', message = 'INVALID_INCOME_FILTER';
  end if;
  if filter_kind is not null and filter_kind not in ('service', 'products', 'combined') then
    raise exception using errcode = '22023', message = 'INVALID_INCOME_FILTER';
  end if;
  if filter_status is not null and filter_status not in ('active', 'voided') then
    raise exception using errcode = '22023', message = 'INVALID_INCOME_FILTER';
  end if;

  with filtered as materialized (
    select i.*
    from public.incomes i
    join public.users employee on employee.id = i.employee_id
    left join public.customers c on c.id = i.customer_id
    where (effective_can_view_all or i.employee_id = requesting_user_id)
      and (not effective_can_view_all or filter_user_id is null or i.employee_id = filter_user_id)
      and (filter_date_from is null or i.business_date >= filter_date_from)
      and (filter_date_to is null or i.business_date <= filter_date_to)
      and (filter_payment_method_id is null or exists (
        select 1 from public.income_payments ip
        where ip.income_id = i.id and ip.payment_method_id = filter_payment_method_id
      ))
      and (filter_status is null or i.status::text = filter_status)
      and (
        filter_kind is null
        or (filter_kind = 'service'
          and exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'service')
          and not exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'product'))
        or (filter_kind = 'products'
          and exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'product')
          and not exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'service'))
        or (filter_kind = 'combined'
          and exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'service')
          and exists (select 1 from public.income_items x where x.income_id = i.id and x.item_type = 'product'))
      )
      and (
        normalized_query = ''
        or public.normalize_catalog_name(employee.first_name || ' ' || employee.last_name) like '%' || normalized_query || '%'
        or public.normalize_catalog_name(coalesce(c.first_name || ' ' || c.last_name, '')) like '%' || normalized_query || '%'
        or exists (
          select 1 from public.income_items x
          where x.income_id = i.id
            and public.normalize_catalog_name(x.name_snapshot) like '%' || normalized_query || '%'
        )
      )
  ), totals as (
    select
      count(*)::integer as total_count,
      coalesce(sum(gross_total) filter (where status = 'active'), 0)::bigint as gross_total,
      coalesce(sum(commission_total) filter (where status = 'active'), 0)::bigint as commission_total,
      coalesce(sum(barbershop_net) filter (where status = 'active'), 0)::bigint as barbershop_net,
      (count(*) filter (where status = 'active'))::integer as active_count
    from filtered
  ), payment_totals as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'paymentMethodId', pm.id,
      'name', pm.name,
      'amount', coalesce(sums.amount, 0)::bigint
    ) order by pm.created_at, pm.id), '[]'::jsonb) as totals_json
    from public.payment_methods pm
    left join (
      select ip.payment_method_id, sum(ip.amount) as amount
      from filtered f
      join public.income_payments ip on ip.income_id = f.id
      where f.status = 'active'
      group by ip.payment_method_id
    ) sums on sums.payment_method_id = pm.id
  ), page_rows as (
    select * from filtered
    order by created_at desc, id desc
    offset ((safe_page - 1) * safe_page_size)
    limit safe_page_size
  )
  select case when effective_can_view_all then
    jsonb_build_object(
      'items', coalesce((select jsonb_agg(public.income_as_json(p.id) order by p.created_at desc, p.id desc) from page_rows p), '[]'::jsonb),
      'metrics', jsonb_build_object(
        'grossTotal', totals.gross_total,
        'commissionTotal', totals.commission_total,
        'barbershopNet', totals.barbershop_net,
        'count', totals.active_count,
        'average', case when totals.active_count = 0 then 0 else round(totals.gross_total::numeric / totals.active_count) end,
        'paymentTotals', payment_totals.totals_json
      ),
      'pagination', jsonb_build_object(
        'page', safe_page,
        'pageSize', safe_page_size,
        'total', totals.total_count,
        'totalPages', case when totals.total_count = 0 then 0 else ceiling(totals.total_count::numeric / safe_page_size)::integer end
      )
    )
  else
    jsonb_build_object(
      'items', coalesce((select jsonb_agg(public.income_as_employee_json(p.id) order by p.created_at desc, p.id desc) from page_rows p), '[]'::jsonb),
      'metrics', jsonb_build_object(
        'count', totals.active_count,
        'employeeCommissionTotal', totals.commission_total
      ),
      'pagination', jsonb_build_object(
        'page', safe_page,
        'pageSize', safe_page_size,
        'total', totals.total_count,
        'totalPages', case when totals.total_count = 0 then 0 else ceiling(totals.total_count::numeric / safe_page_size)::integer end
      )
    )
  end
  into result
  from totals cross join payment_totals;

  return result;
end;
$$;

revoke execute on function public.list_incomes(
  uuid, boolean, uuid, date, date, uuid, text, text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.list_incomes(
  uuid, boolean, uuid, date, date, uuid, text, text, text, integer, integer
) to service_role;

notify pgrst, 'reload schema';

commit;
