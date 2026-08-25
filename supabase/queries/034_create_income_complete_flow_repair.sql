-- Bastardos Barberia: complete canonical create_income flow repair.
-- Run after 033_create_income_product_price_type_repair.sql.

begin;

-- Charged totals may differ from catalog totals, and manager-authorized free
-- lines/sales are part of the canonical 020 contract.
alter table public.incomes
  drop constraint if exists incomes_total_check,
  drop constraint if exists incomes_commission_bases_check;

alter table public.incomes
  add constraint incomes_total_check check (total >= 0),
  add constraint incomes_commission_bases_check check (
    service_commission_base >= 0
    and product_commission_base >= 0
    and service_commission_base + product_commission_base = gross_total
  );

alter table public.income_items
  drop constraint if exists income_items_price_check;

alter table public.income_items
  add constraint income_items_price_check check (unit_price >= 0);

do $repair$
declare
  target_function oid;
  function_definition text;
  repaired_definition text;
  method_validation_sql text := $sql$

  -- Lock every selected active method through commit and reject partial
  -- catalogs before any income/payment rows can be persisted. Idempotent
  -- retries return above without depending on mutable method lifecycle state.
  perform 1
  from public.payment_methods pm
  join (
    select distinct (item->>'paymentMethodId')::uuid as payment_method_id
    from jsonb_array_elements(payment_items) item
  ) requested on requested.payment_method_id = pm.id
  where pm.is_active
  order by pm.id
  for share of pm;

  select count(*)::integer
  into found_payment_count
  from public.payment_methods pm
  join (
    select distinct (item->>'paymentMethodId')::uuid as payment_method_id
    from jsonb_array_elements(payment_items) item
  ) requested on requested.payment_method_id = pm.id
  where pm.is_active;

  if found_payment_count <> requested_payment_count then
    raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_NOT_AVAILABLE';
  end if;
$sql$;
  positive_basis_allocation_sql text := $sql$
        for iteration_index in 0 .. (jsonb_array_length(payment_items) - 2) loop
          iteration_payment := payment_items->iteration_index;
          iteration_amount :=
            (sale_total::bigint * (iteration_payment->>'basisPoints')::integer) / 10000;
          if iteration_amount <= 0 then
            raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
          end if;
          payment_total := payment_total + iteration_amount;
          allocated := allocated + iteration_amount;
        end loop;
        iteration_amount := sale_total::bigint - allocated;
        if iteration_amount <= 0 then
          raise exception using errcode = 'P0001', message = 'PAYMENT_ALLOCATION_MISMATCH';
        end if;
        payment_total := payment_total + iteration_amount;
$sql$;
begin
  target_function := pg_catalog.to_regprocedure(
    'public.create_income(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb)'
  )::oid;

  if target_function is null then
    raise exception using errcode = 'P0001', message = 'CREATE_INCOME_COMPLETE_REPAIR_TARGET_MISSING';
  end if;

  select pg_catalog.pg_get_functiondef(target_function) into function_definition;
  repaired_definition := function_definition;

  if repaired_definition !~* 'found_payment_count[[:space:]]+integer' then
    repaired_definition := pg_catalog.replace(
      repaired_definition,
      'requested_payment_count integer;',
      'requested_payment_count integer;' || pg_catalog.chr(10) ||
        '  found_payment_count integer := 0;'
    );
  end if;

  -- Empty manager payments are valid only when the authoritative charged total
  -- is zero; the later total-aware validation already enforces both branches.
  repaired_definition := pg_catalog.regexp_replace(
    repaired_definition,
    '(else[[:space:]]+)if jsonb_array_length\(payment_items\) = 0 then[[:space:]]+raise exception using errcode = ''P0001'', message = ''PAYMENT_ALLOCATION_MISMATCH'';[[:space:]]+end if;[[:space:]]+(if jsonb_array_length\(payment_methods\))',
    '\1\2',
    'i'
  );

  if repaired_definition !~* 'PAYMENT_METHOD_NOT_AVAILABLE' then
    repaired_definition := pg_catalog.replace(
      repaired_definition,
      '    return existing_income.id;' || pg_catalog.chr(10) || '  end if;',
      '    return existing_income.id;' || pg_catalog.chr(10) || '  end if;' || method_validation_sql
    );
  end if;

  if repaired_definition !~* 'iteration_amount[[:space:]]+bigint;' then
    repaired_definition := pg_catalog.replace(
      repaired_definition,
      '        iteration_payment jsonb;',
      '        iteration_payment jsonb;' || pg_catalog.chr(10) || '        iteration_amount bigint;'
    );
  end if;

  repaired_definition := pg_catalog.regexp_replace(
    repaired_definition,
    'for iteration_index in 0 \.\. \(jsonb_array_length\(payment_items\) - 2\) loop[[:space:]]+iteration_payment := payment_items->iteration_index;[[:space:]]+payment_total := payment_total[[:space:]]*\+[[:space:]]*\(\(sale_total::bigint \* \(iteration_payment->>''basisPoints''\)::integer\) / 10000\);[[:space:]]+allocated := allocated[[:space:]]*\+[[:space:]]*\(\(sale_total::bigint \* \(iteration_payment->>''basisPoints''\)::integer\) / 10000\);[[:space:]]+end loop;[[:space:]]+payment_total := payment_total \+ \(sale_total::bigint - allocated\);',
    positive_basis_allocation_sql,
    'i'
  );

  repaired_definition := pg_catalog.replace(
    repaired_definition,
    '''overrideBy'', actor_user_id',
    '''overrideBy'', case when override_entry.value is null then null else actor_user_id end'
  );

  if repaired_definition = function_definition
    or repaired_definition !~* 'found_payment_count[[:space:]]+integer'
    or repaired_definition !~* 'PAYMENT_METHOD_NOT_AVAILABLE'
    or repaired_definition !~* 'iteration_amount[[:space:]]+bigint'
    or repaired_definition !~* '''overrideBy''[[:space:]]*,[[:space:]]*case[[:space:]]+when override_entry.value is null'
  then
    raise exception using errcode = 'P0001', message = 'CREATE_INCOME_COMPLETE_REPAIR_FAILED';
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
