# Context snapshot

Captured: 2026-09-26

## Current state

- Active branch: `dev`; the latest upstream change integrated before this repair was `fa0af88`.
- Reports is implemented end to end: monthly financial narrative, active-period selector, service/product highlights and manager-only team performance combining responsible-user economics with employee attendance productivity.
- The configured PostgreSQL test database has both `039_business_reports.sql` and the behavior owned by `040_production_hardening.sql` applied and audited on PostgreSQL 17.6.
- Migration `041_employee_service_prices_and_automatic_cash.sql` is applied to the configured database. Employees may adjust only the selected service/cut price with a reason; product-price adjustments remain manager-only.
- Migration `042_optional_customer_phone.sql` is installed in the configured test database. Customer phone is optional, blank values become `NULL`, and supplied active phone numbers remain unique.
- Migration `043_initial_balance_cash_close_constraint.sql` is installed in test. It repairs the legacy `daily_cash_counts_check` so an `initial_balance`-only day can close automatically.
- Migration `044_income_list_charged_totals.sql` is ready but not installed in the configured test database. It changes only the `list_incomes` projection so revenue totals and average ticket use charged `incomes.total` snapshots; rollback-only acceptance verifies the repair without rewriting existing sales.
- Caja has no supported manual opening or closing operation. Managers may load or correct today's opening balance before or during sales, automatic closing remains owned by `close_pending_daily_cash`, and the physical-count confirmation remains a separate post-close step.
- The opening-balance dialog starts empty when no balance has been loaded, requires an explicit amount (including an explicitly typed zero), and preloads the saved amount only when editing an existing balance.
- Production remains gated on a target backup/restore point, approved deployment window and the runbook in `docs/production-deployment.md`.
- TASK-01 responsive hardening has been reapplied after an external git reset; the shared shell, tablet card/list breakpoints, overflow containment and narrow dialog/sheet handling are restored.
- TASK-01 verification after restoration: 225 test files / 1028 tests passed; typegen, typecheck and production build passed. Lint passed with the pre-existing unused `Store` warning in `src/components/app-sidebar.tsx`.
- Income history now aborts superseded list requests, times out stalled initial and interactive loads after 15 seconds, restores the last successfully applied filters on failure and offers an exact-query retry. This prevents a failed narrow filter from displaying broader-period commission metrics under the new filter labels.
- The employee work-session control can be minimized on mobile into a draggable left/right edge bubble; its minimized state and clamped vertical position persist locally without affecting the desktop control.
- The read-only database audit now verifies sale-to-item total and commission rollups, per-item commission bounds and every active employee's projected commission total against the direct active-income sum.
- A production upgrade from an older development revision exposed that migration `020` attempted its historical `income_items` snapshot backfill while the immutable-snapshot trigger from `015` was active. The canonical `020` now suspends only `income_items_prevent_snapshot_mutation` around that backfill inside the existing transaction and restores it before constraints are promoted.
- The affected production rollout remains paused before `030`: after confirming the restore point, rerun the corrected `020`, rerun idempotent projection repair `024`, verify the ten-argument canonical `create_income`, then rerun `030` and continue in order.

## Delivered hardening

- Employee fixed-customer agenda reads and attendance mutations are scoped in PostgreSQL to active schedules currently assigned to the actor. Managers retain the complete agenda.
- Fixed-subscription incomes remain part of daily revenue and Caja but are excluded from customer visit history and visit counters, including void handling.
- Live Caja expected cash includes cash-denominated post-close adjustments; charged service/product snapshots and subscription classification remain consistent across live and closed projections.
- The obsolete legacy income-payment constraint is removed and residual execution grants on internal trigger/helper functions are revoked.
- `040_production_hardening.sql` converges databases after the colleague-owned Reports migration `039`; the same final behavior is folded into the canonical clean-install migrations.
- `018_automatic_daily_cash.sql` installs `pg_cron` only in Supabase's managed `postgres` database and skips scheduler setup in isolated disposable databases.
- Clean installation exposed and fixed a canonical `021` defect where the amount-allocation SQL alias shadowed the PL/pgSQL `raw_item` record in `compute_fixed_subscription_payments`.
- Reports owns migration `039_business_reports.sql`; production hardening follows as `040_production_hardening.sql`. Migrations `041` through `044` are the current local increments.
- Income-list manager metrics now converge with Reports, payments and stored commission identities when a charged price differs from catalog: `grossTotal` and `average` use active `incomes.total`, while catalog snapshots remain available for audit.

## Verification

- `npx next typegen`: passed.
- `npx tsc --noEmit`: passed.
- Focused income/commission/loading/work-session regression runs: the initial 8 files / 68 tests passed, and the final income/work-session review pair passed 2 files / 20 tests after adding pending-metric and viewport-resize coverage.
- `npm test`: 226 files / 1040 tests passed on the integrated branch. A preliminary single-worker run was interrupted after the runner stalled without producing progress; the standard project command completed successfully.
- `npm run lint`: passed with zero errors and the pre-existing unused `Store` warning in `src/components/app-sidebar.tsx`.
- `npm run build`: Next.js 16.3 Turbopack production build passed and emitted the complete application route surface.
- `git diff --check`: passed.
- Current `041` verification: focused RED/GREEN regressions passed 3 files / 43 tests; the final complete application suite passed 227 files / 1051 tests. Route type generation, TypeScript, ESLint (zero errors, the pre-existing `Store` warning only) and the Next.js production build passed.
- Current `042` application verification: focused customer coverage passed 17 files / 82 tests; the final complete application suite passed 227 files / 1057 tests. Route type generation, TypeScript and the Next.js production build passed; ESLint reported zero errors and only the pre-existing unused `Store` warning. PostgreSQL acceptance and the disposable `001`-`042` clean-install gate were not run because applying the pending migrations to the configured database was not authorized.
- Current opening-balance UX verification: focused RED/GREEN coverage passed 3 files / 12 tests; the final complete application suite passed 227 files / 1058 tests. A preliminary full run had one unrelated income-form timing failure that passed immediately in isolation; the required clean rerun passed completely. Route type generation, TypeScript and the production build passed; ESLint reported zero errors and only the pre-existing unused `Store` warning.
- Independent code review found no remaining critical or important issue after the service-switch draft reset and service-override target invariant were added.
- The configured-database audit passed after installing `041`: all required functions are present, the manual Caja RPCs are gone, RLS/grants are safe and every audited stored-data invariant is clean.
- The rollback-only PostgreSQL acceptance proved the employee service-price override, employee product-price rejection and missing-service guard on the configured database. It then exposed an independent upgraded-schema incompatibility: the installed legacy `daily_cash_counts_check` rejects automatic closure of an `initial_balance`-only register. The transaction rolled back all synthetic fixtures; the remaining Caja convergence needs a new append-only repair before the complete acceptance can pass.
- After pulling `14c89d2`, the complete local suite passed: 227 files / 1058 tests, ESLint with zero errors and the pre-existing unused `Store` warning, Next route type generation, TypeScript and production build.
- The rollback-only database acceptance first reproduced the legacy Caja failure. With `043` included, it passed every scenario, including balance-only automatic closure; all fixtures rolled back. The disposable clean-install gate applied all 43 migrations, passed behavioral acceptance and dropped its database.
- `042` and `043` were then installed in the configured test database. The post-install read-only audit passed with both new hardening flags true, zero RLS/grant/stored-data violations and no abandoned disposable databases. The post-install rollback-only acceptance also passed every scenario.
- `npm run acceptance:db`: migration `040` compiled inside the transaction and all 43 rollback-only PostgreSQL scenarios passed, including Reports authorization/financial identities, employee agenda isolation, subscription visit semantics and adjustment-aware live expected cash; all fixtures rolled back.
- `npm run audit:db`: 25 RLS-enabled domain tables, no missing required functions, no unsafe table/routine grants, every hardening fingerprint true, zero stored-data invariant violations (including the three commission projection/rollup checks) and no abandoned disposable databases.
- The disposable clean-install gate applied all 40 migrations from `001_extensions_and_roles.sql` through `040_production_hardening.sql`, then passed the complete behavioral acceptance with 25 tables, no missing functions, no unsafe grants and every hardening fingerprint true. Its temporary database was dropped.
- Migration `044` RED/GREEN acceptance reproduced an adjusted sale reporting catalog ARS 42,000 instead of charged ARS 35,000, then passed with exact charged revenue, commission, net, average and payment identities. The rollback-only database acceptance passed all scenarios and removed every synthetic fixture.
- The disposable clean-install gate applied all 44 migrations through `044_income_list_charged_totals.sql`, reran the behavioral acceptance against the final schema and dropped its temporary database. The final schema retained 25 tables, no missing required functions and no unsafe table or routine grants.

## Boundaries

- Historical migration files remain intentionally tracked even when they are redundant no-ops on a current clean installation; they reproduce older upgrade paths and must not be renumbered or deleted casually.
- Authenticated HTTP and multi-connection concurrency suites are staging/test gates because they commit fixtures before cleanup. They were already green in the prior stabilization evidence but were not rerun during this closeout; never run them against production.
- The clean-install runner requires a non-production PostgreSQL role with `CREATEDB`. The regular audit and rollback-only acceptance do not require that permission.
- A pre-`040` audit of an existing database may exit nonzero for the missing hardening fingerprints only. Any RLS, grant, stored-data invariant or unrelated contract failure blocks migration.

## Recommended next task

Prepare the production rollout following `docs/production-deployment.md`: confirm the production schema lineage and restore point, then apply only its missing migrations in numeric order during the deployment window. The `.env` in this workspace points to test; production credentials and restore-point confirmation are not available here.
