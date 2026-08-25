-- Bastardos Barberia: include charged products before payment validation.
-- Run after 031_income_item_charged_subtotal_repair.sql.

begin;

do $repair$
declare
  target_function oid;
  function_definition text;
  repaired_definition text;
  charged_product_total_sql text := $sql$
  -- Payment validation needs the authoritative charged product total before
  -- the per-line commission snapshots are built below.
  select coalesce(sum(
    coalesce((override_entry.value->>'chargedUnitPrice')::integer, p.price)
      * requested.quantity
  ), 0)::integer
  into product_charged
  from public.products p
  join (
    select
      (item->>'productId')::uuid as product_id,
      (item->>'quantity')::integer as quantity
    from jsonb_array_elements(normalized_products) item
  ) requested on requested.product_id = p.id
  left join jsonb_each(product_price_overrides) as override_entry
    on (override_entry.key)::uuid = p.id;

$sql$;
begin
  target_function := pg_catalog.to_regprocedure(
    'public.create_income(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb)'
  )::oid;

  if target_function is null then
    raise exception using
      errcode = 'P0001',
      message = 'CREATE_INCOME_PRODUCT_TOTAL_REPAIR_TARGET_MISSING';
  end if;

  select pg_catalog.pg_get_functiondef(target_function)
  into function_definition;

  if function_definition ~* 'into[[:space:]]+product_charged[[:space:]]+from[[:space:]]+public[.]products'
  then
    return;
  end if;

  if function_definition !~* 'gross_sale_total[[:space:]]*:=[[:space:]]*service_base[[:space:]]*[+][[:space:]]*product_base[[:space:]]*;'
  then
    raise exception using
      errcode = 'P0001',
      message = 'CREATE_INCOME_PRODUCT_TOTAL_REPAIR_TARGET_UNEXPECTED';
  end if;

  repaired_definition := pg_catalog.regexp_replace(
    function_definition,
    'gross_sale_total[[:space:]]*:=[[:space:]]*service_base[[:space:]]*[+][[:space:]]*product_base[[:space:]]*;',
    charged_product_total_sql || '  gross_sale_total := service_base + product_base;',
    'i'
  );

  if repaired_definition = function_definition
    or repaired_definition !~* 'into[[:space:]]+product_charged[[:space:]]+from[[:space:]]+public[.]products'
  then
    raise exception using
      errcode = 'P0001',
      message = 'CREATE_INCOME_PRODUCT_TOTAL_REPAIR_FAILED';
  end if;

  execute repaired_definition;
end;
$repair$;

revoke execute on function public.create_income(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_income(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean, jsonb, jsonb
) to service_role;

notify pgrst, 'reload schema';

commit;
