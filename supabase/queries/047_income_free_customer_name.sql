begin;

-- Keep free-form sale names on the income row; never resolve them by name.
alter table public.incomes add column if not exists customer_name text;
alter table public.incomes drop constraint if exists incomes_customer_identity_check;
alter table public.incomes add constraint incomes_customer_identity_check check (
  not (customer_id is not null and customer_name is not null)
  and (customer_name is null or (customer_name = pg_catalog.btrim(customer_name, E' \t\n\r')
    and pg_catalog.length(customer_name) between 1 and 80))
);

-- This wrapper serializes a request id before delegating to the canonical
-- atomic writer. The existing RPC remains the authority for sale fingerprint,
-- pricing, payments, sessions, inventory, visits and actor authorization.
create or replace function public.create_income_with_customer_name(
  actor_user_id uuid,
  responsible_employee_id uuid,
  income_request_id uuid,
  selected_customer_id uuid,
  selected_service_id uuid,
  product_items jsonb,
  payment_items jsonb,
  grant_full_service_commission boolean,
  service_price_override jsonb,
  product_price_overrides jsonb,
  selected_customer_name text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  normalized_name text := nullif(pg_catalog.btrim(selected_customer_name, E' \t\n\r'), '');
  prior_name text;
  has_prior boolean := false;
  result_id uuid;
begin
  if normalized_name is not null and pg_catalog.length(normalized_name) > 80 then
    raise exception using errcode='22023', message='INVALID_CUSTOMER_NAME';
  end if;
  if normalized_name is not null and selected_customer_id is not null then
    raise exception using errcode='22023', message='CUSTOMER_IDENTITY_CONFLICT';
  end if;
  if income_request_id is null then
    raise exception using errcode='22023', message='INVALID_REQUEST_ID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('income-free-customer:' || actor_user_id::text || ':' || income_request_id::text, 0)
  );
  select i.customer_name into prior_name
  from public.incomes i
  where i.request_id=income_request_id and i.registered_by=actor_user_id;
  has_prior := found;
  if has_prior and prior_name is distinct from normalized_name then
    raise exception using errcode='P0001', message='INCOME_REQUEST_CONFLICT';
  end if;

  result_id := public.create_income(
    actor_user_id, responsible_employee_id, income_request_id, selected_customer_id,
    selected_service_id, product_items, payment_items, grant_full_service_commission,
    service_price_override, product_price_overrides
  );
  if not has_prior and normalized_name is not null then
    update public.incomes set customer_name=normalized_name where id=result_id;
  end if;
  return result_id;
end;
$$;

revoke execute on function public.create_income_with_customer_name(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.create_income_with_customer_name(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb,text)
  to service_role;

-- Preserve the installed manager projection (including 046 additions), and
-- expose only the non-financial customer label in the employee projection.
do $$ begin
  if pg_catalog.to_regprocedure('public.income_as_json_047_base(uuid)') is null then
    alter function public.income_as_json(uuid) rename to income_as_json_047_base;
  end if;
  if pg_catalog.to_regprocedure('public.income_as_employee_json_047_base(uuid)') is null then
    alter function public.income_as_employee_json(uuid) rename to income_as_employee_json_047_base;
  end if;
end $$;

create or replace function public.income_as_json(target_income_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.income_as_json_047_base(target_income_id)
    || jsonb_build_object('customerName', i.customer_name)
  from public.incomes i where i.id=target_income_id;
$$;

create or replace function public.income_as_employee_json(target_income_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.income_as_employee_json_047_base(target_income_id)
    || jsonb_build_object('customerName', i.customer_name)
  from public.incomes i where i.id=target_income_id;
$$;

-- Search happens in the canonical filtered CTE, before totals and pagination.
do $$
declare target_function oid; definition text; repaired text;
begin
  target_function := pg_catalog.to_regprocedure(
    'public.list_incomes(uuid,boolean,uuid,date,date,uuid,text,text,text,integer,integer)'
  )::oid;
  if target_function is null then raise exception using errcode='P0001', message='LIST_INCOMES_FREE_NAME_TARGET_MISSING'; end if;
  select pg_catalog.pg_get_functiondef(target_function) into definition;
  if definition like '%i.customer_name%' then
    if definition not like '%customer_name%' then raise exception using errcode='P0001', message='LIST_INCOMES_FREE_NAME_PARTIAL'; end if;
    return;
  end if;
  if definition not like '%normalized_query = ''''%' or definition not like '%public.income_items x%' then
    raise exception using errcode='P0001', message='LIST_INCOMES_FREE_NAME_TARGET_UNEXPECTED';
  end if;
  repaired := pg_catalog.replace(definition,
    'or public.normalize_catalog_name(coalesce(c.first_name || '' '' || c.last_name, '''')) like ''%'' || normalized_query || ''%''',
    'or public.normalize_catalog_name(coalesce(c.first_name || '' '' || c.last_name, '''')) like ''%'' || normalized_query || ''%''' || pg_catalog.chr(10) || '        or public.normalize_catalog_name(coalesce(i.customer_name, '''')) like ''%'' || normalized_query || ''%'''
  );
  if repaired=definition or repaired not like '%i.customer_name%' then
    raise exception using errcode='P0001', message='LIST_INCOMES_FREE_NAME_REPAIR_FAILED';
  end if;
  execute repaired;
end $$;

revoke execute on function public.income_as_json(uuid), public.income_as_employee_json(uuid) from public, anon, authenticated;
grant execute on function public.income_as_json(uuid), public.income_as_employee_json(uuid) to service_role;
comment on function public.create_income_with_customer_name(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb,text)
  is 'bastardos.047.create_income_with_customer_name.v1';

notify pgrst, 'reload schema';
commit;
