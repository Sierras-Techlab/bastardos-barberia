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

Every listed V2 data column except the optional authorizer must report `NO`; all eight constraints must be present; the historical allocation query must return zero rows; and `income_payments.amount` must report `bigint`. `income_payments` must have RLS enabled and no grants to `PUBLIC`, `anon` or `authenticated`.

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
    'create_customer_v2', 'update_customer_v2', 'list_customer_visits',
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

After scripts `008` through `010` are installed and an active manager exists, verify a split-payment sale, commission snapshot and void without retaining sample data. Replace the actor UUID before running this block:

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

Then configure `.env`, temporarily add the three `BOOTSTRAP_OWNER_*` values, and run `npm run bootstrap:owner`. Remove the temporary password value immediately afterward.
