# Production deployment

## Required access

- Application runtime: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `NEXT_PUBLIC_APP_URL`.
- Database operations: `SUPABASE_DB_URL`, using a direct or session-pool PostgreSQL connection with schema migration permissions.
- Disposable clean-install acceptance: the configured PostgreSQL role must additionally have `CREATEDB`; this permission is not required by the read-only audit or rollback-only acceptance.
- A database backup or Supabase restore point before changing an existing production schema.

`SUPABASE_DB_URL` is sufficient for the repository's database audit and acceptance tooling. It must never be exposed to browser code or committed with credentials.

## Migration policy

Migration files are append-only deployment history. A repair that is redundant on a current clean installation can still be required by an older deployed database, so it must not be deleted or renumbered without first proving that every deployed environment has crossed its convergence migration.

Current classification:

| Range | Purpose | Production treatment |
| --- | --- | --- |
| `001`-`023` | Foundational schema and product domains | Required in numeric order for an empty database. |
| `024`-`038` | Expenses plus historical upgrade/repair lineage | Retained and executed for an empty database; existing databases execute only files not already installed. |
| `039_business_reports.sql` | Manager-only business and team Reports module | Required after `038` and before the final hardening step. |
| `040_production_hardening.sql` | Final convergence for clean and upgraded schemas | Required after Reports migration `039`. Its behavior is already applied and verified in the test database. |
| `041_employee_service_prices_and_automatic_cash.sql` | Employee service pricing and automatic Caja lifecycle | Required after `040`; verify the deployed schema before applying. |
| `042_optional_customer_phone.sql` | Optional customer phone with unique supplied numbers | Required after `041`. |
| `043_initial_balance_cash_close_constraint.sql` | Repair legacy Caja count check for balance-only closure | Required after `042`, including on upgraded databases that retain the older check. |
| `044_income_list_charged_totals.sql` | Income-list revenue metrics based on charged totals | Required after `043`; replaces only `list_incomes` and does not rewrite sale data. |

## Empty production database

1. Confirm the target database is empty and create a restore point.
2. Execute every file from `001_extensions_and_roles.sql` through `044_income_list_charged_totals.sql` exactly once in numeric order.
3. Stop immediately on the first SQL error.
4. Run the read-only audit.
5. Bootstrap the first owner only after the complete SQL chain succeeds.
6. Remove the temporary `BOOTSTRAP_OWNER_*` values after bootstrap.

The complete chain is tested with:

```bash
npx tsx --env-file=.env scripts/system-clean-install-acceptance.ts --confirm-disposable
```

The command creates a uniquely named database on the configured test PostgreSQL server, applies the complete migration sequence, validates final functions/security contracts and drops the database in `finally`, including failure paths.

## Existing production database

The exact starting migration must be established from deployment records and schema fingerprints. Never infer it only from filenames present in the repository.

For a database already installed and verified through `041`:

1. Create a backup or restore point.
2. Run `npm run audit:db` and retain the sanitized output. Before `042` and `043`, the command is expected to exit nonzero for `customerPhoneIsOptional` and `cashCountsAllowInitialBalanceOnlyClosure`; stop if it reports any stored-data invariant, RLS, grant or unrelated contract failure.
3. Execute `042_optional_customer_phone.sql`, `043_initial_balance_cash_close_constraint.sql` and `044_income_list_charged_totals.sql` in numeric order, stopping on the first error.
4. Run `npm run audit:db` again. Every hardening flag and invariant must pass.
5. Run `npm run acceptance:db`; it creates synthetic rows inside one transaction and rolls everything back.
6. Deploy the matching application build.
7. Perform manager and employee smoke tests for login, scoped fixed-customer agenda, normal sale, monthly payment, income history and Caja.

If production is still paused before `030_create_income_override_record_repair.sql` after the older `020` backfill failure, do not jump to `042`. Confirm the restore point and actual installed schema, rerun the corrected `020`, rerun the idempotent projection repair `024`, verify the ten-argument canonical `create_income`, then run `030` through `044` in numeric order. Stop on the first SQL error and repeat the audit and rollback-only acceptance before deploying the matching application build. This path comes from the recorded paused rollout in `context_snapshot.md`; verify it against the production database before use.

The signature check before `030` is:

```sql
select pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
from pg_catalog.pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname = 'create_income'
  and p.pronargs = 10;
```

It must return the canonical ten-argument routine before continuing.

Do not run committed HTTP or concurrency acceptance against production. Those suites are staging/test gates because they create committed fixtures before cleanup.

## Release gates

Required before approval:

```bash
npx next typegen
npx tsc --noEmit
npm test
npm run lint
npm run build
npm run audit:db
npm run acceptance:db
```

Additionally, the disposable clean-install gate must pass on a non-production server. Production remains blocked if any migration, audit hardening flag, stored-data invariant or rollback-only acceptance fails.

## Reports coordination

Migration number `039` belongs to Reports; production hardening is `040`, and new migrations start at `041`. Reports query authoritative tables through a dedicated manager-only RPC. Revenue uses active `incomes.total`; service/product lines use `income_items.charged_subtotal`; expenses use active `expenses.amount`; Caja remains a separate physical reconciliation source.
