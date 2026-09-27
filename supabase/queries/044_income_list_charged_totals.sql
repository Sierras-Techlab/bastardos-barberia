begin;

do $$
declare
  target_function oid;
  function_definition text;
  repaired_definition text;
  catalog_total_pattern constant text :=
    'sum[[:space:]]*[(][[:space:]]*gross_total[[:space:]]*[)]';
  charged_total_pattern constant text :=
    'sum[[:space:]]*[(][[:space:]]*total[[:space:]]*[)]';
begin
  target_function := pg_catalog.to_regprocedure(
    'public.list_incomes(uuid,boolean,uuid,date,date,uuid,text,text,text,integer,integer)'
  )::oid;

  if target_function is null then
    raise exception using
      errcode = 'P0001',
      message = 'LIST_INCOMES_CHARGED_TOTAL_TARGET_MISSING';
  end if;

  select pg_catalog.pg_get_functiondef(target_function)
  into function_definition;

  if function_definition ~* charged_total_pattern then
    return;
  end if;

  if function_definition !~* catalog_total_pattern then
    raise exception using
      errcode = 'P0001',
      message = 'LIST_INCOMES_CHARGED_TOTAL_TARGET_UNEXPECTED';
  end if;

  repaired_definition := pg_catalog.regexp_replace(
    function_definition,
    catalog_total_pattern,
    'sum(total)',
    'i'
  );

  if repaired_definition = function_definition
    or repaired_definition !~* charged_total_pattern
  then
    raise exception using
      errcode = 'P0001',
      message = 'LIST_INCOMES_CHARGED_TOTAL_REPAIR_FAILED';
  end if;

  execute repaired_definition;
end;
$$;

commit;
