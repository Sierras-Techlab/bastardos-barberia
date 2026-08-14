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
12. `012_owner_commission_rules.sql`
13. `013_customer_visit_financials.sql`

Run each entire file and stop if Supabase reports an error. These scripts target a new project; do not edit generated tables manually afterward.

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
    'create_income_v2', 'void_income', 'list_incomes', 'get_income_detail',
    'list_income_responsible_users'
  )
order by routine_name;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'inventory_movements'
  and column_name = 'income_id';
```

All five tables must report `rowsecurity = true`, the five functions must be present, and `inventory_movements.income_id` must be listed. `list_income_responsible_users` is the unpaginated manager-only source for the history filter and intentionally retains inactive or logically deleted responsible users that still have sales.

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

After script `013` is installed, verify the canonical customer RPCs and the financial visit projection without retaining changes. This block identifies the most recent active customer sale; create one first if the database has none.

```sql
begin;

do $$
declare
  actor_id uuid;
  target_customer_id uuid;
  target_income_id uuid;
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

  select id into actor_id
  from public.users
  where is_active and deleted_at is null
  order by created_at, id
  limit 1;

  select i.customer_id, i.id
  into target_customer_id, target_income_id
  from public.incomes i
  where i.status = 'active' and i.customer_id is not null
  order by i.created_at desc, i.id desc
  limit 1;

  if actor_id is null or target_customer_id is null then
    raise exception 'CUSTOMER_VISIT_FINANCIAL_VERIFICATION_REQUIRES_ACTIVE_SALE';
  end if;

  visits := public.list_customer_visits(actor_id, target_customer_id, 1, 100);

  if not exists (
    select 1
    from jsonb_array_elements(visits->'items') as visit(value)
    where (visit.value->>'id')::uuid = target_income_id
  ) then
    raise exception 'CUSTOMER_VISIT_EXPECTED_ACTIVE_SALE_MISSING';
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
    or jsonb_path_exists(visits, '$.**.payments')
    or jsonb_path_exists(visits, '$.**.commission')
  then
    raise exception 'CUSTOMER_VISIT_PRIVATE_DATA_EXPOSED';
  end if;
end;
$$;

rollback;
```

The block must complete successfully. Each returned line subtotal is matched to its immutable `income_items` snapshot, each `totalSpent` is matched to `incomes.total`, and every returned income must remain active. It also rejects `employee`, `payments` and `commission` keys in the JSON. The rollback leaves the database unchanged.

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

Then configure `.env`, temporarily add the three `BOOTSTRAP_OWNER_*` values, and run `npm run bootstrap:owner`. Remove the temporary password value immediately afterward.
