-- Bastardos Barberia: cast JSON product prices before integer snapshot inserts.
-- Run after 032_create_income_product_payment_total_repair.sql.

begin;

do $repair$
declare
  target_function oid;
  function_definition text;
  repaired_definition text;
begin
  target_function := pg_catalog.to_regprocedure(
    'public.create_income(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb)'
  )::oid;

  if target_function is null then
    raise exception using
      errcode = 'P0001',
      message = 'CREATE_INCOME_PRODUCT_PRICE_TYPE_REPAIR_TARGET_MISSING';
  end if;

  select pg_catalog.pg_get_functiondef(target_function)
  into function_definition;

  if function_definition ~* '\(row[[:space:]]*->>[[:space:]]*''price''\)[[:space:]]*::[[:space:]]*integer[[:space:]]*,[[:space:]]*\(row[[:space:]]*->>[[:space:]]*''price''\)[[:space:]]*::[[:space:]]*integer'
  then
    return;
  end if;

  if function_definition !~* 'row[[:space:]]*->>[[:space:]]*''price''[[:space:]]*,[[:space:]]*row[[:space:]]*->>[[:space:]]*''price''[[:space:]]*,[[:space:]]*line_charged'
  then
    raise exception using
      errcode = 'P0001',
      message = 'CREATE_INCOME_PRODUCT_PRICE_TYPE_REPAIR_TARGET_UNEXPECTED';
  end if;

  repaired_definition := pg_catalog.regexp_replace(
    function_definition,
    'row[[:space:]]*->>[[:space:]]*''price''[[:space:]]*,[[:space:]]*row[[:space:]]*->>[[:space:]]*''price''[[:space:]]*,[[:space:]]*line_charged',
    '(row->>''price'')::integer, (row->>''price'')::integer, line_charged',
    'i'
  );

  if repaired_definition = function_definition
    or repaired_definition !~* '\(row[[:space:]]*->>[[:space:]]*''price''\)[[:space:]]*::[[:space:]]*integer[[:space:]]*,[[:space:]]*\(row[[:space:]]*->>[[:space:]]*''price''\)[[:space:]]*::[[:space:]]*integer'
  then
    raise exception using
      errcode = 'P0001',
      message = 'CREATE_INCOME_PRODUCT_PRICE_TYPE_REPAIR_FAILED';
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
