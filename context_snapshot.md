# Context snapshot

Captured: 2026-08-26

## Current state

- Active branch: `feat/business-reports`, integrating the completed Reports migration `039` with production hardening migration `040` from `origin/feat/changes-fullstack`.
- Reports is implemented end to end: monthly financial narrative, active-period selector, service/product highlights and manager-only team performance combining responsible-user economics with employee attendance productivity.
- The configured PostgreSQL test database has both `039_business_reports.sql` and the behavior owned by `040_production_hardening.sql` applied and audited on PostgreSQL 17.6.
- Production remains gated on a target backup/restore point, approved deployment window and the runbook in `docs/production-deployment.md`.

## Delivered hardening

- Employee fixed-customer agenda reads and attendance mutations are scoped in PostgreSQL to active schedules currently assigned to the actor. Managers retain the complete agenda.
- Fixed-subscription incomes remain part of daily revenue and Caja but are excluded from customer visit history and visit counters, including void handling.
- Live Caja expected cash includes cash-denominated post-close adjustments; charged service/product snapshots and subscription classification remain consistent across live and closed projections.
- The obsolete legacy income-payment constraint is removed and residual execution grants on internal trigger/helper functions are revoked.
- `040_production_hardening.sql` converges databases after the colleague-owned Reports migration `039`; the same final behavior is folded into the canonical clean-install migrations.
- `018_automatic_daily_cash.sql` installs `pg_cron` only in Supabase's managed `postgres` database and skips scheduler setup in isolated disposable databases.
- Clean installation exposed and fixed a canonical `021` defect where the amount-allocation SQL alias shadowed the PL/pgSQL `raw_item` record in `compute_fixed_subscription_payments`.
- Reports owns migration `039_business_reports.sql`; production hardening follows as `040_production_hardening.sql`. New migrations start at `041`.

## Verification

- `npx next typegen`: passed.
- `npx tsc --noEmit`: passed.
- `npm test -- --maxWorkers=1`: 225 files / 1026 tests passed on the integrated branch.
- `npm run lint`: passed with zero warnings.
- `npm run build`: Next.js 16.3 Turbopack production build passed and emitted the complete application route surface.
- `git diff --check`: passed.
- `npm run acceptance:db`: migration `040` compiled inside the transaction and all 43 rollback-only PostgreSQL scenarios passed, including Reports authorization/financial identities, employee agenda isolation, subscription visit semantics and adjustment-aware live expected cash; all fixtures rolled back.
- `npm run audit:db`: 25 RLS-enabled domain tables, no missing required functions, no unsafe table/routine grants, every hardening fingerprint true, zero stored-data invariant violations and no abandoned disposable databases.
- The disposable clean-install gate applied all 40 migrations from `001_extensions_and_roles.sql` through `040_production_hardening.sql`, then passed the complete behavioral acceptance with 25 tables, no missing functions, no unsafe grants and every hardening fingerprint true. Its temporary database was dropped.

## Boundaries

- Historical migration files remain intentionally tracked even when they are redundant no-ops on a current clean installation; they reproduce older upgrade paths and must not be renumbered or deleted casually.
- Authenticated HTTP and multi-connection concurrency suites are staging/test gates because they commit fixtures before cleanup. They were already green in the prior stabilization evidence but were not rerun during this closeout; never run them against production.
- The clean-install runner requires a non-production PostgreSQL role with `CREATEDB`. The regular audit and rollback-only acceptance do not require that permission.
- A pre-`040` audit of an existing database may exit nonzero for the missing hardening fingerprints only. Any RLS, grant, stored-data invariant or unrelated contract failure blocks migration.

## Recommended next task

The integrated branch is ready for review and merge into `dev`. Production rollout remains a separate approved operation following `docs/production-deployment.md`.
