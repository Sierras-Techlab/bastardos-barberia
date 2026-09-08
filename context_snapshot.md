# Context snapshot

Captured: 2026-09-07

## Current state

- Active branch: `dev`, updated from `origin/dev` at `5c9931d`.
- Reports is implemented end to end: monthly financial narrative, active-period selector, service/product highlights and manager-only team performance combining responsible-user economics with employee attendance productivity.
- The configured PostgreSQL test database has both `039_business_reports.sql` and the behavior owned by `040_production_hardening.sql` applied and audited on PostgreSQL 17.6.
- Migration `041_employee_service_prices_and_automatic_cash.sql` is implemented locally but has not been applied to the configured database. Employees may adjust only the selected service/cut price with a reason; product-price adjustments remain manager-only.
- Caja has no supported manual opening or closing operation. Managers may load or correct today's opening balance before or during sales, automatic closing remains owned by `close_pending_daily_cash`, and the physical-count confirmation remains a separate post-close step.
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
- Reports owns migration `039_business_reports.sql`; production hardening follows as `040_production_hardening.sql`. New migrations start at `041`.

## Verification

- `npx next typegen`: passed.
- `npx tsc --noEmit`: passed.
- Focused income/commission/loading/work-session regression runs: the initial 8 files / 68 tests passed, and the final income/work-session review pair passed 2 files / 20 tests after adding pending-metric and viewport-resize coverage.
- `npm test`: 226 files / 1040 tests passed on the integrated branch. A preliminary single-worker run was interrupted after the runner stalled without producing progress; the standard project command completed successfully.
- `npm run lint`: passed with zero errors and the pre-existing unused `Store` warning in `src/components/app-sidebar.tsx`.
- `npm run build`: Next.js 16.3 Turbopack production build passed and emitted the complete application route surface.
- `git diff --check`: passed.
- Current `041` verification: focused RED/GREEN regressions passed 3 files / 43 tests; the final complete application suite passed 227 files / 1051 tests. Route type generation, TypeScript, ESLint (zero errors, the pre-existing `Store` warning only) and the Next.js production build passed.
- Independent code review found no remaining critical or important issue after the service-switch draft reset and service-override target invariant were added.
- The updated rollback-only PostgreSQL acceptance and clean-install scripts cover employee service overrides, employee product rejection, opening-balance create/edit, removed manual RPCs, automatic close and physical-count confirmation. Execution against the configured external database was not authorized in this task, so PostgreSQL compilation/behavior remains a deployment gate.
- `npm run acceptance:db`: migration `040` compiled inside the transaction and all 43 rollback-only PostgreSQL scenarios passed, including Reports authorization/financial identities, employee agenda isolation, subscription visit semantics and adjustment-aware live expected cash; all fixtures rolled back.
- `npm run audit:db`: 25 RLS-enabled domain tables, no missing required functions, no unsafe table/routine grants, every hardening fingerprint true, zero stored-data invariant violations (including the three commission projection/rollup checks) and no abandoned disposable databases.
- The disposable clean-install gate applied all 40 migrations from `001_extensions_and_roles.sql` through `040_production_hardening.sql`, then passed the complete behavioral acceptance with 25 tables, no missing functions, no unsafe grants and every hardening fingerprint true. Its temporary database was dropped.

## Boundaries

- Historical migration files remain intentionally tracked even when they are redundant no-ops on a current clean installation; they reproduce older upgrade paths and must not be renumbered or deleted casually.
- Authenticated HTTP and multi-connection concurrency suites are staging/test gates because they commit fixtures before cleanup. They were already green in the prior stabilization evidence but were not rerun during this closeout; never run them against production.
- The clean-install runner requires a non-production PostgreSQL role with `CREATEDB`. The regular audit and rollback-only acceptance do not require that permission.
- A pre-`040` audit of an existing database may exit nonzero for the missing hardening fingerprints only. Any RLS, grant, stored-data invariant or unrelated contract failure blocks migration.

## Recommended next task

Install migration `041` only during an explicitly authorized test/deployment operation, then run the rollback-only database acceptance, read-only audit and disposable `001`-`041` clean-install gate. Production rollout remains a separate approved operation following `docs/production-deployment.md`, including the paused older-database migration recovery described above.
