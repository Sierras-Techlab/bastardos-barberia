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

Then configure `.env`, temporarily add the three `BOOTSTRAP_OWNER_*` values, and run `npm run bootstrap:owner`. Remove the temporary password value immediately afterward.
