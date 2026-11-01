begin;

-- Extend the installed canonical reader inside its existing statement, so the
-- composition and headline metrics share authorization, filters and snapshot.
-- No writer, financial snapshot, function signature or employee projection changes.
do $migration$
declare
  target_function oid := pg_catalog.to_regprocedure(
    'public.list_incomes(uuid,boolean,uuid,date,date,uuid,text,text,text,integer,integer)'
  )::oid;
  definition text;
  repaired text;
  composition_cte constant text := $cte$), income_composition as (
    select jsonb_object_agg(bucket, jsonb_build_object(
      'grossTotal', gross_total,
      'commissionTotal', commission_total,
      'barbershopNet', barbershop_net
    )) as value
    from (
      select groups.bucket,
        coalesce(sum(f.total), 0)::bigint as gross_total,
        coalesce(sum(f.commission_total), 0)::bigint as commission_total,
        coalesce(sum(f.barbershop_net), 0)::bigint as barbershop_net
      from (values
        ('sales', 'sale'),
        ('subscriptions', 'fixed_subscription'),
        ('chairRentals', 'chair_rental')
      ) as groups(bucket, source_type)
      left join filtered f on f.source_type = groups.source_type
        and f.status = 'active' and effective_can_view_all
      group by groups.bucket
    ) amounts
  ), payment_totals as ($cte$;
begin
  if target_function is null then
    raise exception using errcode = 'P0001', message = 'LIST_INCOMES_COMPOSITION_TARGET_MISSING';
  end if;
  select pg_catalog.pg_get_functiondef(target_function) into definition;

  if definition like '%income_composition as (%' then
    if definition not like '%''composition'', (select value from income_composition)%'
      or definition not like '%''chairRentals'', ''chair_rental''%'
      or definition not like '%filter_kind = ''subscription''%'
    then
      raise exception using errcode = 'P0001', message = 'LIST_INCOMES_COMPOSITION_PARTIAL';
    end if;
    return;
  end if;

  -- Refuse an unknown/older body rather than silently changing its semantics.
  if definition not like '%with filtered as materialized (%'
    or definition not like '%), payment_totals as (%'
    or definition not like '%''paymentTotals'', payment_totals.totals_json%'
    or definition not like '%totals.sale_count%'
    or definition not like '%source_type <> ''chair_rental''%'
    or definition not like '%sum(total)%'
    or definition not like '%case when effective_can_view_all then%'
    or definition not like '%filter_kind not in (''service'', ''products'', ''combined'', ''chair_rental'')%'
  then
    raise exception using errcode = 'P0001', message = 'LIST_INCOMES_COMPOSITION_TARGET_UNEXPECTED';
  end if;

  repaired := replace(definition, '), payment_totals as (', composition_cte);
  repaired := replace(repaired,
    '''paymentTotals'', payment_totals.totals_json',
    '''composition'', (select value from income_composition), ''paymentTotals'', payment_totals.totals_json'
  );
  -- The existing browser contract already names subscription, but the installed
  -- reader never accepted it. Enable that explicit read filter with this release.
  repaired := replace(repaired,
    'filter_kind not in (''service'', ''products'', ''combined'', ''chair_rental'')',
    'filter_kind not in (''service'', ''products'', ''combined'', ''chair_rental'', ''subscription'')'
  );
  repaired := replace(repaired,
    'or (filter_kind = ''chair_rental''',
    'or (filter_kind = ''subscription'' and i.source_type = ''fixed_subscription'') or (filter_kind = ''chair_rental'''
  );
  execute repaired;
end;
$migration$;

comment on function public.list_incomes(uuid,boolean,uuid,date,date,uuid,text,text,text,integer,integer)
  is 'bastardos.046.list_incomes.v1';

-- Monthly payments have no service/product income_items. Preserve their
-- immutable concept explicitly instead of presenting them as zero products.
create or replace function public.income_as_json(target_income_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $projection$
  select case
    when i.source_type = 'chair_rental' then
      public.income_as_json_045_base(target_income_id) || jsonb_build_object(
        'sourceType', i.source_type,
        'chairRentalPeriod', i.chair_rental_period,
        'paidAt', i.chair_rental_paid_at
      )
    when i.source_type = 'fixed_subscription' then
      public.income_as_json_045_base(target_income_id) || jsonb_build_object(
        'sourceType', i.source_type,
        'subscription', jsonb_build_object(
          'sourceType', i.source_type,
          'period', i.fixed_period,
          'label', i.fixed_period,
          'monthlyPrice', i.total,
          'employeeEarning', i.commission_total,
          'barbershopNet', i.barbershop_net
        )
      )
    else public.income_as_json_045_base(target_income_id)
  end
  from public.incomes i where i.id = target_income_id;
$projection$;

commit;
