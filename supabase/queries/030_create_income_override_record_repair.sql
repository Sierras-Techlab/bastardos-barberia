-- Bastardos Barberia: repair the canonical create_income function on databases
-- that already installed migration 020 with a PL/pgSQL record/alias collision.
-- Run after 029_user_commission_profile_rpc.sql.

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
      message = 'CREATE_INCOME_REPAIR_TARGET_MISSING';
  end if;

  select pg_catalog.pg_get_functiondef(target_function)
  into function_definition;

  -- Clean installations already contain the corrected variable name, so the
  -- incremental repair remains safe when every query is executed in order.
  if function_definition ~* '[[:space:]]charged_product_record[[:space:]]+record[[:space:]]*;'
    and function_definition ~* 'for[[:space:]]+charged_product_record[[:space:]]+in'
  then
    return;
  end if;

  if function_definition !~* '[[:space:]]override_record[[:space:]]+record[[:space:]]*;'
    or function_definition !~* 'for[[:space:]]+override_record[[:space:]]+in'
  then
    raise exception using
      errcode = 'P0001',
      message = 'CREATE_INCOME_REPAIR_TARGET_UNEXPECTED';
  end if;

  repaired_definition := pg_catalog.regexp_replace(
    function_definition,
    '([[:space:]])override_record[[:space:]]+record[[:space:]]*;',
    '\1charged_product_record record;',
    'i'
  );
  repaired_definition := pg_catalog.regexp_replace(
    repaired_definition,
    'for[[:space:]]+override_record[[:space:]]+in',
    'for charged_product_record in',
    'i'
  );
  repaired_definition := pg_catalog.replace(
    repaired_definition,
    'override_record.charged_subtotal',
    'charged_product_record.charged_subtotal'
  );
  repaired_definition := pg_catalog.replace(
    repaired_definition,
    'override_record.commission_rate',
    'charged_product_record.commission_rate'
  );

  if repaired_definition = function_definition
    or repaired_definition ~* '[[:space:]]override_record[[:space:]]+record[[:space:]]*;'
    or repaired_definition !~* 'for[[:space:]]+charged_product_record[[:space:]]+in'
  then
    raise exception using
      errcode = 'P0001',
      message = 'CREATE_INCOME_REPAIR_FAILED';
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
