import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client, type DatabaseError } from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
const confirmed = process.argv.includes("--confirm-disposable");

if (!connectionString) throw new Error("SUPABASE_DB_URL is required.");
if (!confirmed) throw new Error("Pass --confirm-disposable to create and drop an isolated database.");

const migrationDirectory = join(process.cwd(), "supabase", "queries");
const migrations = readdirSync(migrationDirectory)
  .filter((name) => /^\d{3}_.+\.sql$/.test(name))
  .sort((left, right) => left.localeCompare(right));
const expectedVersions = Array.from({ length: migrations.length }, (_, index) => String(index + 1).padStart(3, "0"));

assert.deepEqual(
  migrations.map((name) => name.slice(0, 3)),
  expectedVersions,
  "Migration filenames must form one contiguous numeric sequence.",
);

const databaseName = `bastardos_acceptance_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
const databaseUrl = new URL(connectionString);
databaseUrl.pathname = `/${databaseName}`;

const clientOptions = (url: string) => ({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

const admin = new Client(clientOptions(connectionString));
let disposable: Client | null = null;
let created = false;
let currentMigration = "none";

const main = async () => {
  await admin.connect();
  const capability = await admin.query<{ can_create_database: boolean }>(`
    select r.rolcreatedb as can_create_database
      from pg_catalog.pg_roles r
     where r.rolname = current_user
  `);
  assert.equal(capability.rows[0]?.can_create_database, true, "Configured database role cannot create disposable databases.");

  await admin.query(`create database "${databaseName}"`);
  created = true;

  disposable = new Client(clientOptions(databaseUrl.toString()));
  await disposable.connect();
  await disposable.query("set statement_timeout = '60s'");
  await disposable.query("set lock_timeout = '10s'");

  const applied: string[] = [];
  for (const migration of migrations) {
    currentMigration = migration;
    await disposable.query(readFileSync(join(migrationDirectory, migration), "utf8"));
    applied.push(migration);
  }

  const finalState = await disposable.query<{
    table_count: number;
    missing_functions: string[];
    unsafe_table_grants: string[];
    unsafe_routine_grants: string[];
    legacy_payment_constraint: number;
    visit_history_scoped: boolean;
    subscription_void_scoped: boolean;
    cash_expected_scoped: boolean;
    employee_agenda_scoped: boolean;
    employee_attendance_scoped: boolean;
  }>(`
    with required_functions(name) as (
      values
        ('create_income'), ('list_incomes'), ('get_income_detail'), ('void_income'),
        ('pay_fixed_customer_month'), ('list_customer_visits'),
        ('list_fixed_customer_occurrences'), ('resolve_fixed_customer_occurrence'),
        ('open_daily_cash'), ('close_daily_cash'), ('confirm_daily_cash'),
        ('create_expense'), ('update_expense'), ('void_expense')
    ), definitions as (
      select p.proname, lower(pg_catalog.pg_get_functiondef(p.oid)) as body
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in (
           'cash_day_as_json', 'list_customer_visits', 'list_fixed_customer_occurrences',
           'resolve_fixed_customer_occurrence', 'void_income'
         )
    )
    select
      (select count(*)::integer from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r') as table_count,
      coalesce((select array_agg(r.name order by r.name)
        from required_functions r
       where not exists (
         select 1 from pg_catalog.pg_proc p
         join pg_catalog.pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = r.name
       )), '{}'::text[]) as missing_functions,
      coalesce((select array_agg(distinct grantee || ':' || table_name || ':' || privilege_type order by grantee || ':' || table_name || ':' || privilege_type)
        from information_schema.role_table_grants
        where table_schema = 'public' and grantee in ('PUBLIC', 'anon', 'authenticated')), '{}'::text[]) as unsafe_table_grants,
      coalesce((select array_agg(distinct grantee || ':' || routine_name || ':' || privilege_type order by grantee || ':' || routine_name || ':' || privilege_type)
        from information_schema.role_routine_grants
        where specific_schema = 'public' and grantee in ('PUBLIC', 'anon', 'authenticated')), '{}'::text[]) as unsafe_routine_grants,
      (select count(*)::integer from pg_catalog.pg_constraint c
        join pg_catalog.pg_class t on t.oid = c.conrelid
       where t.relname = 'incomes' and c.conname = 'incomes_payment_method_check') as legacy_payment_constraint,
      coalesce((select body like '%source_type = ''sale''%' from definitions where proname = 'list_customer_visits'), false) as visit_history_scoped,
      coalesce((select body like '%source_type = ''sale''%' from definitions where proname = 'void_income'), false) as subscription_void_scoped,
      coalesce((select body like '%current_cash_expected%' from definitions where proname = 'cash_day_as_json'), false) as cash_expected_scoped,
      coalesce((select body like '%responsible_user_id%' from definitions where proname = 'list_fixed_customer_occurrences'), false) as employee_agenda_scoped,
      coalesce((select body like '%responsible_user_id%' from definitions where proname = 'resolve_fixed_customer_occurrence'), false) as employee_attendance_scoped
  `);

  const state = finalState.rows[0];
  assert.ok(state.table_count >= 25);
  assert.deepEqual(state.missing_functions, []);
  assert.deepEqual(state.unsafe_table_grants, []);
  assert.deepEqual(state.unsafe_routine_grants, []);
  assert.equal(state.legacy_payment_constraint, 0);
  assert.equal(state.visit_history_scoped, true);
  assert.equal(state.subscription_void_scoped, true);
  assert.equal(state.cash_expected_scoped, true);
  assert.equal(state.employee_agenda_scoped, true);
  assert.equal(state.employee_attendance_scoped, true);

  const acceptance = spawnSync(
    process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm",
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npm run acceptance:db"]
      : ["run", "acceptance:db"],
    {
      cwd: process.cwd(),
      env: { ...process.env, SUPABASE_DB_URL: databaseUrl.toString() },
      encoding: "utf8",
    },
  );
  if (acceptance.stdout) process.stdout.write(acceptance.stdout);
  if (acceptance.stderr) process.stderr.write(acceptance.stderr);
  assert.equal(acceptance.status, 0, "Behavioral acceptance failed against the clean database.");

  console.log(JSON.stringify({
    database: databaseName,
    migrationsApplied: applied.length,
    firstMigration: applied[0],
    lastMigration: applied.at(-1),
    behavioralAcceptance: "passed",
    finalState: state,
  }, null, 2));
};

main()
  .catch((error: unknown) => {
    const databaseError = error as DatabaseError;
    console.error(JSON.stringify({
      migration: currentMigration,
      code: databaseError.code,
      message: error instanceof Error ? error.message : "Clean-install acceptance failed.",
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (disposable) await disposable.end().catch(() => undefined);
    if (created) {
      await admin.query(`drop database if exists "${databaseName}" with (force)`).catch((error: unknown) => {
        console.error(JSON.stringify({
          cleanup: databaseName,
          message: error instanceof Error ? error.message : "Could not drop disposable database.",
        }));
        process.exitCode = 1;
      });
    }
    await admin.end().catch(() => undefined);
  });
