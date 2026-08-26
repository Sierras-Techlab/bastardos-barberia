-- Manager-only visual business reporting over immutable financial snapshots.
-- Run once after 038_cash_close_charged_snapshot_repair.sql.

begin;

drop function if exists public.get_business_report(uuid, text);

create or replace function public.get_business_report(
  actor_user_id uuid,
  target_month text
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today_ba date := (pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
  current_month date;
  selected_start date;
  selected_month_end date;
  selected_end date;
  selected_elapsed_days integer;
  selected_days_in_month integer;
  comparison_start date;
  comparison_month_end date;
  comparison_end date;
  is_current boolean;
  result jsonb;
begin
  perform public.assert_expense_manager(actor_user_id);

  if target_month is null or target_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception using errcode = '22023', message = 'REPORT_MONTH_INVALID';
  end if;

  selected_start := pg_catalog.to_date(target_month || '-01', 'YYYY-MM-DD');
  if pg_catalog.to_char(selected_start, 'YYYY-MM') <> target_month then
    raise exception using errcode = '22023', message = 'REPORT_MONTH_INVALID';
  end if;

  current_month := pg_catalog.date_trunc('month', today_ba)::date;
  if selected_start > current_month then
    raise exception using errcode = '22023', message = 'REPORT_MONTH_FUTURE';
  end if;

  selected_month_end := (selected_start + interval '1 month - 1 day')::date;
  is_current := selected_start = current_month;
  selected_end := case when is_current then today_ba else selected_month_end end;
  selected_elapsed_days := selected_end - selected_start + 1;
  selected_days_in_month := selected_month_end - selected_start + 1;
  comparison_start := (selected_start - interval '1 month')::date;
  comparison_month_end := (selected_start - interval '1 day')::date;
  comparison_end := least(
    comparison_month_end,
    comparison_start + (selected_elapsed_days - 1)
  );

  with
  selected_incomes as (
    select i.*
    from public.incomes i
    where i.status = 'active'
      and i.business_date between selected_start and selected_end
  ),
  comparison_incomes as (
    select i.*
    from public.incomes i
    where i.status = 'active'
      and i.business_date between comparison_start and comparison_end
  ),
  selected_expenses as (
    select e.*
    from public.expenses e
    where e.status = 'active'
      and e.accounting_date between selected_start and selected_end
  ),
  comparison_expenses as (
    select e.*
    from public.expenses e
    where e.status = 'active'
      and e.accounting_date between comparison_start and comparison_end
  ),
  selected_income_summary as (
    select
      coalesce(sum(i.total), 0)::bigint as gross,
      coalesce(sum(i.commission_total), 0)::bigint as commission,
      coalesce(sum(i.barbershop_net), 0)::bigint as net
    from selected_incomes i
  ),
  comparison_income_summary as (
    select
      coalesce(sum(i.total), 0)::bigint as gross,
      coalesce(sum(i.commission_total), 0)::bigint as commission,
      coalesce(sum(i.barbershop_net), 0)::bigint as net
    from comparison_incomes i
  ),
  selected_expense_summary as (
    select coalesce(sum(e.amount), 0)::bigint as expenses from selected_expenses e
  ),
  comparison_expense_summary as (
    select coalesce(sum(e.amount), 0)::bigint as expenses from comparison_expenses e
  ),
  selected_summary as (
    select
      i.gross,
      i.commission,
      i.net,
      e.expenses,
      (i.net - e.expenses)::bigint as operating_result,
      case when i.gross = 0 then null
        else pg_catalog.round((i.net - e.expenses)::numeric * 10000 / i.gross)::bigint end as margin_bps
    from selected_income_summary i cross join selected_expense_summary e
  ),
  previous_summary as (
    select
      i.gross,
      i.commission,
      i.net,
      e.expenses,
      (i.net - e.expenses)::bigint as operating_result,
      case when i.gross = 0 then null
        else pg_catalog.round((i.net - e.expenses)::numeric * 10000 / i.gross)::bigint end as margin_bps
    from comparison_income_summary i cross join comparison_expense_summary e
  ),
  calendar_days as (
    select
      day_number,
      selected_start + (day_number - 1) as selected_date,
      comparison_start + (day_number - 1) as comparison_date
    from pg_catalog.generate_series(1, selected_elapsed_days) as day_number
  ),
  daily_values as (
    select
      d.day_number as day,
      coalesce((select sum(i.total) from selected_incomes i where i.business_date = d.selected_date), 0)::bigint as selected_gross,
      coalesce((select sum(e.amount) from selected_expenses e where e.accounting_date = d.selected_date), 0)::bigint as selected_expenses,
      coalesce((select sum(i.barbershop_net) from selected_incomes i where i.business_date = d.selected_date), 0)::bigint
        - coalesce((select sum(e.amount) from selected_expenses e where e.accounting_date = d.selected_date), 0)::bigint as selected_result,
      case when d.comparison_date <= comparison_end
        then coalesce((select sum(i.total) from comparison_incomes i where i.business_date = d.comparison_date), 0)::bigint end as previous_gross,
      case when d.comparison_date <= comparison_end
        then coalesce((select sum(e.amount) from comparison_expenses e where e.accounting_date = d.comparison_date), 0)::bigint end as previous_expenses,
      case when d.comparison_date <= comparison_end
        then coalesce((select sum(i.barbershop_net) from comparison_incomes i where i.business_date = d.comparison_date), 0)::bigint
          - coalesce((select sum(e.amount) from comparison_expenses e where e.accounting_date = d.comparison_date), 0)::bigint end as previous_result,
      d.selected_date
    from calendar_days d
  ),
  income_composition as (
    select 'services'::text as key,
      coalesce(sum(ii.charged_subtotal) filter (where ii.item_type = 'service'), 0)::bigint as amount
    from public.income_items ii join selected_incomes i on i.id = ii.income_id
    where i.source_type = 'sale' and ii.item_type in ('service', 'product')
    union all
    select 'products', coalesce(sum(ii.charged_subtotal) filter (where ii.item_type = 'product'), 0)::bigint
    from public.income_items ii join selected_incomes i on i.id = ii.income_id
    where i.source_type = 'sale' and ii.item_type in ('service', 'product')
    union all
    select 'subscriptions', coalesce(sum(i.total), 0)::bigint
    from selected_incomes i where i.source_type = 'fixed_subscription'
  ),
  payment_composition as (
    select
      ip.payment_method_id::text || ':' || pg_catalog.encode(extensions.digest(ip.method_name_snapshot, 'sha256'), 'hex') as id,
      ip.method_name_snapshot as name,
      sum(ip.amount)::bigint as amount
    from public.income_payments ip join selected_incomes i on i.id = ip.income_id
    group by ip.payment_method_id, ip.method_name_snapshot
  ),
  expense_composition as (
    select kind.key,
      coalesce(sum(e.amount) filter (where e.category_type_snapshot = kind.key), 0)::bigint as amount
    from (values ('fixed'), ('variable'), ('supplies')) as kind(key)
    left join selected_expenses e on true
    group by kind.key
  ),
  service_ranking as (
    select
      ii.service_id::text || ':' || pg_catalog.encode(extensions.digest(ii.name_snapshot, 'sha256'), 'hex') as id,
      ii.name_snapshot as name,
      sum(ii.charged_subtotal)::bigint as amount,
      sum(ii.quantity)::bigint as quantity
    from public.income_items ii join selected_incomes i on i.id = ii.income_id
    where i.source_type = 'sale' and ii.item_type = 'service'
    group by ii.service_id, ii.name_snapshot
  ),
  product_ranking as (
    select
      ii.product_id::text || ':' || pg_catalog.encode(extensions.digest(ii.name_snapshot, 'sha256'), 'hex') as id,
      ii.name_snapshot as name,
      sum(ii.charged_subtotal)::bigint as amount,
      sum(ii.quantity)::bigint as quantity
    from public.income_items ii join selected_incomes i on i.id = ii.income_id
    where i.source_type = 'sale' and ii.item_type = 'product'
    group by ii.product_id, ii.name_snapshot
  ),
  activity as (
    select exists(select 1 from selected_incomes) or exists(select 1 from selected_expenses) as any_activity
  )
  select pg_catalog.jsonb_build_object(
    'month', target_month,
    'generatedAt', pg_catalog.clock_timestamp(),
    'period', pg_catalog.jsonb_build_object(
      'from', selected_start, 'to', selected_end, 'elapsedDays', selected_elapsed_days,
      'daysInMonth', selected_days_in_month, 'isCurrentMonth', is_current
    ),
    'comparison', pg_catalog.jsonb_build_object(
      'month', pg_catalog.to_char(comparison_start, 'YYYY-MM'),
      'from', comparison_start, 'to', comparison_end
    ),
    'summary', pg_catalog.jsonb_build_object(
      'grossIncome', s.gross, 'commission', s.commission, 'barbershopNet', s.net,
      'expenses', s.expenses, 'operatingResult', s.operating_result, 'operatingMarginBps', s.margin_bps
    ),
    'previousSummary', pg_catalog.jsonb_build_object(
      'grossIncome', p.gross, 'commission', p.commission, 'barbershopNet', p.net,
      'expenses', p.expenses, 'operatingResult', p.operating_result, 'operatingMarginBps', p.margin_bps
    ),
    'projection', case when is_current then pg_catalog.jsonb_build_object(
      'grossIncome', pg_catalog.round(s.gross::numeric / selected_elapsed_days * selected_days_in_month)::bigint,
      'commission', pg_catalog.round(s.commission::numeric / selected_elapsed_days * selected_days_in_month)::bigint,
      'barbershopNet', pg_catalog.round(s.net::numeric / selected_elapsed_days * selected_days_in_month)::bigint,
      'expenses', pg_catalog.round(s.expenses::numeric / selected_elapsed_days * selected_days_in_month)::bigint,
      'operatingResult', pg_catalog.round(s.operating_result::numeric / selected_elapsed_days * selected_days_in_month)::bigint,
      'operatingMarginBps', s.margin_bps
    ) else null end,
    'daily', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'day', d.day,
      'selected', pg_catalog.jsonb_build_object('grossIncome', d.selected_gross, 'expenses', d.selected_expenses, 'operatingResult', d.selected_result),
      'previous', case when d.previous_gross is null then null else pg_catalog.jsonb_build_object('grossIncome', d.previous_gross, 'expenses', d.previous_expenses, 'operatingResult', d.previous_result) end
    ) order by d.day), '[]'::jsonb) from daily_values d),
    'incomeComposition', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', c.key, 'amount', c.amount) order by case c.key when 'services' then 1 when 'products' then 2 else 3 end) from income_composition c),
    'paymentComposition', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', x.id, 'name', x.name, 'amount', x.amount) order by x.amount desc, x.name asc, x.id asc), '[]'::jsonb) from payment_composition x),
    'expenseComposition', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', c.key, 'amount', c.amount) order by case c.key when 'fixed' then 1 when 'variable' then 2 else 3 end) from expense_composition c),
    'serviceRanking', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', x.id, 'name', x.name, 'amount', x.amount, 'quantity', x.quantity) order by x.amount desc, x.name asc, x.id asc), '[]'::jsonb) from service_ranking x),
    'productRanking', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', x.id, 'name', x.name, 'amount', x.amount, 'quantity', x.quantity) order by x.amount desc, x.name asc, x.id asc), '[]'::jsonb) from product_ranking x),
    'highlights', pg_catalog.jsonb_build_object(
      'bestDay', case when a.any_activity then (select pg_catalog.jsonb_build_object('date', d.selected_date, 'amount', d.selected_result) from daily_values d order by d.selected_result desc, d.selected_date asc limit 1) else null end,
      'worstDay', case when a.any_activity then (select pg_catalog.jsonb_build_object('date', d.selected_date, 'amount', d.selected_result) from daily_values d order by d.selected_result asc, d.selected_date asc limit 1) else null end
    )
  ) into result
  from selected_summary s cross join previous_summary p cross join activity a;

  return result;
end;
$$;

revoke all on function public.get_business_report(uuid, text) from public, anon, authenticated;
grant execute on function public.get_business_report(uuid, text) to service_role;

select pg_catalog.pg_notify('pgrst', 'reload schema');

commit;
