import { Client } from "pg";

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  throw new Error("SUPABASE_DB_URL is required.");
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const requiredFunctions = [
  "close_daily_cash",
  "confirm_daily_cash",
  "create_expense",
  "create_income",
  "get_daily_cash",
  "get_income_detail",
  "get_business_report",
  "list_customer_visits",
  "list_fixed_customer_occurrences",
  "list_incomes",
  "open_daily_cash",
  "pay_fixed_customer_month",
  "resolve_fixed_customer_occurrence",
  "update_expense",
  "update_user_profile",
  "void_expense",
  "void_income",
] as const;

const main = async () => {
  await client.connect();

  const [connection, disposableDatabases, tables, functions, functionDefinitions, legacyPaymentConstraint, unsafeTableGrants, unsafeRoutineGrants, generatedColumns, invariants] =
    await Promise.all([
      client.query<{
        database: string;
        db_user: string;
        server_version: string;
        timezone: string;
        can_create_database: boolean;
      }>(`
        select current_database() as database,
               current_user as db_user,
               current_setting('server_version') as server_version,
               current_setting('TimeZone') as timezone,
               r.rolcreatedb as can_create_database
          from pg_catalog.pg_roles r
         where r.rolname = current_user
      `),
      client.query<{ database: string }>(`
        select datname as database
          from pg_catalog.pg_database
         where datname like 'bastardos_acceptance_%'
         order by datname
      `),
      client.query<{ table_name: string; rls: boolean; force_rls: boolean }>(`
        select c.relname as table_name,
               c.relrowsecurity as rls,
               c.relforcerowsecurity as force_rls
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relkind = 'r'
         order by c.relname
      `),
      client.query<{ name: string; args: string }>(`
        select p.proname as name,
               pg_catalog.pg_get_function_identity_arguments(p.oid) as args
          from pg_catalog.pg_proc p
          join pg_catalog.pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and (p.proname = any($1::text[]) or p.proname like '%work_session%')
         order by p.proname, args
      `, [requiredFunctions]),
      client.query<{ name: string; definition: string }>(`
        select p.proname as name,
               pg_catalog.pg_get_functiondef(p.oid) as definition
          from pg_catalog.pg_proc p
          join pg_catalog.pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = any($1::text[])
         order by p.proname
      `, [[
        "cash_day_as_json",
        "list_customer_visits",
        "list_fixed_customer_occurrences",
        "resolve_fixed_customer_occurrence",
        "void_income",
      ]]),
      client.query<{ count: string }>(`
        select count(*)::text as count
          from pg_catalog.pg_constraint c
          join pg_catalog.pg_class t on t.oid = c.conrelid
          join pg_catalog.pg_namespace n on n.oid = t.relnamespace
         where n.nspname = 'public'
           and t.relname = 'incomes'
           and c.conname = 'incomes_payment_method_check'
      `),
      client.query<{ grantee: string; table_name: string; privilege_type: string }>(`
        select grantee, table_name, privilege_type
          from information_schema.role_table_grants
         where table_schema = 'public'
           and grantee = any(array['anon', 'authenticated', 'PUBLIC'])
         order by grantee, table_name, privilege_type
      `),
      client.query<{ grantee: string; routine_name: string; privilege_type: string }>(`
        select grantee, routine_name, privilege_type
          from information_schema.role_routine_grants
         where specific_schema = 'public'
           and grantee = any(array['anon', 'authenticated', 'PUBLIC'])
         order by grantee, routine_name, privilege_type
      `),
      client.query<{
        table_name: string;
        column_name: string;
        generation_expression: string;
      }>(`
        select table_name, column_name, generation_expression
          from information_schema.columns
         where table_schema = 'public'
           and is_generated = 'ALWAYS'
         order by table_name, ordinal_position
      `),
      client.query<{
        check_name: string;
        violation_count: string;
      }>(`
        select 'active_owners' as check_name,
               case when count(*) >= 1 then 0 else 1 end::text as violation_count
          from public.users
         where role_id = 1 and is_active and deleted_at is null
        union all
        select 'negative_product_stock', count(*)::text
          from public.products where stock < 0
        union all
        select 'income_parent_economics', count(*)::text
          from public.incomes
         where total <> commission_total + barbershop_net
        union all
        select 'income_payment_totals', count(*)::text
          from public.incomes i
         where i.total <> coalesce((
           select sum(ip.amount)::integer from public.income_payments ip where ip.income_id = i.id
         ), 0)
        union all
        select 'multiple_open_work_sessions', count(*)::text
          from (
            select employee_id from public.employee_work_sessions
             where ended_at is null group by employee_id having count(*) > 1
          ) duplicated
        union all
        select 'multiple_active_fixed_month_attempts', count(*)::text
          from (
            select customer_id, period from public.fixed_customer_monthly_payment_attempts
             where status = 'active' group by customer_id, period having count(*) > 1
          ) duplicated
        union all
        select 'canonical_cash_method',
               case when count(*) = 1 then 0 else 1 end::text
          from public.payment_methods
         where system_code = 'cash' and is_active
        union all
        select 'customer_visit_counters', count(*)::text
          from public.customers c
         where c.deleted_at is null
           and c.visits <> (
             select count(*)::integer
               from public.incomes i
              where i.customer_id = c.id
                and i.status = 'active'
                and i.source_type = 'sale'
           )
      `),
    ]);

  const installedNames = new Set(functions.rows.map((row) => row.name));
  const definitions = new Map(functionDefinitions.rows.map((row) => [row.name, row.definition.toLowerCase()]));
  const hardening = {
    legacyPaymentConstraintRemoved: Number(legacyPaymentConstraint.rows[0]?.count ?? 0) === 0,
    visitHistoryExcludesSubscriptions: definitions.get("list_customer_visits")?.includes("source_type = 'sale'") ?? false,
    subscriptionVoidPreservesVisits: definitions.get("void_income")?.includes("source_type = 'sale'") ?? false,
    liveCashUsesAdjustmentAwareExpectedCash: definitions.get("cash_day_as_json")?.includes("current_cash_expected") ?? false,
    employeeAgendaIsScoped: definitions.get("list_fixed_customer_occurrences")?.includes("responsible_user_id") ?? false,
    employeeAttendanceIsScoped: definitions.get("resolve_fixed_customer_occurrence")?.includes("responsible_user_id") ?? false,
  };
  const output = {
    connection: connection.rows[0],
    disposableDatabasesLeftBehind: disposableDatabases.rows.map((row) => row.database),
    schema: {
      tableCount: tables.rowCount,
      rlsDisabled: tables.rows.filter((table) => !table.rls).map((table) => table.table_name),
      generatedColumns: generatedColumns.rows,
    },
    functions: {
      missingRequired: requiredFunctions.filter((name) => !installedNames.has(name)),
      installed: functions.rows,
    },
    security: {
      unsafeTableGrants: unsafeTableGrants.rows,
      unsafeRoutineGrantCount: unsafeRoutineGrants.rowCount ?? 0,
      unsafeRoutineGrants: unsafeRoutineGrants.rows,
    },
    hardening,
    invariants: invariants.rows.map((row) => ({
      check: row.check_name,
      violations: Number(row.violation_count),
    })),
  };

  console.log(JSON.stringify(output, null, 2));

  const hasFailures = output.functions.missingRequired.length > 0
    || output.disposableDatabasesLeftBehind.length > 0
    || output.schema.rlsDisabled.length > 0
    || output.security.unsafeTableGrants.length > 0
    || output.security.unsafeRoutineGrantCount > 0
    || Object.values(hardening).some((value) => !value)
    || output.invariants.some((invariant) => invariant.violations > 0);
  if (hasFailures) process.exitCode = 1;
};

main()
  .finally(() => client.end())
  .catch((error: unknown) => {
    const details = error && typeof error === "object" && "code" in error
      ? { code: String(error.code), message: error instanceof Error ? error.message : "Database audit failed" }
      : { message: error instanceof Error ? error.message : "Database audit failed" };
    console.error(JSON.stringify(details));
    process.exitCode = 1;
  });
