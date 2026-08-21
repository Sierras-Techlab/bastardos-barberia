# Supabase SQL installation

Supabase is used only as PostgreSQL storage. Authentication is implemented by the Next.js server; do not enable or configure Supabase Auth for this feature.

In Supabase Dashboard, open **SQL Editor** and execute these files in order:

1. `001_extensions_and_roles.sql`
2. `002_users.sql`
3. `003_sessions.sql`
4. `004_functions_and_triggers.sql`
5. `005_security.sql`
6. `006_atomic_auth_guards.sql`
7. `007_user_soft_deletion.sql`
8. `008_products_inventory.sql`
9. `009_sales_domain.sql`
10. `010_income_commissions_and_split_payments.sql`
11. `011_customer_visits_and_fixed_schedules.sql`
12. `012_owner_commission_invariant.sql`
13. `013_customer_visit_financials.sql`
14. `014_product_categories.sql`
15. `015_product_item_commissions.sql`
16. `016_payment_methods.sql`
17. `017_product_category_deletion.sql`
18. `018_automatic_daily_cash.sql`
19. `019_employee_work_sessions.sql`

Run each entire file and stop if Supabase reports an error. These scripts target a new project; do not edit generated tables manually afterward.

If `016_payment_methods.sql` was installed before the product-availability projection, responsible-role snapshot, legacy payment-column or safe-deletion fixes, run the current file again in full. The script is transactional: it repairs and backfills `incomes.responsible_role_snapshot`, releases the superseded `income_payments.method` requirement, restores the current integrity constraints and replaces the canonical income/payment-method functions. This refresh is required before recording another income or using permanent payment-method deletion.

`017_product_category_deletion.sql` is an incremental migration for existing projects. Run it after the latest `016`; do not rerun the structural migration `014`. It replaces the unconditional category-delete trigger with a manager-only RPC that physically removes only categories without any product references.

`018_automatic_daily_cash.sql` installs the manager-only automatic cash module. It creates immutable daily closures only for dates with sales or post-close adjustments, preserves sale and payment-method snapshots for audit, records later voids as negative adjustments, and schedules the idempotent closer hourly with `pg_cron`. Run it after `017`; there is no manual open or close operation.

`019_employee_work_sessions.sql` installs employee clock-in/out, append-only manager corrections and server-derived income linkage. Employee-created sales require the actor's own open session. Manager-created sales for an employee link that employee's open session when present and otherwise retain an explicit outside-session audit flag. Run it after `018`; the canonical `create_income` RPC remains unchanged.

Verify the automatic cash objects and cron job:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'daily_cash_registers',
    'daily_cash_sales',
    'daily_cash_payment_totals',
    'daily_cash_adjustments',
    'daily_cash_adjustment_payments'
  )
order by tablename;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'close_pending_daily_cash',
    'get_daily_cash',
    'list_daily_cash'
  )
order by routine_name;

select jobname, schedule, command, active
from cron.job
where jobname = 'bastardos-close-daily-cash';
```

All five tables must report `rowsecurity = true`, all three public cash functions must exist, and the cron query must return one active hourly job whose command calls `public.close_pending_daily_cash()`.

Validate closure idempotency, split payments, same-day void exclusion and one
post-close adjustment without retaining the temporary records:

```sql
begin;

do $$
declare
  manager_id uuid;
  employee_id uuid;
  service_id uuid;
  cash_method_id uuid;
  transfer_method_id uuid;
  active_income_id uuid;
  same_day_void_id uuid;
  test_date date := ((clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date - 2);
  cash_id uuid;
  first_close_count integer;
begin
  insert into public.users (
    first_name, last_name, username, password_hash, role_id,
    service_commission_rate, product_commission_rate
  ) values (
    'Manager', 'Caja',
    'manager.' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 12),
    '$argon2id$verification', 1, 0, 0
  ) returning id into manager_id;

  insert into public.users (
    first_name, last_name, username, password_hash, role_id,
    service_commission_rate, product_commission_rate, created_by
  ) values (
    'Empleado', 'Caja',
    'empleado.' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 12),
    '$argon2id$verification', 3, 50, 0, manager_id
  ) returning id into employee_id;

  insert into public.services (name, normalized_name, price, created_by, updated_by)
  values (
    'Servicio caja ' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 12),
    'servicio-caja-' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 12),
    10000, manager_id, manager_id
  ) returning id into service_id;

  insert into public.payment_methods (name, normalized_name, created_by, updated_by)
  values (
    'Efectivo caja ' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 8),
    'efectivo-caja-' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 12),
    manager_id, manager_id
  ) returning id into cash_method_id;

  insert into public.payment_methods (name, normalized_name, created_by, updated_by)
  values (
    'Transferencia caja ' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 8),
    'transferencia-caja-' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 12),
    manager_id, manager_id
  ) returning id into transfer_method_id;

  active_income_id := public.create_income(
    manager_id, employee_id, extensions.gen_random_uuid(), null, service_id,
    '[]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('paymentMethodId', cash_method_id, 'amount', 6000),
      jsonb_build_object('paymentMethodId', transfer_method_id, 'amount', 4000)
    ),
    false
  );

  same_day_void_id := public.create_income(
    manager_id, employee_id, extensions.gen_random_uuid(), null, service_id,
    '[]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('paymentMethodId', cash_method_id, 'amount', 10000)
    ),
    false
  );
  perform public.void_income(same_day_void_id, manager_id);

  update public.incomes
  set business_date = test_date,
      created_at = created_at - interval '2 days'
  where id in (active_income_id, same_day_void_id);

  select public.close_pending_daily_cash() into first_close_count;
  select id into cash_id from public.daily_cash_registers where business_date = test_date;

  if first_close_count < 1 or cash_id is null then
    raise exception 'DAILY_CASH_EXPECTED_CLOSE_MISSING';
  end if;

  if not exists (
    select 1 from public.daily_cash_registers
    where id = cash_id
      and sales_gross_total = 10000
      and sales_commission_total = 5000
      and sales_barbershop_net = 5000
      and service_sales_total = 10000
      and product_sales_total = 0
      and sale_count = 2
      and active_sale_count = 1
      and voided_sale_count = 1
      and adjustment_count = 0
  ) then
    raise exception 'DAILY_CASH_TOTALS_MISMATCH';
  end if;

  if (select count(*) from public.daily_cash_sales where daily_cash_id = cash_id) <> 2
    or (select coalesce(sum(sales_amount), 0) from public.daily_cash_payment_totals where daily_cash_id = cash_id) <> 10000
  then
    raise exception 'DAILY_CASH_AUDIT_SNAPSHOT_MISMATCH';
  end if;

  if public.close_pending_daily_cash() <> 0
    or (select count(*) from public.daily_cash_registers where business_date = test_date) <> 1
  then
    raise exception 'DAILY_CASH_CLOSE_NOT_IDEMPOTENT';
  end if;

  perform public.void_income(active_income_id, manager_id);

  if not exists (
    select 1 from public.daily_cash_adjustments
    where source_income_id = active_income_id
      and original_daily_cash_id = cash_id
      and gross_delta = -10000
      and commission_delta = -5000
      and barbershop_net_delta = -5000
      and service_delta = -10000
      and product_delta = 0
  ) or (
    select count(*) from public.daily_cash_adjustments
    where source_income_id = active_income_id
  ) <> 1 then
    raise exception 'DAILY_CASH_POST_CLOSE_ADJUSTMENT_MISMATCH';
  end if;

  if (
    select coalesce(sum(ap.amount), 0)
    from public.daily_cash_adjustment_payments ap
    join public.daily_cash_adjustments a on a.id = ap.adjustment_id
    where a.source_income_id = active_income_id
  ) <> -10000 then
    raise exception 'DAILY_CASH_ADJUSTMENT_PAYMENTS_MISMATCH';
  end if;
end;
$$;

rollback;
```

The block must finish without an exception. It proves that an active split-payment sale is included, a same-day void remains visible only as excluded audit membership, repeating the closer is a no-op, and a later void creates one exact negative adjustment without changing the original closure. `rollback` removes every temporary user, catalog row, sale, closure and adjustment.

Verify the work-session objects, RLS and canonical income trigger:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'employee_work_sessions',
    'employee_work_session_corrections'
  )
order by tablename;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'start_work_session',
    'end_work_session',
    'correct_work_session',
    'get_current_work_session',
    'list_work_sessions'
  )
order by routine_name;

select trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'incomes'
  and trigger_name = 'attach_income_work_session';

with work_session_tables(table_name) as (
  values
    ('public.employee_work_sessions'::regclass),
    ('public.employee_work_session_corrections'::regclass)
), roles(role_name) as (
  values ('service_role'), ('anon'), ('authenticated')
)
select
  table_name::text as table_name,
  role_name,
  has_table_privilege(role_name, table_name, 'SELECT') as can_select,
  has_table_privilege(role_name, table_name, 'INSERT') as can_insert,
  has_table_privilege(role_name, table_name, 'UPDATE') as can_update,
  has_table_privilege(role_name, table_name, 'DELETE') as can_delete
from work_session_tables
cross join roles
order by table_name, role_name;

with work_session_functions(function_signature) as (
  values
    ('public.start_work_session(uuid)'::regprocedure),
    ('public.end_work_session(uuid)'::regprocedure),
    ('public.get_current_work_session(uuid)'::regprocedure),
    ('public.correct_work_session(uuid,uuid,timestamptz,timestamptz,text)'::regprocedure),
    ('public.list_work_sessions(uuid,uuid,date,date,integer,integer)'::regprocedure)
), roles(role_name) as (
  values ('service_role'), ('anon'), ('authenticated')
)
select
  function_signature::text as function_signature,
  role_name,
  has_function_privilege(role_name, function_signature, 'EXECUTE')
    as can_execute
from work_session_functions
cross join roles
order by function_signature, role_name;
```

Both tables must report `rowsecurity = true`, all five canonical RPCs must be
present exactly once, and the income trigger must report `BEFORE` / `INSERT`.
For both tables, `service_role` must have `can_select = true` and every DML
column false; `anon` and `authenticated` must have every table privilege false.
For each exact `regprocedure` signature, `service_role` must have
`can_execute = true`, while `anon` and `authenticated` must both have
`can_execute = false`. These effective-privilege checks also catch grants
inherited through `PUBLIC`; they intentionally make no assertion about owner or
`postgres` privileges.

Validate work-session lifecycle, income attachment, correction audit and active-only
production metrics without retaining temporary records:

```sql
begin;

do $$
declare
  suffix text := substring(
    replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 12
  );
  manager_id uuid;
  employee_id uuid;
  service_id uuid;
  payment_method_id uuid;
  first_session_id uuid;
  second_session_id uuid;
  linked_income_id uuid;
  manager_linked_income_id uuid;
  outside_income_id uuid;
  voided_income_id uuid;
  prior_started_at timestamptz;
  prior_ended_at timestamptz;
  corrected_started_at timestamptz;
  manager_history jsonb;
  first_session_json jsonb;
  second_session_json jsonb;
begin
  insert into public.users (
    first_name, last_name, username, password_hash, role_id,
    service_commission_rate, product_commission_rate
  ) values (
    'Manager', 'Jornadas', 'manager.jornadas.' || suffix,
    '$argon2id$verification', 2, 0, 0
  ) returning id into manager_id;

  insert into public.users (
    first_name, last_name, username, password_hash, role_id,
    service_commission_rate, product_commission_rate, created_by
  ) values (
    'Empleado', 'Jornadas', 'empleado.jornadas.' || suffix,
    '$argon2id$verification', 3, 50, 0, manager_id
  ) returning id into employee_id;

  insert into public.services (
    name, normalized_name, price, created_by, updated_by
  ) values (
    'Servicio jornada ' || suffix, '', 10000, manager_id, manager_id
  ) returning id into service_id;

  insert into public.payment_methods (
    name, normalized_name, created_by, updated_by
  ) values (
    'Pago jornada ' || suffix, 'pago-jornada-' || suffix,
    manager_id, manager_id
  ) returning id into payment_method_id;

  begin
    perform public.create_income(
      employee_id, employee_id, extensions.gen_random_uuid(), null, service_id,
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'paymentMethodId', payment_method_id,
        'amount', 10000
      )),
      false
    );
    raise exception 'WORK_SESSION_ACCEPTANCE_EMPLOYEE_SALE_WITHOUT_SESSION_FAILED';
  exception
    when raise_exception then
      if sqlerrm <> 'EMPLOYEE_WORK_SESSION_REQUIRED' then
        raise;
      end if;
  end;

  first_session_id := (public.start_work_session(employee_id)->>'id')::uuid;

  begin
    perform public.start_work_session(employee_id);
    raise exception 'WORK_SESSION_ACCEPTANCE_DUPLICATE_START_FAILED';
  exception
    when raise_exception then
      if sqlerrm <> 'WORK_SESSION_ALREADY_OPEN' then
        raise;
      end if;
  end;

  linked_income_id := public.create_income(
    employee_id, employee_id, extensions.gen_random_uuid(), null, service_id,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'paymentMethodId', payment_method_id,
      'amount', 10000
    )),
    false
  );

  if not exists (
    select 1 from public.incomes
    where id = linked_income_id
      and work_session_id = first_session_id
      and not outside_work_session
  ) then
    raise exception 'WORK_SESSION_ACCEPTANCE_EMPLOYEE_SALE_LINK_FAILED';
  end if;

  -- A manager does not need a session. When attributing a sale to an employee
  -- who does have one open, the trigger must attach it rather than mark it
  -- outside the employee's work session.
  manager_linked_income_id := public.create_income(
    manager_id, employee_id, extensions.gen_random_uuid(), null, service_id,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'paymentMethodId', payment_method_id,
      'amount', 10000
    )),
    false
  );

  if not exists (
    select 1 from public.incomes
    where id = manager_linked_income_id
      and work_session_id = first_session_id
      and not outside_work_session
  ) then
    raise exception 'WORK_SESSION_ACCEPTANCE_MANAGER_OPEN_SESSION_LINK_FAILED';
  end if;

  perform public.end_work_session(employee_id);

  outside_income_id := public.create_income(
    manager_id, employee_id, extensions.gen_random_uuid(), null, service_id,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'paymentMethodId', payment_method_id,
      'amount', 10000
    )),
    false
  );

  if not exists (
    select 1 from public.incomes
    where id = outside_income_id
      and work_session_id is null
      and outside_work_session
  ) then
    raise exception 'WORK_SESSION_ACCEPTANCE_MANAGER_OUTSIDE_SALE_FAILED';
  end if;

  select started_at, ended_at
  into prior_started_at, prior_ended_at
  from public.employee_work_sessions
  where id = first_session_id;

  corrected_started_at := prior_started_at + interval '1 microsecond';
  perform public.correct_work_session(
    manager_id,
    first_session_id,
    corrected_started_at,
    prior_ended_at,
    'Ajuste de aceptación'
  );

  if not exists (
    select 1
    from public.employee_work_session_corrections correction
    join public.employee_work_sessions session
      on session.id = correction.work_session_id
    where correction.work_session_id = first_session_id
      and correction.corrected_by = manager_id
      and correction.reason = 'Ajuste de aceptación'
      and correction.prior_started_at = prior_started_at
      and correction.prior_ended_at = prior_ended_at
      and correction.corrected_started_at = corrected_started_at
      and correction.corrected_ended_at = prior_ended_at
      and session.started_at = corrected_started_at
      and session.ended_at = prior_ended_at
  ) then
    raise exception 'WORK_SESSION_ACCEPTANCE_CORRECTION_AUDIT_FAILED';
  end if;

  second_session_id := (public.start_work_session(employee_id)->>'id')::uuid;
  voided_income_id := public.create_income(
    employee_id, employee_id, extensions.gen_random_uuid(), null, service_id,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'paymentMethodId', payment_method_id,
      'amount', 10000
    )),
    false
  );
  perform public.void_income(voided_income_id, manager_id);
  perform public.end_work_session(employee_id);

  if second_session_id = first_session_id
    or (select count(*) from public.employee_work_sessions session
        where session.employee_id = employee_id
          and session.business_date = (
            pg_catalog.clock_timestamp()
              at time zone 'America/Argentina/Buenos_Aires'
          )::date) <> 2
  then
    raise exception 'WORK_SESSION_ACCEPTANCE_SECOND_SESSION_FAILED';
  end if;

  manager_history := public.list_work_sessions(
    manager_id, employee_id, null, null, 1, 20
  );
  select item into first_session_json
  from jsonb_array_elements(manager_history->'items') item
  where item->>'id' = first_session_id::text;
  select item into second_session_json
  from jsonb_array_elements(manager_history->'items') item
  where item->>'id' = second_session_id::text;

  if (first_session_json->'metrics'->>'saleCount')::integer <> 2
    or (first_session_json->'metrics'->>'employeeCommission')::bigint <> 10000
    or (first_session_json->'metrics'->>'grossTotal')::bigint <> 20000
    or (first_session_json->'metrics'->>'barbershopNet')::bigint <> 10000
    or (second_session_json->'metrics'->>'saleCount')::integer <> 0
    or (second_session_json->'metrics'->>'employeeCommission')::bigint <> 0
    or (second_session_json->'metrics'->>'grossTotal')::bigint <> 0
    or (second_session_json->'metrics'->>'barbershopNet')::bigint <> 0
  then
    raise exception 'WORK_SESSION_ACCEPTANCE_VOID_METRICS_FAILED';
  end if;
end;
$$;

rollback;
```

The block must finish without an exception. It covers employee clock-in/out,
duplicate clock-in, rejection before clock-in, exact employee linkage, manager
linkage to an employee's open session, explicit manager outside-session audit,
prior/new correction snapshots, a second same-day session and active-only
production metrics. `rollback` removes every temporary identity, catalog row,
session, correction, income and void effect.

## Verify

```sql
select id, name from public.roles order by id;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('roles', 'users', 'sessions')
order by tablename;
```

The roles must be `owner`, `admin`, and `employee`; every listed table must report `rowsecurity = true`.

Verify that payment-method deactivation and safe physical deletion use the current lifecycle functions:

```sql
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('update_payment_method', 'delete_payment_method', 'deactivate_payment_method')
order by proname;
```

The result must include `update_payment_method` and `delete_payment_method`, and must not include the superseded `deactivate_payment_method` function.

Verify that safe product-category deletion is installed:

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'delete_product_category';
```

The query must return exactly one row named `delete_product_category`.

Verify the logical-deletion columns:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'users'
  and column_name in ('deleted_at', 'deleted_by')
order by column_name;
```

The result must contain both `deleted_at` and `deleted_by`.

Verify the product and inventory objects:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('products', 'inventory_movements')
order by tablename;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('create_product', 'adjust_product_stock')
order by routine_name;
```

Both tables must report `rowsecurity = true`, and both functions must be present.

Verify the services, customers and income objects:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('services', 'customers', 'incomes', 'income_items', 'income_payments')
order by tablename;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'create_income', 'void_income', 'list_incomes', 'get_income_detail',
    'list_income_responsible_users'
  )
order by routine_name;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'inventory_movements'
  and column_name = 'income_id';
```

All five tables must report `rowsecurity = true`, the five canonical functions must be present, and `inventory_movements.income_id` must be listed. `create_income_v2` must not be present after script `015`. `list_income_responsible_users` is the unpaginated manager-only source for the history filter and intentionally retains inactive or logically deleted responsible users that still have sales.

Verify the V2 income columns, commission constraints, historical payment backfill and browser-role isolation:

```sql
select table_name, column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'users' and column_name in (
      'service_commission_rate', 'product_commission_rate'
    ))
    or (table_name = 'incomes' and column_name in (
      'registered_by', 'employee_id', 'request_fingerprint',
      'responsible_role_snapshot',
      'service_commission_base', 'product_commission_base',
      'service_commission_rate', 'product_commission_rate',
      'service_commission_amount', 'product_commission_amount',
      'commission_total', 'barbershop_net', 'full_service_commission',
      'full_service_commission_authorized_by'
    ))
  )
order by table_name, column_name;

select conname
from pg_constraint
where conrelid in ('public.users'::regclass, 'public.incomes'::regclass)
  and conname in (
    'users_service_commission_rate_check',
    'users_product_commission_rate_check',
    'users_owner_commission_zero_check',
    'incomes_responsible_role_snapshot_check',
    'incomes_commission_bases_check',
    'incomes_commission_rates_check',
    'incomes_commission_amounts_check',
    'incomes_commission_total_check',
    'incomes_barbershop_net_check',
    'incomes_full_service_commission_check'
  )
order by conname;

select i.id, i.total, coalesce(sum(ip.amount), 0) as allocated
from public.incomes i
left join public.income_payments ip on ip.income_id = i.id
group by i.id, i.total
having count(ip.id) = 0 or coalesce(sum(ip.amount), 0) <> i.total;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'income_payments'
order by grantee, privilege_type;

select data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'income_payments'
  and column_name = 'amount';
```

Every listed V2 data column except the optional authorizer must report `NO`; all ten constraints must be present; the historical allocation query must return zero rows; and `income_payments.amount` must report `bigint`. `income_payments` must have RLS enabled and no grants to `PUBLIC`, `anon` or `authenticated`.

After script `015`, verify the immutable item snapshots, exact aggregate
reconciliation and sole canonical sale RPC:

```sql
select column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'income_items'
  and column_name in (
    'line_subtotal', 'commission_rate', 'commission_amount',
    'full_commission', 'full_commission_authorized_by'
  )
order by column_name;

select conname
from pg_constraint
where conrelid = 'public.income_items'::regclass
  and conname in (
    'income_items_line_subtotal_check',
    'income_items_commission_rate_check',
    'income_items_commission_amount_check',
    'income_items_full_commission_check',
    'income_items_full_commission_authorized_by_fkey'
  )
order by conname;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_income', 'create_income_v2')
order by p.proname, arguments;

select i.id
from public.incomes i
left join public.income_items ii on ii.income_id = i.id
group by i.id, i.service_commission_base, i.product_commission_base,
  i.service_commission_amount, i.product_commission_amount,
  i.commission_total, i.barbershop_net, i.total
having coalesce(sum(ii.line_subtotal) filter (where ii.item_type = 'service'), 0)
      <> i.service_commission_base
  or coalesce(sum(ii.line_subtotal) filter (where ii.item_type = 'product'), 0)
      <> i.product_commission_base
  or coalesce(sum(ii.commission_amount) filter (where ii.item_type = 'service'), 0)
      <> i.service_commission_amount
  or coalesce(sum(ii.commission_amount) filter (where ii.item_type = 'product'), 0)
      <> i.product_commission_amount
  or coalesce(sum(ii.commission_amount), 0) <> i.commission_total
  or i.barbershop_net + i.commission_total <> i.total;

do $$
begin
  if not exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'create_income'
      and grantee = 'service_role'
      and privilege_type = 'EXECUTE'
  ) or exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name in ('create_income', 'income_as_json')
      and grantee in ('PUBLIC', 'anon', 'authenticated')
      and privilege_type = 'EXECUTE'
  ) then
    raise exception 'INCOME_RPC_GRANT_VERIFICATION_FAILED';
  end if;
end;
$$;
```

All five item columns must be listed; only the nullable authorizer may report
`YES`. All five constraints must be present. The routine query must return one
eight-argument `create_income` row and no `_v2` row. The reconciliation query
must return zero rows and the privilege block must complete successfully.

Verify migration `012`'s canonical profile RPC and the one-time owner correction:

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('update_user_profile', 'update_user_profile_v2')
order by p.proname, arguments;

do $$
begin
  if not exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'update_user_profile'
      and grantee = 'service_role'
      and privilege_type = 'EXECUTE'
  ) then
    raise exception 'UPDATE_USER_PROFILE_SERVICE_ROLE_GRANT_MISSING';
  end if;

  if exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'update_user_profile'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
      and privilege_type = 'EXECUTE'
  ) then
    raise exception 'UPDATE_USER_PROFILE_UNSAFE_EXECUTE_GRANT';
  end if;
end;
$$;

select id
from public.users
where role_id = 1
  and (service_commission_rate <> 0 or product_commission_rate <> 0);

select id
from public.incomes
where responsible_role_snapshot = 'owner'
  and (
    service_commission_rate <> 0
    or product_commission_rate <> 0
    or service_commission_amount <> 0
    or product_commission_amount <> 0
    or commission_total <> 0
    or barbershop_net <> total
    or full_service_commission
    or full_service_commission_authorized_by is not null
  );
```

The first query must return exactly one `update_user_profile` overload with the thirteen arguments used by the server repository and no `_v2` row. The privilege block must complete: it requires an explicit `service_role` `EXECUTE` grant and rejects retained `PUBLIC`, `anon` or `authenticated` execution, while permitting the PostgreSQL function owner. Both owner-correction queries must return zero rows.

Verify weekly schedules, attendance and their server-only routines:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('customer_fixed_schedules', 'fixed_customer_occurrences')
order by tablename;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'create_customer', 'update_customer', 'list_customer_visits',
    'ensure_fixed_customer_occurrences',
    'ensure_fixed_customer_occurrences_for_customer',
    'list_fixed_customer_occurrences',
    'resolve_fixed_customer_occurrence'
  )
order by routine_name;

select conname
from pg_constraint
where conrelid in (
  'public.customer_fixed_schedules'::regclass,
  'public.fixed_customer_occurrences'::regclass
)
  and contype in ('p', 'u')
order by conname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('customer_fixed_schedules', 'fixed_customer_occurrences')
order by grantee, table_name, privilege_type;

select grantee, routine_name, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'ensure_fixed_customer_occurrences_for_customer'
order by grantee, privilege_type;

select column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'customer_fixed_schedules'
  and column_name in ('version', 'effective_from')
order by column_name;

select o.id, o.occurrence_date, s.effective_from
from public.fixed_customer_occurrences o
join public.customer_fixed_schedules s
  on s.customer_id = o.schedule_customer_id
 and s.version = o.schedule_version
where o.occurrence_date < s.effective_from;
```

Both tables must report RLS enabled, all seven routines must be present, the schedule table must have its customer primary key plus non-null `version` and `effective_from`, occurrences must have their schedule-version-date uniqueness constraint, and neither `PUBLIC`, `anon` nor `authenticated` may have table grants. The per-customer occurrence helper must also have no direct `service_role` execute grant. The final query must return zero rows: a schedule version may never generate occurrences before its effective date.

After script `013` is installed, verify the canonical customer RPCs and the financial visit projection without retaining changes. The block creates a temporary active sale plus a temporary voided sale through the installed contracts, so it also works on an otherwise new database.

```sql
begin;

do $$
declare
  actor_id uuid;
  target_customer_id uuid;
  service_id uuid;
  active_income_id uuid;
  voided_income_id uuid;
  visits jsonb;
  checked_routine_name text;
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_customer_v2', 'update_customer_v2')
  ) then
    raise exception 'CUSTOMER_V2_RPC_STILL_PRESENT';
  end if;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'create_customer') <> 1
    or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'update_customer') <> 1
  then
    raise exception 'CUSTOMER_CANONICAL_RPC_OVERLOAD_PRESENT';
  end if;

  foreach checked_routine_name in array array['create_customer', 'update_customer', 'list_customer_visits']
  loop
    if not exists (
      select 1
      from information_schema.routine_privileges rp
      where rp.routine_schema = 'public'
        and rp.routine_name = checked_routine_name
        and grantee = 'service_role'
        and privilege_type = 'EXECUTE'
    ) then
      raise exception 'CUSTOMER_RPC_SERVICE_ROLE_GRANT_MISSING:%', checked_routine_name;
    end if;

    if exists (
      select 1
      from information_schema.routine_privileges rp
      where rp.routine_schema = 'public'
        and rp.routine_name = checked_routine_name
        and grantee in ('PUBLIC', 'anon', 'authenticated')
        and privilege_type = 'EXECUTE'
    ) then
      raise exception 'CUSTOMER_RPC_UNSAFE_EXECUTE_GRANT:%', checked_routine_name;
    end if;
  end loop;

  insert into public.users (
    first_name, last_name, username, password_hash, role_id,
    service_commission_rate, product_commission_rate
  ) values (
    'Verificacion', 'Visitas',
    'verificacion.' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 12),
    '$argon2id$verification', 1, 0, 0
  ) returning id into actor_id;

  target_customer_id := public.create_customer(
    actor_id,
    'Cliente',
    'Temporal',
    '351' || pg_catalog.lpad((pg_catalog.floor(pg_catalog.random() * 100000000)::integer)::text, 8, '0'),
    null,
    null
  );

  insert into public.services (name, normalized_name, price, created_by, updated_by)
  values (
    'Servicio visita ' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 12),
    '', 10000, actor_id, actor_id
  ) returning id into service_id;

  active_income_id := public.create_income_v2(
    actor_id, actor_id, extensions.gen_random_uuid(), target_customer_id, service_id,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10000)),
    false
  );

  voided_income_id := public.create_income_v2(
    actor_id, actor_id, extensions.gen_random_uuid(), target_customer_id, service_id,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10000)),
    false
  );
  perform public.void_income(voided_income_id, actor_id);

  visits := public.list_customer_visits(actor_id, target_customer_id, 1, 100);

  if not exists (
    select 1
    from jsonb_array_elements(visits->'items') as visit(value)
    where (visit.value->>'id')::uuid = active_income_id
  ) then
    raise exception 'CUSTOMER_VISIT_EXPECTED_ACTIVE_SALE_MISSING';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(visits->'items') as visit(value)
    where (visit.value->>'id')::uuid = voided_income_id
  ) then
    raise exception 'CUSTOMER_VISIT_VOIDED_SALE_EXPOSED';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(visits->'items') as visit(value)
    cross join lateral jsonb_array_elements(visit.value->'items') as item(value)
    where not exists (
      select 1
      from public.income_items ii
      where ii.income_id = (visit.value->>'id')::uuid
        and ii.item_type = item.value->>'type'
        and ii.name_snapshot = item.value->>'name'
        and ii.quantity = (item.value->>'quantity')::integer
        and ii.unit_price = (item.value->>'unitPrice')::integer
        and ii.unit_price * ii.quantity = (item.value->>'subtotal')::integer
    )
  ) then
    raise exception 'CUSTOMER_VISIT_SUBTOTAL_MISMATCH';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(visits->'items') as visit(value)
    where not exists (
      select 1
      from public.incomes i
      where i.id = (visit.value->>'id')::uuid
        and i.status = 'active'
        and i.total = (visit.value->>'totalSpent')::integer
    )
  ) then
    raise exception 'CUSTOMER_VISIT_TOTAL_MISMATCH_OR_VOIDED_SALE_EXPOSED';
  end if;

  if jsonb_path_exists(visits, '$.**.employee')
    or jsonb_path_exists(visits, '$.**.employeeId')
    or jsonb_path_exists(visits, '$.**.employee_id')
    or jsonb_path_exists(visits, '$.**.registeredBy')
    or jsonb_path_exists(visits, '$.**.registered_by')
    or jsonb_path_exists(visits, '$.**.registrant')
    or jsonb_path_exists(visits, '$.**.payment')
    or jsonb_path_exists(visits, '$.**.payments')
    or jsonb_path_exists(visits, '$.**.paymentMethod')
    or jsonb_path_exists(visits, '$.**.payment_method')
    or jsonb_path_exists(visits, '$.**.paymentItems')
    or jsonb_path_exists(visits, '$.**.payment_items')
    or jsonb_path_exists(visits, '$.**.commission')
    or jsonb_path_exists(visits, '$.**.commissionTotal')
    or jsonb_path_exists(visits, '$.**.commission_total')
    or jsonb_path_exists(visits, '$.**.commissionAmount')
    or jsonb_path_exists(visits, '$.**.commission_amount')
    or jsonb_path_exists(visits, '$.**.fullServiceCommission')
    or jsonb_path_exists(visits, '$.**.full_service_commission')
    or jsonb_path_exists(visits, '$.**.authorizedBy')
    or jsonb_path_exists(visits, '$.**.authorized_by')
    or jsonb_path_exists(visits, '$.**.authorizer')
    or jsonb_path_exists(visits, '$.**.fullServiceCommissionAuthorizedBy')
    or jsonb_path_exists(visits, '$.**.full_service_commission_authorized_by')
  then
    raise exception 'CUSTOMER_VISIT_PRIVATE_DATA_EXPOSED';
  end if;
end;
$$;

rollback;
```

The block must complete successfully. Each returned line subtotal is matched to its immutable `income_items` snapshot, each `totalSpent` is matched to `incomes.total`, and the created voided sale must be absent. It also rejects employee, registrant, payment, commission and authorizer key variants in the JSON. The rollback leaves the database unchanged.

After an active customer has a schedule, verify idempotent occurrence generation without retaining changes. Replace the dates with a range of at most 70 days:

```sql
begin;
select public.ensure_fixed_customer_occurrences('2026-08-13', '2026-10-08');
select public.ensure_fixed_customer_occurrences('2026-08-13', '2026-10-08');

select schedule_customer_id, schedule_version, occurrence_date, count(*)
from public.fixed_customer_occurrences
where occurrence_date between '2026-08-13' and '2026-10-08'
group by schedule_customer_id, schedule_version, occurrence_date
having count(*) > 1;
rollback;
```

The duplicate query must return zero rows. The rollback preserves the pre-verification state.

After an active user exists, verify product creation and stock adjustment without retaining sample data. Replace the actor UUID before running this block:

```sql
begin;

do $$
declare
  actor_id uuid := '00000000-0000-0000-0000-000000000000';
  product_id uuid;
  resulting_stock integer;
  movement_count integer;
begin
  product_id := public.create_product(
    'Producto de verificación temporal',
    'styling',
    1000,
    2,
    actor_id
  );

  perform public.adjust_product_stock(product_id, actor_id, 'exit', 1);

  select stock into resulting_stock
  from public.products
  where id = product_id;

  select count(*) into movement_count
  from public.inventory_movements
  where inventory_movements.product_id = product_id;

  if resulting_stock <> 1 or movement_count <> 2 then
    raise exception 'PRODUCT_INVENTORY_VERIFICATION_FAILED';
  end if;
end;
$$;

rollback;
```

The block must complete successfully and `rollback` ensures that the temporary product and movements are not retained.

Immediately after script `010` (before applying `012`) and with an active manager, verify a split-payment sale, commission snapshot and void without retaining sample data. Replace the actor UUID before running this block:

```sql
begin;

do $$
declare
  actor_id uuid := '00000000-0000-0000-0000-000000000000';
  service_id uuid;
  customer_id uuid;
  product_id uuid;
  created_income_id uuid;
  original_stock integer := 3;
  resulting_stock integer;
  resulting_visits integer;
  resulting_status text;
  resulting_business_date date;
  movement_count integer;
  resulting_commission integer;
  resulting_net integer;
  allocated_cash integer;
  allocated_transfer integer;
begin
  update public.users
  set service_commission_rate = 50, product_commission_rate = 10
  where id = actor_id;

  insert into public.services (
    name, normalized_name, price, created_by, updated_by
  ) values (
    'Servicio temporal de verificación', '', 5000, actor_id, actor_id
  ) returning id into service_id;

  insert into public.customers (
    first_name, last_name, phone, normalized_phone, email, created_by, updated_by
  ) values (
    'Cliente', 'Temporal', '+54 351 000 0000', '', null, actor_id, actor_id
  ) returning id into customer_id;

  product_id := public.create_product(
    'Producto temporal de venta',
    'styling',
    2500,
    original_stock,
    actor_id
  );

  created_income_id := public.create_income_v2(
    actor_id,
    actor_id,
    extensions.gen_random_uuid(),
    customer_id,
    service_id,
    jsonb_build_array(jsonb_build_object('productId', product_id, 'quantity', 2)),
    jsonb_build_array(
      jsonb_build_object('method', 'cash', 'amount', 4000),
      jsonb_build_object('method', 'transfer', 'amount', 6000)
    ),
    false
  );

  select stock into resulting_stock from public.products where id = product_id;
  select visits into resulting_visits from public.customers where id = customer_id;
  select business_date into resulting_business_date from public.incomes where id = created_income_id;
  select commission_total, barbershop_net
  into resulting_commission, resulting_net
  from public.incomes where id = created_income_id;
  select ip.amount into allocated_cash
  from public.income_payments ip
  where ip.income_id = created_income_id and ip.method = 'cash';
  select ip.amount into allocated_transfer
  from public.income_payments ip
  where ip.income_id = created_income_id and ip.method = 'transfer';

  if resulting_stock <> 1
    or resulting_visits <> 1
    or resulting_business_date <> (now() at time zone 'America/Argentina/Buenos_Aires')::date
    or resulting_commission <> 3000
    or resulting_net <> 7000
    or allocated_cash <> 4000
    or allocated_transfer <> 6000
  then
    raise exception 'INCOME_CREATION_VERIFICATION_FAILED';
  end if;

  perform public.void_income(created_income_id, actor_id);

  select stock into resulting_stock from public.products where id = product_id;
  select visits into resulting_visits from public.customers where id = customer_id;
  select status into resulting_status from public.incomes where id = created_income_id;
  select count(*) into movement_count
  from public.inventory_movements
  where inventory_movements.income_id = created_income_id;

  if resulting_stock <> original_stock
    or resulting_visits <> 0
    or resulting_status <> 'voided'
    or movement_count <> 2
  then
    raise exception 'INCOME_VOID_VERIFICATION_FAILED';
  end if;
end;
$$;

rollback;
```

The block must complete successfully. It verifies the database timestamp-derived Buenos Aires business date, atomic stock and visit changes, the manager void, and both linked inventory movements. `rollback` removes every temporary row.

After script `012` is installed, verify the authoritative owner rule and the preserved manager-to-employee behavior without retaining sample data:

```sql
begin;

do $$
declare
  owner_id uuid;
  employee_id uuid;
  owner_service_id uuid;
  employee_service_id uuid;
  owner_income_id uuid;
  employee_income_id uuid;
  owner_snapshot record;
  employee_snapshot record;
begin
  insert into public.users (
    first_name, last_name, username, password_hash, role_id,
    service_commission_rate, product_commission_rate
  ) values (
    'Owner', 'Temporal', 'owner.temporal', '$argon2id$verification', 1, 0, 0
  ) returning id into owner_id;

  insert into public.users (
    first_name, last_name, username, password_hash, role_id,
    service_commission_rate, product_commission_rate
  ) values (
    'Empleado', 'Temporal', 'empleado.temporal', '$argon2id$verification', 3, 50, 10
  ) returning id into employee_id;

  insert into public.services (name, normalized_name, price, created_by, updated_by)
  values ('Servicio owner temporal', '', 10000, owner_id, owner_id)
  returning id into owner_service_id;

  insert into public.services (name, normalized_name, price, created_by, updated_by)
  values ('Servicio empleado temporal', '', 10000, owner_id, owner_id)
  returning id into employee_service_id;

  owner_income_id := public.create_income_v2(
    owner_id, owner_id, extensions.gen_random_uuid(), null, owner_service_id,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10000)),
    false
  );

  select responsible_role_snapshot, service_commission_rate,
    product_commission_rate, service_commission_amount,
    product_commission_amount, commission_total, barbershop_net, total
  into owner_snapshot
  from public.incomes
  where id = owner_income_id;

  if owner_snapshot.responsible_role_snapshot <> 'owner'
    or owner_snapshot.service_commission_rate <> 0
    or owner_snapshot.product_commission_rate <> 0
    or owner_snapshot.service_commission_amount <> 0
    or owner_snapshot.product_commission_amount <> 0
    or owner_snapshot.commission_total <> 0
    or owner_snapshot.barbershop_net <> owner_snapshot.total
  then
    raise exception 'OWNER_COMMISSION_VERIFICATION_FAILED';
  end if;

  employee_income_id := public.create_income_v2(
    owner_id, employee_id, extensions.gen_random_uuid(), null, employee_service_id,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10000)),
    false
  );

  select responsible_role_snapshot, service_commission_rate,
    product_commission_rate, service_commission_amount,
    product_commission_amount, commission_total, barbershop_net, total
  into employee_snapshot
  from public.incomes
  where id = employee_income_id;

  if employee_snapshot.responsible_role_snapshot <> 'employee'
    or employee_snapshot.service_commission_rate <> 50
    or employee_snapshot.product_commission_rate <> 10
    or employee_snapshot.service_commission_amount <> 5000
    or employee_snapshot.product_commission_amount <> 0
    or employee_snapshot.commission_total <> 5000
    or employee_snapshot.barbershop_net <> 5000
    or employee_snapshot.total <> 10000
  then
    raise exception 'EMPLOYEE_COMMISSION_VERIFICATION_FAILED';
  end if;

  begin
    perform public.create_income_v2(
      owner_id, owner_id, extensions.gen_random_uuid(), null, owner_service_id,
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10000)),
      true
    );
    raise exception 'OWNER_OVERRIDE_VERIFICATION_FAILED';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'INVALID_COMMISSION_OVERRIDE' then
        raise;
      end if;
  end;
end;
$$;

rollback;
```

The block must complete successfully. It proves that owner-responsible sales snapshot zero rates and commission, manager attribution to an employee retains that employee's configured rate, and an owner-targeted full-service override fails with `INVALID_COMMISSION_OVERRIDE`. `rollback` removes the temporary users, services and sales.

After script `014` is installed, verify the canonical category catalog and its
product lock/lifecycle rules without retaining sample data:

```sql
begin;

do $$
declare
  manager_id uuid;
  employee_id uuid;
  target_category_id uuid;
  product_id uuid;
  seeded_category_count integer;
  orphan_count integer;
  derived_normalized_name text;
begin
  if to_regprocedure('public.update_product(uuid,text,uuid,integer,boolean,uuid)') is null
    or to_regprocedure('public.update_product(uuid,text,text,integer,boolean,uuid)') is not null
    or (
      select count(*)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'update_product'
    ) <> 1
  then
    raise exception 'PRODUCT_UPDATE_CANONICAL_RPC_OVERLOAD_PRESENT';
  end if;

  select count(*) into seeded_category_count
  from public.product_categories
  where (normalized_name, name) in (
    ('cuidado capilar', 'Cuidado capilar'),
    ('peinado y styling', 'Peinado y styling'),
    ('cuidado de barba', 'Cuidado de barba'),
    ('fragancias', 'Fragancias')
  );

  if seeded_category_count <> 4 then
    raise exception 'PRODUCT_CATEGORY_SEEDS_NOT_MAPPED';
  end if;

  select count(*) into orphan_count
  from public.products p
  left join public.product_categories c on c.id = p.category_id
  where p.category_id is null or c.id is null;

  if orphan_count <> 0 then
    raise exception 'PRODUCT_CATEGORY_ORPHANS_PRESENT';
  end if;

  insert into public.users (
    first_name, last_name, username, password_hash, role_id,
    service_commission_rate, product_commission_rate
  ) values (
    'Categoria', 'Manager',
    'categoria.manager.' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 10),
    '$argon2id$verification', 1, 0, 0
  ) returning id into manager_id;

  insert into public.users (
    first_name, last_name, username, password_hash, role_id,
    service_commission_rate, product_commission_rate
  ) values (
    'Categoria', 'Empleado',
    'categoria.empleado.' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 10),
    '$argon2id$verification', 3, 0, 0
  ) returning id into employee_id;

  select id into target_category_id
  from public.product_categories
  where normalized_name = 'cuidado capilar';

  update public.product_categories
  set
    name = '  Cuidado   capilar  ',
    normalized_name = 'tampered',
    updated_by = manager_id
  where id = target_category_id;

  select normalized_name into derived_normalized_name
  from public.product_categories
  where id = target_category_id;

  if derived_normalized_name <> 'cuidado capilar' then
    raise exception 'PRODUCT_CATEGORY_NORMALIZED_NAME_DESYNCHRONIZED';
  end if;

  begin
    insert into public.product_categories (
      name, normalized_name, created_by, updated_by
    ) values (
      '  CUIDADO   CAPILAR  ', '', manager_id, manager_id
    );
    raise exception 'PRODUCT_CATEGORY_NORMALIZED_DUPLICATE_ACCEPTED';
  exception
    when unique_violation then null;
  end;

  begin
    perform public.deactivate_product_category(employee_id, target_category_id);
    raise exception 'PRODUCT_CATEGORY_EMPLOYEE_MUTATION_ACCEPTED';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'MANAGER_REQUIRED' then
        raise;
      end if;
  end;

  product_id := public.create_product(
    'Producto categoría temporal ' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 10),
    target_category_id,
    1000,
    1,
    manager_id
  );

  if not exists (
    select 1 from public.products
    where id = product_id and category_id = target_category_id
  ) then
    raise exception 'PRODUCT_CATEGORY_CREATE_MAPPING_FAILED';
  end if;

  begin
    perform public.deactivate_product_category(manager_id, target_category_id);
    raise exception 'PRODUCT_CATEGORY_IN_USE_ACCEPTED';
  exception
    when raise_exception then
      if sqlerrm <> 'PRODUCT_CATEGORY_IN_USE' then
        raise;
      end if;
  end;
end;
$$;

rollback;
```

The block must complete successfully. It verifies all four seeded mappings,
zero null/orphan product references, the sole canonical UUID `update_product`
overload, normalized-name trigger integrity and global uniqueness, manager-only
mutation and the active-product deactivation conflict. The rollback preserves
the pre-verification state.

After script `015` is installed, verify independent line rounding, simultaneous
service/product exceptions, strict flags, authorization and semantic
idempotency without retaining sample data:

```sql
begin;

do $$
declare
  suffix text := substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 10);
  manager_id uuid;
  employee_id uuid;
  owner_id uuid;
  category_id uuid;
  service_id uuid;
  round_product_a_id uuid;
  round_product_b_id uuid;
  full_product_id uuid;
  normal_income_id uuid;
  full_income_id uuid;
  retry_income_id uuid;
  legacy_income_id uuid;
  legacy_retry_income_id uuid;
  multi_full_income_id uuid;
  owner_income_id uuid;
  full_request_id uuid := extensions.gen_random_uuid();
  legacy_request_id uuid := extensions.gen_random_uuid();
  simulated_legacy_fingerprint text;
  stored_fingerprint_after_retry text;
  normal_json jsonb;
  multi_full_json jsonb;
  snapshot record;
  matching_item_count integer;
  full_stock_after_first integer;
  full_stock_after_retry integer;
  legacy_stock_before integer;
  legacy_stock_after_first integer;
  legacy_stock_after_retry integer;
begin
  insert into public.users (
    first_name, last_name, username, password_hash, role_id,
    service_commission_rate, product_commission_rate
  ) values (
    'Manager', 'Comisiones', 'manager.comisiones.' || suffix,
    '$argon2id$verification', 2, 30, 20
  ) returning id into manager_id;

  insert into public.users (
    first_name, last_name, username, password_hash, role_id,
    service_commission_rate, product_commission_rate
  ) values (
    'Empleado', 'Comisiones', 'empleado.comisiones.' || suffix,
    '$argon2id$verification', 3, 45, 10
  ) returning id into employee_id;

  insert into public.users (
    first_name, last_name, username, password_hash, role_id,
    service_commission_rate, product_commission_rate
  ) values (
    'Owner', 'Comisiones', 'owner.comisiones.' || suffix,
    '$argon2id$verification', 1, 0, 0
  ) returning id into owner_id;

  insert into public.product_categories (
    name, normalized_name, created_by, updated_by
  ) values (
    'Categoría comisión ' || suffix, '', manager_id, manager_id
  ) returning id into category_id;

  insert into public.services (
    name, normalized_name, price, created_by, updated_by
  ) values (
    'Servicio comisión ' || suffix, '', 19000, manager_id, manager_id
  ) returning id into service_id;

  round_product_a_id := public.create_product(
    'Producto redondeo A ' || suffix, category_id, 10005, 10, manager_id
  );
  round_product_b_id := public.create_product(
    'Producto redondeo B ' || suffix, category_id, 10005, 10, manager_id
  );
  full_product_id := public.create_product(
    'Producto línea completa ' || suffix, category_id, 15000, 10, manager_id
  );

  -- Each $10,005 product rounds independently to $1,001 at 10%; the parent
  -- product amount must therefore be $2,002 rather than aggregate-rounding $2,001.
  normal_income_id := public.create_income(
    manager_id, employee_id, extensions.gen_random_uuid(), null, service_id,
    jsonb_build_array(
      jsonb_build_object(
        'productId', round_product_a_id,
        'quantity', 1,
        'grantFullCommission', false
      ),
      jsonb_build_object(
        'productId', round_product_b_id,
        'quantity', 1,
        'grantFullCommission', false
      )
    ),
    jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 39010)),
    false
  );

  select service_commission_amount, product_commission_amount,
    commission_total, barbershop_net, total
  into snapshot
  from public.incomes
  where id = normal_income_id;

  if snapshot.service_commission_amount <> 8550
    or snapshot.product_commission_amount <> 2002
    or snapshot.commission_total <> 10552
    or snapshot.barbershop_net <> 28458
    or snapshot.total <> 39010
  then
    raise exception 'NORMAL_ITEM_COMMISSION_VERIFICATION_FAILED';
  end if;

  select count(*) into matching_item_count
  from public.income_items
  where income_id = normal_income_id
    and item_type = 'product'
    and line_subtotal = 10005
    and commission_rate = 10
    and commission_amount = 1001
    and not full_commission
    and full_commission_authorized_by is null;

  if matching_item_count <> 2 then
    raise exception 'INDEPENDENT_PRODUCT_ROUNDING_VERIFICATION_FAILED';
  end if;

  normal_json := public.income_as_json(normal_income_id);
  if normal_json->'commission' <> jsonb_build_object(
      'total', 10552, 'barbershopNet', 28458
    )
    or (
      select count(*) from jsonb_object_keys(normal_json->'commission')
    ) <> 2
    or normal_json->'service'->'commission' <> jsonb_build_object(
      'subtotal', 19000,
      'rate', 45,
      'amount', 8550,
      'fullCommission', false,
      'authorizedBy', null
    )
    or exists (
      select 1
      from jsonb_array_elements(normal_json->'products') product
      where not (product ? 'commission')
        or not (product->'commission' ?& array[
          'subtotal', 'rate', 'amount', 'fullCommission', 'authorizedBy'
        ])
        or (
          select count(*)
          from jsonb_object_keys(product->'commission')
        ) <> 5
    )
  then
    raise exception 'INCOME_ITEM_JSON_CONTRACT_VERIFICATION_FAILED';
  end if;

  -- A two-unit exception covers the complete $30,000 line. Exact retry is
  -- idempotent and must not decrement stock a second time.
  full_income_id := public.create_income(
    manager_id, employee_id, full_request_id, null, null,
    jsonb_build_array(jsonb_build_object(
      'productId', full_product_id,
      'quantity', 2,
      'grantFullCommission', true
    )),
    jsonb_build_array(jsonb_build_object('method', 'transfer', 'amount', 30000)),
    false
  );
  select stock into full_stock_after_first
  from public.products where id = full_product_id;

  retry_income_id := public.create_income(
    manager_id, employee_id, full_request_id, null, null,
    jsonb_build_array(jsonb_build_object(
      'productId', full_product_id,
      'quantity', 2,
      'grantFullCommission', true
    )),
    jsonb_build_array(jsonb_build_object('method', 'transfer', 'amount', 30000)),
    false
  );
  select stock into full_stock_after_retry
  from public.products where id = full_product_id;

  select line_subtotal, commission_rate, commission_amount,
    full_commission, full_commission_authorized_by
  into snapshot
  from public.income_items
  where income_id = full_income_id and product_id = full_product_id;

  if retry_income_id <> full_income_id
    or full_stock_after_first <> 8
    or full_stock_after_retry <> full_stock_after_first
    or snapshot.line_subtotal <> 30000
    or snapshot.commission_rate <> 100
    or snapshot.commission_amount <> 30000
    or not snapshot.full_commission
    or snapshot.full_commission_authorized_by <> manager_id
  then
    raise exception 'FULL_PRODUCT_IDEMPOTENCY_VERIFICATION_FAILED';
  end if;

  begin
    perform public.create_income(
      manager_id, employee_id, full_request_id, null, null,
      jsonb_build_array(jsonb_build_object(
        'productId', full_product_id,
        'quantity', 2,
        'grantFullCommission', false
      )),
      jsonb_build_array(jsonb_build_object('method', 'transfer', 'amount', 30000)),
      false
    );
    raise exception 'CHANGED_PRODUCT_FLAG_RETRY_ACCEPTED';
  exception
    when raise_exception then
      if sqlerrm <> 'INCOME_REQUEST_CONFLICT' then
        raise;
      end if;
  end;

  -- Simulate the exact product fingerprint emitted by create_income_v2 before
  -- grantFullCommission existed. An all-false retry crosses the migration
  -- boundary without rewriting audit state; changing that flag still conflicts.
  select stock into legacy_stock_before
  from public.products where id = round_product_b_id;

  legacy_income_id := public.create_income(
    manager_id, employee_id, legacy_request_id, null, null,
    jsonb_build_array(jsonb_build_object(
      'productId', round_product_b_id,
      'quantity', 1,
      'grantFullCommission', false
    )),
    jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10005)),
    false
  );
  select stock into legacy_stock_after_first
  from public.products where id = round_product_b_id;

  simulated_legacy_fingerprint := pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(jsonb_build_object(
      'responsibleEmployeeId', employee_id,
      'customerId', null,
      'serviceId', null,
      'products', jsonb_build_array(jsonb_build_object(
        'productId', round_product_b_id,
        'quantity', 1
      )),
      'payments', jsonb_build_array(jsonb_build_object(
        'method', 'cash',
        'amount', 10005
      )),
      'grantFullServiceCommission', false
    )::text, 'UTF8'),
    'sha256'
  ), 'hex');

  update public.incomes
  set request_fingerprint = simulated_legacy_fingerprint
  where id = legacy_income_id;

  legacy_retry_income_id := public.create_income(
    manager_id, employee_id, legacy_request_id, null, null,
    jsonb_build_array(jsonb_build_object(
      'productId', round_product_b_id,
      'quantity', 1,
      'grantFullCommission', false
    )),
    jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10005)),
    false
  );
  select stock into legacy_stock_after_retry
  from public.products where id = round_product_b_id;
  select request_fingerprint into stored_fingerprint_after_retry
  from public.incomes where id = legacy_income_id;

  if legacy_retry_income_id <> legacy_income_id
    or legacy_stock_after_first <> legacy_stock_before - 1
    or legacy_stock_after_retry <> legacy_stock_after_first
    or stored_fingerprint_after_retry <> simulated_legacy_fingerprint
  then
    raise exception 'LEGACY_FALSE_FLAG_RETRY_VERIFICATION_FAILED';
  end if;

  begin
    perform public.create_income(
      manager_id, employee_id, legacy_request_id, null, null,
      jsonb_build_array(jsonb_build_object(
        'productId', round_product_b_id,
        'quantity', 1,
        'grantFullCommission', true
      )),
      jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10005)),
      false
    );
    raise exception 'LEGACY_TRUE_FLAG_RETRY_ACCEPTED';
  exception
    when raise_exception then
      if sqlerrm <> 'INCOME_REQUEST_CONFLICT' then
        raise;
      end if;
  end;

  -- Full service and multiple full product lines may coexist and reconcile to
  -- a zero barbershop net when every selected item is granted at 100%.
  multi_full_income_id := public.create_income(
    manager_id, employee_id, extensions.gen_random_uuid(), null, service_id,
    jsonb_build_array(
      jsonb_build_object(
        'productId', full_product_id,
        'quantity', 2,
        'grantFullCommission', true
      ),
      jsonb_build_object(
        'productId', round_product_a_id,
        'quantity', 1,
        'grantFullCommission', true
      )
    ),
    jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 59005)),
    true
  );

  select commission_total, barbershop_net, total
  into snapshot
  from public.incomes
  where id = multi_full_income_id;
  select count(*) into matching_item_count
  from public.income_items
  where income_id = multi_full_income_id
    and full_commission
    and commission_rate = 100
    and commission_amount = line_subtotal
    and full_commission_authorized_by = manager_id;
  multi_full_json := public.income_as_json(multi_full_income_id);

  if snapshot.commission_total <> 59005
    or snapshot.barbershop_net <> 0
    or snapshot.total <> 59005
    or matching_item_count <> 3
    or multi_full_json->'service'->'commission'->'authorizedBy'->>'id'
      is distinct from manager_id::text
    or exists (
      select 1
      from jsonb_array_elements(multi_full_json->'products') product
      where product->'commission'->'authorizedBy'->>'id'
        is distinct from manager_id::text
    )
  then
    raise exception 'MULTIPLE_FULL_ITEMS_VERIFICATION_FAILED';
  end if;

  -- An employee, a manager targeting themselves and a manager targeting an
  -- owner cannot authorize a complete product line.
  begin
    perform public.create_income(
      employee_id, employee_id, extensions.gen_random_uuid(), null, null,
      jsonb_build_array(jsonb_build_object(
        'productId', round_product_b_id,
        'quantity', 1,
        'grantFullCommission', true
      )),
      jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10005)),
      false
    );
    raise exception 'EMPLOYEE_PRODUCT_OVERRIDE_ACCEPTED';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'INVALID_PRODUCT_COMMISSION_OVERRIDE' then raise; end if;
  end;

  begin
    perform public.create_income(
      manager_id, manager_id, extensions.gen_random_uuid(), null, null,
      jsonb_build_array(jsonb_build_object(
        'productId', round_product_b_id,
        'quantity', 1,
        'grantFullCommission', true
      )),
      jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10005)),
      false
    );
    raise exception 'MANAGER_SELF_PRODUCT_OVERRIDE_ACCEPTED';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'INVALID_PRODUCT_COMMISSION_OVERRIDE' then raise; end if;
  end;

  begin
    perform public.create_income(
      manager_id, owner_id, extensions.gen_random_uuid(), null, null,
      jsonb_build_array(jsonb_build_object(
        'productId', round_product_b_id,
        'quantity', 1,
        'grantFullCommission', true
      )),
      jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10005)),
      false
    );
    raise exception 'OWNER_PRODUCT_OVERRIDE_ACCEPTED';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'INVALID_PRODUCT_COMMISSION_OVERRIDE' then raise; end if;
  end;

  begin
    perform public.create_income(
      manager_id, owner_id, extensions.gen_random_uuid(), null, service_id,
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 19000)),
      true
    );
    raise exception 'OWNER_SERVICE_OVERRIDE_ACCEPTED';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'INVALID_COMMISSION_OVERRIDE' then raise; end if;
  end;

  -- Owner-responsible normal items remain zero independently of configured UI
  -- state, while a non-boolean product flag is rejected at the SQL boundary.
  owner_income_id := public.create_income(
    manager_id, owner_id, extensions.gen_random_uuid(), null, service_id,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 19000)),
    false
  );
  select ii.commission_rate, ii.commission_amount, i.commission_total,
    i.barbershop_net, i.total
  into snapshot
  from public.incomes i
  join public.income_items ii on ii.income_id = i.id
  where i.id = owner_income_id and ii.item_type = 'service';

  if snapshot.commission_rate <> 0
    or snapshot.commission_amount <> 0
    or snapshot.commission_total <> 0
    or snapshot.barbershop_net <> snapshot.total
  then
    raise exception 'OWNER_ITEM_ZERO_COMMISSION_VERIFICATION_FAILED';
  end if;

  begin
    perform public.create_income(
      manager_id, employee_id, extensions.gen_random_uuid(), null, null,
      jsonb_build_array(jsonb_build_object(
        'productId', round_product_b_id,
        'quantity', 1,
        'grantFullCommission', 'false'
      )),
      jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10005)),
      false
    );
    raise exception 'NON_BOOLEAN_PRODUCT_FLAG_ACCEPTED';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'INVALID_PRODUCT_ITEMS' then raise; end if;
  end;

  if exists (
    select 1
    from public.incomes i
    left join public.income_items ii on ii.income_id = i.id
    where i.registered_by in (manager_id, employee_id)
    group by i.id, i.total, i.service_commission_base,
      i.product_commission_base, i.service_commission_amount,
      i.product_commission_amount, i.commission_total, i.barbershop_net
    having coalesce(sum(ii.line_subtotal) filter (where ii.item_type = 'service'), 0)
          <> i.service_commission_base
      or coalesce(sum(ii.line_subtotal) filter (where ii.item_type = 'product'), 0)
          <> i.product_commission_base
      or coalesce(sum(ii.commission_amount) filter (where ii.item_type = 'service'), 0)
          <> i.service_commission_amount
      or coalesce(sum(ii.commission_amount) filter (where ii.item_type = 'product'), 0)
          <> i.product_commission_amount
      or coalesce(sum(ii.commission_amount), 0) <> i.commission_total
      or i.barbershop_net + i.commission_total <> i.total
  ) then
    raise exception 'ITEM_AGGREGATE_RECONCILIATION_FAILED';
  end if;
end;
$$;

rollback;
```

The block must complete successfully. It covers independently rounded normal
lines, a full two-unit product line, simultaneous full service/product lines,
employee/self/owner rejection, owner-zero snapshots, strict boolean input,
idempotent stock handling and same-request conflict when only a product flag
changes. It explicitly simulates a fingerprint created before script `015`,
accepts its all-false retry without mutating the stored audit hash, and rejects
the same legacy request when its product flag changes to true. It also validates
the exact itemized JSON contract and reconciles every temporary item's bases and
commission amounts to its parent. The rollback leaves the database unchanged.

Then configure `.env`, temporarily add the three `BOOTSTRAP_OWNER_*` values, and run `npm run bootstrap:owner`. Remove the temporary password value immediately afterward.
