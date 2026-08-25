# Context snapshot

Captured: 2026-08-22

## Local corrective closeout — 2026-08-25

- Income creation HTTP 500 was reproduced safely against the configured Supabase project with a forced-rollback diagnostic request. PostgreSQL returned SQLSTATE `55000`: the migration `020` version of canonical `create_income` declared `override_record` as a PL/pgSQL record while reusing it as a lateral SQL alias, so the unassigned variable shadowed the relation alias. Migration `020` now uses the distinct `charged_product_record` accumulator, and incremental `025_create_income_override_record_repair.sql` repairs already-installed databases without `_v2` objects or stored-data changes. Applying `025` remains an operator action because this workspace has a service-role key but no PostgreSQL connection or Supabase Management/CLI credential capable of DDL.
- Final local verification after the `create_income` repair is clean: `npx next typegen`, `npx tsc --noEmit`, 185 test files / 870 tests, ESLint with zero warnings, the Next.js 16.3 production build and `git diff --check` pass. Real verification of the repaired RPC requires applying `025` and retrying a sale against Supabase.
- Employee income creation no longer sends manager-only price override fields as `null`. `IncomeForm` now includes `servicePriceOverride` and `productPriceOverrides` only for owner/admin payloads, matching the strict employee API schema and eliminating the pre-database HTTP 400. Role-safety regression coverage asserts both properties are absent from employee requests.
- Creating a customer from `/incomes/new` no longer fails after the atomic insert: the repository now disambiguates the `customer_fixed_schedules.responsible_user_id -> users.id` PostgREST embed with its exact FK hint, eliminating the confirmed live `PGRST201`. The customer modal also stops its submit event at the dialog boundary, so it cannot submit/review the enclosing income form. Both defects have RED→GREEN regression coverage, and the corrected read projection succeeds against the configured Supabase database without returning customer data to the log.
- `/incomes/new` now presents employee payment allocations as human percentages from 0% through 100% (two-decimal precision) instead of exposing raw 0..10000 basis points. A single method renders as 100%, combined methods can be entered as ordinary percentages, and the selector converts them back to integer basis points only at the existing application boundary; manager ARS allocations and the database contract are unchanged.
- The current verification after the customer-create repair is clean: `npx next typegen`, `npx tsc --noEmit`, 185 test files / 868 tests, ESLint with zero warnings and the Next.js production build all pass.
- User commission editing was failing with HTTP 500 because the server sends the thirteen-argument `update_user_profile` RPC while the earlier migration `010` had installed that commission-aware routine as `update_user_profile_v2` and retained the legacy nine-argument canonical function. Migration `010` now installs the canonical name for clean databases, and incremental migration `024_user_commission_profile_rpc.sql` safely repairs databases already installed through `023`, removes the temporary `_v2` routine, restores server-only grants and reloads the PostgREST schema cache.
- Regression coverage validates both clean installation and incremental repair contracts. Focused user migration/repository/endpoint tests pass (18 tests). Applying `024` to the configured Supabase database remains an operator action before the commission-editing fix is observable there.
- A new source-level and behavioral audit repaired the remaining inconsistencies on `feat/changes-fullstack`; the remote Supabase project was not changed.
- Income previews now calculate manager overrides from the charged line prices, and `IncomeClient.create(role, input)` parses the role-specific response without trusting a browser header.
- Migration `021` now dispatches manager/employee projections from the authoritative actor role, validates and locks active payment methods, keeps `monthlyPrice` out of employee JSON and maps unavailable methods to an explicit `409` application error.
- The final independent review additionally fixed the real camelCase JSON contract consumed by `021`, removed inferred legacy schedule ownership in favor of `LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED`, and made monthly-payment retries compare an immutable normalized request fingerprint before consulting mutable schedule state.
- Migration `022` was rebuilt in place (no `_v2` objects): live registers have nullable `closed_at`; manual close snapshots and confirms; automatic close snapshots and remains pending; confirmation never recomputes financials; physical expected cash uses only `system_code='cash'`; subscriptions have snapshot kind `subscription`; free sales and same-day live voids do not create invalid cash adjustments; the canonical 018 financial projection is retained behind the lifecycle wrapper.
- Manual close and post-close voids now serialize through the same global lock. The first-income trigger rejects `CASH_ALREADY_CLOSED`, so a late or racing income rolls back instead of committing outside the immutable daily snapshot.
- Caja UI now treats every persisted live register as a manual close and the strict schema accepts both persisted live IDs, zero-value audited sales and negative expected cash after a later cash adjustment.
- `/customers` now accepts the ISO offset form returned by PostgreSQL `timestamptz` (for example `+00:00`) for `createdAt`; the previous Z-only Zod boundary caused the directory to fail before render.
- Final local verification after the customer timestamp fix: `npx next typegen` passes; `npx tsc --noEmit` passes; `npm test` passes 184 files / 863 tests; `npm run lint` passes with zero warnings; `npm run build` succeeds on Next.js 16.3; and `git diff --check` is clean.
- Real PostgreSQL acceptance against a disposable Supabase database remains mandatory before applying the cumulative `019` → `023` chain to the shared database.

## Verified stabilization handoff — 2026-08-23

- All six tasks of the corrective repair plan are closed locally on `feat/changes-fullstack`. Final verification: `npx next typegen` clean, `npx tsc --noEmit` clean, `npm test` 184 files / 823 tests pass, `npm run lint` clean (zero warnings), `npm run build` (Next.js 16.3 Webpack) succeeds and `git diff --check` clean.
- The commits land in this order:
  - `334312c fix(incomes): complete role-safe entry contracts` (Task 1 — RED→GREEN close)
  - `b594ac7 fix(incomes): render role-specific history and metrics` + `33aea01 test(incomes): add employee history and dashboard RED coverage` (Task 2)
  - `0b6eb44 fix(subscriptions): rebuild migration 021 monthly payment contract` (Task 3)
  - `5a8a015 fix(subscriptions): reconcile 021 client and UI contracts` (Task 4)
  - `246a8af test(customers): add 023 behavioral regression cases` (Task 5 — migration SQL unchanged)
- Task 6 (real PostgreSQL acceptance against a disposable Supabase project) cannot be executed from this chat. The operator must run the rollback-wrapped acceptance scenarios per block, capture the sanitized JSON outputs and attach the evidence to the deploy record. **Until that gate is recorded, the cumulative 019 → 023 chain must remain un-deployed.**
- The committed repository HEAD is structurally verified; the installed remote Supabase is untouched by this worktree.

## Corrective audit — 2026-08-23

- A fresh cross-layer audit found deployment-blocking inconsistencies in the current implementations of blocks `020`, `021` and `022`, despite `npm test` (184 files / 802 tests), TypeScript, ESLint and the production build passing.
- Do **not** apply migrations `020` through `023` to the shared Supabase project yet. In particular, `021` references a missing attempts `status` column and has projection/client unit mismatches; `022` has invalid migration order/lifecycle SQL and does not correctly promote the canonical read path; employee income entry/history/dashboard remain wired to manager-shaped or amount-based contracts.
- The authoritative repair guide is `docs/superpowers/plans/2026-08-23-operational-control-corrective-repair.md`. It supersedes the previous recommendation to deploy the five-block chain immediately. The installed remote baseline must remain separate from repository HEAD until the guide's real PostgreSQL acceptance gate passes.

## In-progress corrective repair (Task 1 partial)

The corrective repair is in progress on `feat/changes-fullstack`. Task 1 of the plan is partially implemented but not yet green:

**Done in commit `76426b3` (Task 1 partial):**
- `IncomeFormData` is a discriminated union `ManagerIncomeFormData | EmployeeIncomeFormData`. Employee projection exposes `earning`/`earningUnit` instead of `price`. The manager projection keeps `price`.
- `managerIncomeFormSchema` and `employeeIncomeFormSchema` are separate Zod schemas with role-specific payment discriminated unions (`amount` for manager, `basisPoints` for employee). `priceOverrideSchema` accepts nonnegative integers (manager can give a line for free). Zero-total manager sale is allowed with empty payments.
- `PaymentMethodSelector` is a discriminated `mode: "manager" | "employee"` prop rendering either integer ARS inputs or basis-point inputs. The previous "Agregar medio" generic button was replaced with per-method toggle buttons because the test contract expects per-method names.
- `role-safety.test.tsx` is the new RED that asserts employee payload never leaks `price|catalogUnitPrice|chargedUnitPrice|total|payments|barbershopNet|registeredBy`, employee submit always sends `basisPoints` (summing 10000), manager submit sends exact integer ARS amounts, and negative amounts are rejected by the selector.

**Closed in commit `334312c` (Task 1 completion):**
- `IncomeForm` now auto-defaults the first active payment method for the employee viewer (regardless of how many methods are active) so the "Confirmar ingreso" dialog opens without forcing the operator to click a method when more than one is configured.
- The page computes the employee earning from the authenticated user's service/product commission rates and projects it into `ServiceSelector`, `ProductSelector`, `IncomeSummary` and `CommissionPreview` without ever serializing the catalog price; the manager path still receives the full catalog price projection.
- `PaymentMethodSelector` is a true ADD-on-click selector: clicking a non-selected method while another is selected adds it to combined mode (instead of silently replacing). The combined-mode badge reports `Faltan $ X` / `Importe distribuido correctamente` / `Sobran $ X`. Inactive-method clearing preserves per-method amounts (it no longer collapses back to the first method with the full total).
- `role-safety.test.tsx` types integer ARS values via `user.clear` (no implicit `*100` conversion), drops the contradictory `payments` key from `FORBIDDEN_KEYS` and keeps manager and employee submit paths discriminated.
- The historic `income-form.test.tsx` is renamed to `managerForm.test.tsx` so the manager form suite owns the manager schema and `role-safety.test.tsx` owns the employee schema; the 11 manager scenarios still pass.
- Full verification: 184 files / 802 tests pass, TypeScript clean, ESLint clean, `npm run build` succeeds, `git diff --check` clean.

**Closed in commits `b594ac7` + `33aea01` (Task 2 completion):**
- `ManagerPaginatedIncomes` and `EmployeePaginatedIncomes` are defined as separate discriminated projections of the API envelope; `PaginatedIncomes` is their union and `IncomeListRow` is the per-row union used by table, mobile list, detail sheet and presentation helpers.
- `incomeClient.listAs(role, query)` and `incomeClient.getAs(role, id)` parse the API success envelope with the schema selected by the viewer (manager or sanitized employee); the broad cast-through-unknown pattern is removed from `/incomes` and `/incomes/[id]`.
- The home page no longer filters out records with `employeeCommission` and no longer casts them to manager shape; `IncomeSummaryCard` accepts the `DashboardIncomeSummary | EmployeeDashboardIncomeSummary` discriminated union, replacing the `isEmployee` flag with a real `viewer` discriminant ("Lo generado para vos" / "Comisión diaria registrada" for employees; "Facturación bruta" / "Neto barbería" for managers).
- `IncomeVoidDialog` is restricted to manager-shape rows via the `IncomesView` guard so the dialog never renders for an employee.
- `IncomesView` tests are split into a manager describe (5 cases) and an employee describe with 3 RED cases that assert the sanitized "Tus ventas registradas" header, the absence of the manager-only filters and a detail sheet that never leaks catalog/total/payment/registered-by phrases.
- Full verification: 184 files / 807 tests pass, TypeScript clean, ESLint clean.

**Closed in commit `0b6eb44` (Task 3 completion):**
- Migration 021 installs `attempts.status` with a CHECK constraint and the partial unique index `fixed_payment_attempts_one_active_period` that guarantees exactly one active attempt per (customer, period).
- `pay_fixed_customer_month` no longer calls `ensure_daily_cash_open`; migration 022 owns universal opening.
- The role snapshot is read as canonical text (`'owner' | 'admin' | 'employee'`), the request fingerprint is stored as a hexadecimal text via `pg_catalog.encode(extensions.digest(...), 'hex')`, and no `uuid::jsonb` cast is used.
- The canonical `void_income` RPC is preserved; an `AFTER UPDATE OF status` trigger on `public.incomes` flips the linked attempt to `voided` so audit/stock/post-close Caja semantics stay intact.
- `get_fixed_customer_month` falls back to the most recent attempt and a new `synthesize_pending_fixed_customer_month` helper lets the first payment dialog open for an unpaid month.
- The migration test asserts the new contracts; the cross-migration test adds guards for `ensure_daily_cash_open`, JWT settings, the `uuid::jsonb` cast and the canonical `void_income` replacement.
- Full verification: 184 files / 818 tests pass, TypeScript clean, ESLint clean.

**Closed in commit `5a8a015` (Task 4 completion):**
- `FixedCustomerPaymentApiError(status, code, message, fields)` is raised from every list/pay/get envelope parse failure, and the success envelopes (`{ data: { items } }`, `{ data: { month } }`) are parsed with the strict Zod schemas from `schemas.ts`.
- The legacy `*100` / `/100` conversions are stripped from the customer-editor and fixed-customer-payment dialogs; the form state stores the integer ARS value, the input step is `1`, and the dialog forwards the integer amount.
- Full verification: 184 files / 819 tests pass, TypeScript clean, ESLint clean.

**Closed in commit `246a8af` (Task 5 completion):**
- Migration 023 needs no production change. The behavioral regression tests document that only active normal sales qualify, fixed-subscription incomes are excluded, voids are filtered by the partial index, the per-customer newest sale wins via `DISTINCT ON` with ordered `business_date` and `created_at`, customers without active sales get a NULL `lastVisitBusinessDate` via `LEFT JOIN latest_sale`, and the date is projected through `America/Argentina/Buenos_Aires`.
- Full verification: 184 files / 823 tests pass, TypeScript clean, ESLint clean.

**Closed in commits `2fafb10` + `cf09259` (corrective-repair v2):**
- **Migration 022:** `payment_methods.system_code` is added BEFORE any query reads it; the legacy `daily_cash_counts_check` is relaxed so a manager may open a register with zero sales; `close_daily_cash` and `confirm_daily_cash` use named PL/pgSQL variables (no more `$4` references); `expected_cash` is recomputed as `opening_balance + net Efectivo payments` instead of the gross sales total; an `AFTER INSERT` trigger on `public.incomes` calls `ensure_daily_cash_open(new.registered_by, new.business_date)` so the cash register opens on the first income without duplicating the call.
- **Income client + success state:** `create(role, input)` parses the response with the manager or sanitized employee schema and returns `IncomeListItem | EmployeeIncomeListItem`. IncomeSuccessState renders the employee sanitized projection (only `employeeCommission`) without ever reading `total`.
- **Income form:** `LinePriceEditor` is wired into both the service card and every product row; manager sales reach the server with `servicePriceOverride` and `productPriceOverrides`. The schema keeps manager payments optional for zero-total free sales.
- **Migration 021:** every read projection carries the `viewer` discriminant; `fixed_customer_month_as_employee_json` omits `monthlyPrice`; `get_fixed_customer_month` falls back to `synthesize_pending_fixed_customer_month` (canonical YYYY-MM period) so the first payment dialog opens for unpaid periods; `compute_fixed_subscription_payments` rejects `basis_points <= 0` and `computed_amount <= 0`; `mark_fixed_subscription_attempt_voided` records `coalesce(new.voided_by, new.registered_by)` so the audit row reflects the manager that actually voided the subscription.
- **Dashboard:** `buildIncomeSummaryForViewer` takes an explicit `UserRole` parameter; employees with no sales today still see the employee summary (RED test added).
- Full verification: 184 files / 844 tests pass, TypeScript clean, ESLint clean.

**Remaining outstanding work (Task 6 — real PostgreSQL acceptance):**
- Operator must run the rollback-wrapped acceptance scenarios per block against a disposable Supabase project and capture the sanitized JSON outputs before the cumulative 019 → 023 chain is rolled out. Without that evidence, remote installation remains blocked.

## Repository state

## Corrective repair remaining work (must finish before deploying migrations 020�023)

Authoritative guide: docs/superpowers/plans/2026-08-23-operational-control-corrective-repair.md. The repair is **interrupted mid-Task 1**; the next chat must continue with the in-progress work before starting Tasks 2�7.

### Task 1 � Role-safe income entry and employee privacy (PARTIALLY GREEN)

Status: 2 of 6 new ole-safety.test.tsx cases fail because the 'Confirmar ingreso' dialog never opens. The form's handleReview returns setReviewValues(validValues) only when the payment sum matches, but the dialog is not visible.

**Next chat must do:**
- Diagnose why the dialog doesn't open. Likely candidates: react-hook-form re-initializing defaultValues on prop change, the PaymentMethodSelector's useEffect mutating the form, or stale serviceId validation.
- Once the 2 failing cases pass, income-form.test.tsx will likely regress because historic tests assume mount-based payments. Split them into a managerForm.test.tsx that uses the manager schema, and keep the form's employee flow tested by ole-safety.test.tsx.
- All 6 ole-safety.test.tsx cases must pass before Task 1 closes. Run the focused RED (
pm test --run src/components/incomes/role-safety src/components/incomes/income-form) plus 
px tsc --noEmit, 
pm run lint, git diff --check before committing.
- Commit with ix(incomes): complete role-safe entry contracts (the partial commit used the same message; the final commit may reuse it).

### Task 2 � Income history and dashboard projections (PENDING)

Goal: define ManagerPaginatedIncomes and EmployeePaginatedIncomes, parse each API success envelope with the schema selected by the viewer, never cast employee data to manager shape, never use s never or s unknown as ..., render the employee dashboard with employeeCommission only, and write RED for the history list and dashboard for the employee viewer. The (home)/page.tsx and incomes/page.tsx must use the discriminated union.

Files: src/types/income.ts, src/lib/incomes/client.ts, src/app/(dashboard)/incomes/page.tsx, src/app/(dashboard)/(home)/page.tsx, src/components/incomes/incomes-view.tsx, src/components/incomes/income-table.tsx, src/components/incomes/income-mobile-list.tsx, src/components/incomes/income-detail-sheet.tsx, src/components/dashboard/income-summary-card.tsx and matching tests. Also remove the s never in the page components and the dashboard's ilter((item) => item && typeof item === 'object' && !('employeeCommission' in item)) that discards employee records.

### Task 3 � Rebuild migration 021 (PENDING)

Goal: write the canonical schema to a clean PostgREST-installable file with ttempts.status (active|voided) + check constraint, partial unique index for active (customer, period), role text snapshot (not numeric), canonical pay_fixed_customer_month that does NOT call ensure_daily_cash_open (022 will own universal opening), the role as text, and a hexadecimal fingerprint via encode(extensions.digest(...), 'hex') if the column is text. Also rewrite get_fixed_customer_month to synthesize a pending object from the active schedule when no attempt exists. Use an AFTER UPDATE OF status trigger to mark the linked attempt voided when oid_income flips the income, preserving the canonical void function.

Files: supabase/queries/021_fixed_customer_monthly_payments.sql, src/lib/fixed-customer-payments/migration-021.test.ts, src/lib/supabase/operational-control-migrations.test.ts, src/lib/supabase/database.types.ts, supabase/queries/README.md. Make sure the client and dialog tests (Task 4) still pass.

### Task 4 � Reconcile 021 client and UI (PENDING)

Goal: read API success envelopes { data: { items } } and { data: { month } } with strict Zod, raise FixedCustomerPaymentApiError(status, code, message, fields?) on failure, ensure the ARS integer flows without /100/*100 (15000 stored, 15000 sent), accept combined { paymentMethodId, amount }[] for managers, and the employee dialog never renders monthlyPrice. Files: src/lib/fixed-customer-payments/client.ts, src/lib/fixed-customer-payments/client.test.ts, src/app/api/fixed-customer-months/route.test.ts, src/components/customers/customer-editor-dialog.tsx, src/components/fixed-customers/fixed-customer-payment-dialog.tsx, src/components/customers/customers-workspace.tsx.

### Task 5 � Verify 023 (LIKELY GREEN)

Step 1: add behavioral regression cases (no visits, one active sale, void hides newest, subscription ignored, Buenos Aires date ordering).
Step 2: run focused tests, correct only verified defects. The current migration likely needs no production change.
Step 3: commit only if production or test files changed, with ix(customers): preserve qualifying last visit.

### Task 6 � Real PostgreSQL acceptance (PENDING; CANNOT EXECUTE)

The plan requires real database acceptance against a disposable Supabase project. Without a remote execution environment we cannot satisfy this gate from the chat. The next chat must:
- Apply migrations 001 through 023 in order to a disposable test project.
- Run the documented acceptance sections per block (Task 6 Steps 2�5).
- Save exact commands, exit results and representative sanitized JSON.
- If a script fails, fix the canonical SQL in place (no _v2 objects), regenerate the operational-control-migrations.test.ts guards, re-run.

### Task 7 � Final verification and documentation (PENDING)

Run the full verification set: 
px next typegen, 
px tsc --noEmit, 
pm test, 
pm run lint, 
pm run build. Then reconcile AGENTS.md, context_snapshot.md, product.md, the four 2026-08-21-02x-*.md plans, and 2026-08-22-operational-control-roadmap-status.md. Record the verified handoff and commit with docs(operations): record verified stabilization rollout. Do not claim remote deployment unless Tasks 1�6 are green and the operator's actual Supabase run is recorded.

## Definition of done (verbatim from the corrective repair plan)

- Employee sale entry sends basis points, never catalog prices, and successfully creates an authoritative income.
- Employee history/dashboard/detail show only their earning and sanitized concepts.
- Migration 021 installs and supports pending/pay/duplicate/retry/void/re-pay without invalid columns or casts.
- Migration 022 installs after 021; manual and automatic Caja states match the approved lifecycle.
- Expected physical cash uses only Efectivo plus opening balance and cash adjustments.
- Subscription payments enter the day's income and Caja without becoming customer visits.
- Last visit derives only from the latest active normal sale.
- Clean PostgreSQL installation and end-to-end manager/employee scenarios pass.
- Full tests, lint, TypeScript, build and diff checks pass after the final production change.

- Active worktree branch: `feat/changes-fullstack`. Blocks `019`, `020`, `021`, `022` and `023` are implemented locally on top of the automatic Caja baseline through migration `018` and the operational-control redesign through migration `023`.
- The approved operational-control architecture covers ordered blocks `019` through `023`; all five blocks are implemented locally.
- The resumable roadmap index is `docs/superpowers/plans/2026-08-22-operational-control-roadmap-status.md`. It links the approved spec and all five detailed plans, records deployment gates and marks the roadmap as fully implemented pending remote application.
- **Implemented locally — 023:** migration `023_customer_last_visit.sql` adds a partial index on `incomes(customer_id, business_date desc, created_at desc)` filtered by `status='active'` and `source_type='sale'` and promotes `list_customers(actor_user_id)` plus `get_customer_visits` to derive each customer's last active sale business date in `America/Argentina/Buenos_Aires`. Voids and `fixed_subscription` incomes are excluded; a void immediately reveals the previous qualifying sale. No mutable customer column is added and the projection never exposes payment, commission, employee or price data. The customer directory adds a "Última visita" column rendered with `formatLastVisit` (date + relative label like "hoy", "ayer", "hace N días/semanas/meses/años" or "próxima").
- **Pending Supabase application — 023:** manually execute `023_customer_last_visit.sql` after installed migration `022`, then run its rollback-wrapped acceptance scenarios. No remote SQL was executed by this worktree.
- **Implemented locally — 022:** migration `022_manual_cash_lifecycle.sql` evolves the automatic Caja into a manager-controlled lifecycle: `opening_balance`, `opening_source`, `close_mode`, `expected_cash`, `counted_cash`, `difference_cash` and `reconciliation_state` are added to `daily_cash_registers`. Legacy `018` registers are backfilled as zero opening, `first_income`, `automatic`, `pending_confirmation`; their financial snapshots stay immutable. The migration preflight aborts with `CASH_PAYMENT_METHOD_REQUIRED` unless exactly one normalized payment method named `Efectivo` exists. The payment-method RPCs reject rename/deactivate/delete of the protected record via `CASH_PAYMENT_METHOD_PROTECTED`. New RPCs `open_daily_cash`, `close_daily_cash`, `confirm_daily_cash` and the protected `ensure_daily_cash_open` (called by both `create_income` and `pay_fixed_customer_month`) use the same advisory lock as the daily register and persist a unified lifecycle block via the promoted `cash_day_as_json`. The `/cash` workspace exposes `Abrir caja`, `Cerrar caja` and `Confirmar conteo` dialogs with Surplus/Shortage/Sin diferencia badges plus lifecycle cards (Saldo inicial / Efectivo esperado / Conteo físico). The reconciliation expectation `expectedCash = openingBalance + Efectivo net` lives in `src/lib/cash/reconciliation.ts`.
- **Pending Supabase application — 022:** manually execute `022_manual_cash_lifecycle.sql` after installed migration `021`, then run its rollback-wrapped acceptance scenarios. No remote SQL was executed by this worktree.
- **Implemented locally — 021:** migration `021_fixed_customer_monthly_payments.sql` requires `responsible_user_id` and `monthly_price` on every active fixed schedule (preflight aborts with `LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED`), adds `incomes.source_type` with `sale | fixed_subscription` plus a one-active-subscription unique index, installs the append-only `fixed_customer_monthly_payment_attempts` table and exposes `list_fixed_customer_months`, `pay_fixed_customer_month` and `get_fixed_customer_month`. The pay RPC atomically locks customer/schedule/responsible user, calculates the manager-amount / employee-basis-points allocation, persists the subscription income with a `subscription_concept` snapshot, links the attempt and leaves the canonical `create_income` RPC untouched. `void_income` now also marks the linked payment attempt as voided, reopening the month without deleting history.
- **Pending Supabase application — 021:** manually execute `021_fixed_customer_monthly_payments.sql` after installed migration `020`, then run its rollback-wrapped acceptance scenarios and the README preflight for legacy schedules. No remote SQL was executed by this worktree.
- **Implemented locally — 020:** migration `020_income_pricing_owner_commissions_and_employee_privacy.sql` removes the `012` owner-zero rules, persists catalog/charged/adjustment snapshots per line, accepts basis-point payments from employees, permits zero-total manager sales without payments and exposes sanitized employee JSON via `income_as_employee_json`. The repository parses manager and employee projections with strict role-aware Zod schemas; the route handler picks the schema by the authenticated user's role.
- **Pending Supabase application — 020:** manually execute `020_income_pricing_owner_commissions_and_employee_privacy.sql` after installed migration `019`, then run its rollback-wrapped acceptance scenarios. No remote SQL was executed by this worktree.
- **Implemented locally — 019:** migration, strict role-scoped domain/repository contracts, authenticated no-store API/client, persistent employee clock control, Presentismo history and manager correction UI. Only employees can clock themselves; actor/timestamps are server-derived. An employee sale requires that manager's. Managers do not require a session; a manager sale attributed to an employee links that employee's open session when one exists, otherwise retains the explicit `outsideWorkSession` audit flag. Manager corrections require a reason plus the visible `updatedAt` version, reject stale snapshots under the row lock and append immutable prior/new timestamps. Browser successes are parsed with the employee or manager Zod schema before UI state changes. Exact-session metrics exclude voided incomes; manager rows/cards show gross, net and that session's employee commission, while employee payloads omit gross/net.
- **Pending Supabase application — 019:** manually execute `019_employee_work_sessions.sql` after installed migration `018`, then run its documented rollback-wrapped acceptance block and object/RLS/grant/trigger checks. No remote SQL was executed by this worktree.
- The former `.worktrees/commercial-operations-v2` worktree was removed after the integration. The local `codex/commercial-operations-v2` branch remains only as a historical pointer to commit `158680c`.
- Commercial operations V2 is implemented locally through migrations `010` through `013`. The exact installed revision of the shared Supabase project must be verified before applying later migrations; this task did not mutate the remote database.
- User authorized autonomous in-scope implementation, local tests and commits. Remote SQL application, push and PR remain outside the authorization received.
- Product-category domain, authenticated API client, product UUID contracts, manager UI and migrations `014`/`017` are implemented. The user confirmed category deletion is functional against the configured Supabase project.
- Item-level product commissions (plan `015`, Tasks 1–4) and migration `015` are implemented locally. The canonical item-snapshot response and product exception behavior remain pending manual database installation.
- Dynamic payment methods plan `016` is implemented end to end: the strict catalog/API plus generalized income contracts, selector, manager administration, history filters, dashboard presentation and concurrency-safe deletion for unused methods. The user confirmed payment-method deletion is functional against the configured Supabase project.
- Safe product-category deletion is implemented through incremental migration `017`, a manager-only domain/API contract and the category administration UI. Referenced categories remain protected.
- Automatic Caja is implemented through migration `018`, strict server-only RPC adapters, manager-only APIs and the responsive `/cash` workspace. The user executed the migration and confirmed `/cash` is functional; this pagination task did not independently inspect the installed SQL objects.
- Fixed-customer monthly payments: `src/lib/fixed-customer-payments` (schemas/service/repository/contracts/client) plus `src/app/api/fixed-customer-months` (list/pay/get routes), `src/components/fixed-customers/fixed-customer-payment-dialog.tsx`, `src/components/customers/customers-workspace.tsx` and `customers-payment-dialog.tsx` are implemented. The `CustomerEditorDialog` exposes a manager-only professional selector and accepts `monthlyPrice`; employee submissions are forced to the actor by the canonical actor-aware service.

## Delivered behavior

- User administration persists integer service/product commission rates from 0 through 100. Owner rates are configurable; existing owners remain at zero until edited.
- The responsive user directory exposes every user's service and product commission percentages and supports editing them without retaining a leading zero while still rejecting empty or invalid values on submit.
- Block `020` adds catalog/charged-price snapshots plus a per-line override actor and reason. A line may be discounted, surcharged or set to zero, and the charged subtotal drives commission and barbershop net.
- Block `020` accepts integer basis-point payment allocations from employees (summing to 10000) and exact ARS amounts from managers. The server distributes the deterministic remainder to the last allocation; a zero-total manager sale is allowed only with no payment rows.
- Authenticated sessions hydrate both commission rates, so an employee loading `/incomes/new` receives the same persisted commission configuration used by manager-selected employees.
- `/incomes/new` enforces role-aware responsible employees: employees are forced to themselves; owner/admin may choose any active user, loading every result page rather than truncating the selector at 100 users.
- A sale accepts one or more distinct payment-method UUID allocations with positive integer amounts whose exact sum is validated against server-authoritative prices and total; responses retain immutable method-name snapshots.
- PostgreSQL snapshots service/product commission bases, configured rates, independently rounded amounts, total commission, barbershop net and the optional manager-authorized 100% service exception.
- Owner-attributed sales keep zero commission and the complete total as barbershop net; a future owner withdrawal belongs to cash/expenses rather than income commission.
- Income creation remains idempotent and atomic with catalog snapshots, stock, inventory movements, payments and customer visits. Semantic request conflicts are rejected, while an identical retry still succeeds after mutable responsible-user state changes. User, service, product and customer rows remain locked through each new sale so concurrent deactivation or demotion cannot invalidate its authority snapshot.
- `/incomes` scopes employees by responsible `employee_id`; owner/admin can view and filter all historical responsible users, including inactive and logically deleted accounts with retained sales. Metrics expose gross, commission, net, count, average and dynamic per-method totals while excluding voids.
- Income detail shows responsible employee, registering actor for managers, split payments, commission bases/rates/amounts, net and 100% authorizer. The confirmation flow shows the complete estimated sale before submission.
- `/customers` persists one optional ISO-weekday/local-time habitual schedule in the same transaction as customer create/update.
- The customer directory can combine text search and ordering with a fixed-schedule filter for all customers, habitual customers or customers without a habitual schedule.
- Schedule creation/reactivation/reprogramming generates idempotent occurrences through eight weeks. Versioned effective dates prevent historical fabrication; same-day reprogramming preserves today's prior appointment; reactivation starts today unless a preserved occurrence already exists; per-customer advisory locks and optimistic versions prevent deadlocks and lost updates.
- The `X visita(s)` controls open a responsive paginated modal backed by active income item snapshots. Its strict financial contract includes immutable visit total plus historical item unit price and subtotal; the dialog shows those ARS values while excluding user identities, payments, commissions and authorizations.
- Dashboard fixed customers now come from authorized persistence, not a fixture. Pending attendance may transition once to attended/missed; actor/time are audited, a concurrent second resolution conflicts, and attendance never creates a sale or visit.
- Product categories now have a server-only domain boundary with audited create/update records, atomic logical deactivation, normalized-name/in-use conflict mappings and active-only employee reads. Products carry complete category objects, use category UUIDs for mutations and filters, and managers have a dynamic category administration dialog.
- Migration `014_product_categories.sql` creates the secured canonical category catalog, seeds/backfills the four legacy categories, replaces `products.category` with `category_id`, and promotes category-locked product/category lifecycle RPCs with rollback-wrapped SQL acceptance checks.
- Category UI state keeps catalog product snapshots synchronized after category rename/reactivation/deactivation, editors never submit an inactive hidden category ID, and an in-use deactivation conflict disables that category's action until the manager closes the dialog and refreshes its state.
- Category administration now shows active records by default, moves inactive records into a separate recoverable view and requires explicit confirmation before physical deletion. Only categories with zero product references can be removed; referenced categories remain intact and receive guidance to deactivate them so catalog and historical links are preserved.
- Inicio requests fixed-customer occurrences only from the current Buenos Aires date through the current week's Saturday. Sunday is intentionally empty, no occurrence query is made, and the window rotates to the new Monday-through-Saturday week when that Monday begins.
- The fixture `src/data/fixed-customers.mock.json` and the nonexistent `/customers/fixed` navigation were removed.
- Owner commission handling is application-safe: owner creation, promotion and updates normalize both configured rates to zero; owner editor controls are fixed at zero; previews derive the responsible employee role and neutralize owner rates plus the 100% service preview override. User profile persistence now calls the canonical `update_user_profile` RPC.
- Income drafts now carry a strict boolean product exception per selected line. Only a manager attributing the sale to a different non-owner may see exception controls; switching to self or an owner clears service and every product flag, while employees receive no controls. Full product exceptions cover the complete selected quantity and may coexist across products and with a full-service exception.
- Changing or removing the selected service also clears its full-commission exception, so an invisible stale flag can never reach confirmation or submission. Product exception copy states explicitly that 100% covers the value of the complete line quantity.
- Commission previews calculate service and product lines independently. Persisted-income contracts require immutable commission snapshots inside the service and every product item, while the aggregate exposes exact commission total and barbershop net; confirmation and detail views render the itemized amounts without positional coupling.
- The persisted income and metrics types now mirror the strict response schemas: payments, registering actor, aggregate commission, gross total, commission total and barbershop net are mandatory. Income UI and dashboard consumers no longer fabricate legacy payment data or show pending-backend fallbacks.
- Migration `015_product_item_commissions.sql` backfills immutable service/product item snapshots with exact parent reconciliation, calculates new product lines independently, fingerprints strict product exception flags and promotes the sole canonical `create_income` RPC. It preserves category-first product locks, stock/payments/customer visits, scoped history and idempotent retries while removing `create_income_v2`.
- Canonical income idempotency dual-compares the exact pre-015 product fingerprint only when every newly required product exception flag is false. It preserves the historical audit hash, accepts a semantically identical cross-migration retry and still conflicts when any flag changes to true.
- Payment methods now have strict trimmed 1–80-character names, manager-only create/update/deactivate/delete operations, canonical lifecycle RPC adapters and stable duplicate/last-active/in-use conflicts. Authenticated catalog reads and detail lookup include inactive methods so historical payment filters and receipts keep their labels; absent IDs return the safe payment-method 404.
- `/api/payment-methods` authorizes catalog reads for every authenticated user and create mutations for managers. `/api/payment-methods/[id]` safely fetches active/inactive historical methods; manager `PATCH` handles rename/deactivation/reactivation, while `DELETE` permanently removes only unused methods. Route authorization occurs before body or path validation.
- The manager dialog shows active methods by default, moves deactivated methods into a separate recoverable view and requires an explicit destructive confirmation before deletion. A referenced method remains in place and receives guidance to deactivate it without losing history.
- `/incomes/new` loads only active payment methods and presents them as responsive rounded selection cards. A dynamic `Combinado` card opens the arbitrary multi-method allocation editor with distinct methods and exact remaining/excess feedback; single-method cards assign the full total. The history page loads active and inactive methods for stable filtering and manager lifecycle administration.
- Income list, mobile/detail and dashboard presentation render saved payment names dynamically; one allocation uses its snapshot name and multiple allocations use `Combinado (N medios)`. No UI or metric contract branches on fixed cash/transfer values.
- `/cash` is manager-only and read-only. Today's Buenos Aires business date is calculated live; the workspace shows gross sales, commissions, barbershop net, service/product totals, dynamic payment allocations and sale-level audit with the existing income detail sheet.
- Prior activity dates are selectable from a paginated history. Empty days are omitted. There is no cash opening, closing or CRUD control, and the only creation shortcut reuses `/incomes/new`.
- The payment-method breakdown receives a desktop-only `3.75rem` top offset so its card aligns with the sales table below the audit heading; mobile keeps the original zero-offset stacked flow.
- The desktop offset now comes from the explicit `.cash-payment-column` media rule instead of a Tailwind arbitrary responsive utility, preventing development CSS regeneration from dropping the alignment while preserving the mobile stack.
- Migration `018` materializes immutable daily registers plus sale/payment snapshots. Same-day voids are excluded at close; later voids preserve the original register and create one negative, actor-linked adjustment on the local void date. An hourly idempotent `pg_cron` job closes any missing prior activity date.
- `/incomes` now exposes only its authoritative server-backed paginator. The nested TanStack paginator was removed from `IncomeTable`, so desktop and mobile share one page state and one API request path.
- Employee work-session persistence now enforces one open session per employee, permits later same-day sessions, rejects employee-created sales without their own open session and links manager-created employee sales to an open session or marks them explicitly outside-session. Active linked incomes drive exact per-session production; voided incomes are excluded, and employee JSON omits gross/net keys rather than hiding them in the UI.
- Manager work-session corrections compare the required visible `updatedAt` version under lock, then append immutable prior/new timestamps and a required reason before updating the session. Stale correction-versus-end and correction-versus-correction attempts return `WORK_SESSION_CONFLICT` without reopening or overwriting. The strict server adapter calls only the five canonical RPCs, parses role-specific JSON and maps lifecycle/range/linkage sentinels to stable application errors.
- `/api/work-sessions` authorizes before parsing manager filters and delegates employee self-scoping to the service. Authenticated employee endpoints expose current, start and end without accepting browser-controlled clock timestamps; manager corrections authorize before resolving the awaited dynamic ID or parsing the strict payload. The browser sends only the visible session version for optimistic concurrency, uses `cache: "no-store"` throughout and Zod-parses every successful payload according to the viewer role.
- The authenticated layout renders the employee-only persistent clock; `/work-sessions` provides responsive employee history and manager filters, page metrics and audited corrections. Before loading income catalogs or the editor, `/incomes/new` blocks an employee without an open session and offers a Presentismo CTA; managers bypass that guard.

## SQL and deployment state

- `supabase/queries/010_income_commissions_and_split_payments.sql` contains user commission columns/RPC, income registrant/responsible separation with immutable role snapshots, normalized bigint payments, overflow-safe immutable commission snapshots, locked catalog authorization and a manager-only historical-responsible projection.
- `supabase/queries/011_customer_visits_and_fixed_schedules.sql` contains effective-dated weekly schedules, per-customer serialized occurrence generation/resolution, optimistic schedule concurrency, transactional customer V2 functions and sanitized visit projection.
- `supabase/queries/012_owner_commission_invariant.sql` enforces owner-zero commission rates and snapshots on users and incomes tables.
- `supabase/queries/013_customer_visit_financials.sql` promotes the schedule-aware customer RPCs to canonical `create_customer`/`update_customer` names and exposes only active-sale totals plus immutable item prices/subtotals in paginated visit history.
- `supabase/queries/014_product_categories.sql` provides the canonical audited category catalog, UUID product foreign key, safe manager-only deactivation and category-first product mutation locks.
- `supabase/queries/016_payment_methods.sql` provides the dynamic payment-methods catalog, UUID foreign keys, payment method metrics, generalized `create_income` / `list_incomes` RPCs, idempotent compatibility repairs and serialized manager lifecycle functions. Its delete RPC protects the final active method and rejects referenced methods before physical deletion.
- `supabase/queries/017_product_category_deletion.sql` incrementally replaces the unconditional category-delete trigger with a manager-only RPC that deletes only categories without product references.
- `supabase/queries/018_automatic_daily_cash.sql` installs secured closure/snapshot/adjustment tables, the post-close void trigger, `close_pending_daily_cash`, `get_daily_cash`, `list_daily_cash` and the hourly recovery cron job.
- `supabase/queries/019_employee_work_sessions.sql` installs secured work-session/correction tables, five canonical RPCs and the before-insert income attachment trigger without rewriting `create_income` or Caja semantics.
- `supabase/queries/README.md` documents ordered installation `001` through `019`, including rollback-wrapped work-session lifecycle, correction, income-linkage and void-excluded metric acceptance.
- The user confirmed the configured project is functional for payment-method deletion, category deletion and automatic Caja after applying the corresponding migrations through `018`.
- Migration `019` has not been applied to the configured Supabase project; this task intentionally produced local SQL, structural tests and documented rollback acceptance only.

## Verification

- Last full suite before Fix Round 1: 127 test files / 468 tests passed.
- Fix Round 1 focused coverage: 15 test files / 60 tests passed, including service exception reset on deselect/change, singular/plural whole-line product copy and a manager-to-other-employee submission combining full service plus two full product lines.
- The Tasks 1–3 focused groups passed with 22 domain/contract tests, 18 repository/service/client tests and 29 UI tests. Task 4 now has five migration/type contract checks; Fix Round 1 passed the focused income slice with 13 files / 66 tests.
- ESLint passed with no warnings.
- Next.js 16.3 production build passed, including all new API routes.
- TypeScript and `git diff --check` passed.
- Local runtime was Node 24.17/npm 11.13; repository target remains Node 24.18/npm 11.16.
- The workweek correction also has 15 focused passing tests covering calendar boundaries, server query scope and card behavior.
- Payment-method Task 1 passed 4 focused files / 14 tests, TypeScript and `git diff --check`; its prior full suite passed 131 files / 481 tests.
- Payment-method Task 2 passed 2 focused route files / 11 tests, TypeScript and `git diff --check`; the full suite passed 133 files / 494 tests.
- Payment-method Tasks 3–5 passed their RED/GREEN contract, UI and presentation groups; the combined affected-domain slice passed 46 files / 176 tests.
- After Tasks 3–5, the full suite passed 134 files / 504 tests, ESLint passed with no warnings, TypeScript and `git diff --check` passed, and the Next.js 16.3 production build completed successfully.
- After restoring the card-based payment selector, the focused selector/form slice passed 2 files / 18 tests and the full suite passed 134 files / 510 tests. ESLint passed with no warnings, `git diff --check` passed, the Next.js 16.3 webpack production build succeeded and desktop/mobile browser validation found no console errors or layout overflow.
- Safe payment-method deletion passed the complete affected slice with 10 files / 46 tests and the full repository suite with 136 files / 522 tests. ESLint, TypeScript, `git diff --check` and the Next.js 16.3 webpack production build passed. Authenticated browser validation covered active/inactive navigation and named confirmation; at 390×844 both nested dialogs matched their 358px available width with no document overflow or console errors.
- Payment-method administration no longer places full-width inputs or method identity in competition with long horizontal actions. The create flow is vertically stable and each method is an independent card with a persistent name, colored state badge and compact edit/lifecycle/delete row. Authenticated validation at 1280×720 and 390×844 showed every label/action, zero document or dialog overflow and no browser warnings/errors; the inactive view remains equally readable and reactivation stays visually primary.
- Product-category deletion passed 6 focused domain/API files with 22 tests and the affected product/category UI slice with 13 files and 50 tests. ESLint and `git diff --check` passed before the final repository-wide verification.
- Final verification after category lifecycle and responsive UI polish passed 138 test files / 531 tests, ESLint, generated route types, standalone TypeScript, `git diff --check` and the Next.js 16.3 Webpack production build. Authenticated browser checks at the default desktop viewport and 390×844 confirmed readable active-category cards, compact actions and the named nested deletion confirmation without horizontal overflow.
- Category cards received a density correction after real-device feedback: creation and active/inactive navigation share horizontal space when available, while each category keeps edit, lifecycle and delete in one explicit flex action group. The affected product slice passed 7 files / 29 tests, ESLint, TypeScript and the Webpack production build; authenticated desktop and 390×844 checks confirmed the cards no longer stack their controls or waste vertical space.
- Payment-method administration is intentionally contextual to `/incomes`: the redundant non-navigating `Medios de pago` sidebar placeholder was removed for managers, while the manager-only modal, income link, API and lifecycle behavior remain unchanged. The user confirmed unused deletion works against Supabase.
- The migration `016` product-availability regression reproduced as a failing structural test and passed after projecting `p.is_active` into the locked product record consumed by `create_income`.
- A controlled RPC probe confirmed the installed function passes product availability validation; a read-only schema probe isolated its remaining `42703` to the missing `incomes.responsible_role_snapshot` column. The migration contract now requires both fresh installation in `010` and idempotent repair/backfill in `016`.
- After the responsible-role repair, the migration regression test passed its red/green cycle, the complete Vitest suite exited successfully, ESLint reported no errors, `git diff --check` passed and the Next.js 16.3 webpack production build completed successfully.
- End-to-end database probing then verified every column consumed by the sale transaction and traversed all validations preceding the first write. A controlled service-only sale isolated the next failure to PostgreSQL `23502`: dynamic payments omit the superseded `income_payments.method`, while the installed legacy column still required a value. PostgreSQL rolled the diagnostic transaction back completely. Migration `016` now drops only that legacy `NOT NULL` requirement before installing the dynamic RPC.
- Automatic Caja final verification passed 150 test files / 559 tests, ESLint, Next.js route type generation, standalone TypeScript, `git diff --check` and the Next.js 16.3 Webpack production build. Its rollback-wrapped SQL acceptance block remains documented for isolated validation; this task did not apply the migration to the shared database.
- Income pagination deduplication passed its red/green regression cycle, 2 focused files / 9 tests, the complete suite with 150 files / 560 tests, ESLint and the Next.js 16.3 Webpack production build. Browser validation at the default desktop viewport and 390×844 confirmed exactly one page label and one previous/next control, working navigation to page two, no horizontal overflow and no browser errors or warnings. The repository audit found no nested paginator in users, cash history or customer visit history.
- Cash payment-card alignment passed its red/green component test, the complete suite with 150 files / 561 tests, ESLint, `git diff --check` and the Next.js 16.3 Webpack production build. Browser measurement reported a `0px` desktop top-edge difference between sales table and payment card; at 390×844 the computed offset remained `0px`, document width stayed at 390px and no browser errors or warnings appeared.
- Work-session Task 2 plus Fix Round 1 passed their RED/GREEN cycles and final focused group with 3 files / 20 tests. The complete repository suite passed with 154 files / 588 tests; ESLint, Next.js route type generation, standalone TypeScript, `git diff --check` and the Next.js 16.3 Turbopack production build all exited successfully. Migration `019` explicitly removes any inherited `service_role` DML before granting table reads. SQL acceptance remains rollback-wrapped and documented rather than applied to a remote database.
- Work-session Task 3 first failed RED because its six new test suites imported the intentionally absent API/client modules. After the minimal implementation, its focused slice passed 6 files / 13 tests; Next.js route type generation, TypeScript and `git diff --check` passed. Final verification passed 160 files / 601 tests, ESLint and the Next.js 16.3 Turbopack production build; no remote SQL was applied.
- Work-session Task 4 plus its two fix rounds passed focused component/page slices and final verification with 164 files / 624 tests, ESLint, Next.js type generation, standalone TypeScript, `git diff --check` and the Next.js 16.3 Turbopack build.
- Work-session Task 5 documentation verification passed `npm test` (164 files / 624 tests), ESLint, Next.js type generation, standalone TypeScript, `git diff --check` and the Next.js 16.3 Webpack production build. The documented Supabase acceptance remains unexecuted.
- Block `020` final verification passed `npm test` (165 files / 682 tests), ESLint, Next.js route type generation, standalone TypeScript, `git diff --check` and the Next.js 16.3 Webpack production build. The documented Supabase acceptance scenarios for charged-price overrides, basis-point payments, zero-total manager sales, employee sanitized projection and configurable owner commission remain unexecuted locally because no remote database was touched.
- Block `021` final verification passed `npm test` (172 files / 736 tests), ESLint with zero warnings, Next.js 16.3 route type generation, standalone TypeScript, `git diff --check` and the Next.js 16.3 Webpack production build. The documented Supabase acceptance — `LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED` preflight, manager/employee payment modes, employee session requirement, owner/employee rates, reassignment-before-collection, duplicate/retry, void/re-pay, cash totals and unchanged visits — remains unexecuted locally because no remote database was touched.

## Known boundaries

- SQL behavior is structurally covered by strict RPC/migration adapter tests and documented executable SQL acceptance blocks. The user reports the configured project is functional through the `018` feature set; future schema changes must continue through ordered manual migrations.
- Sale editing, expenses, counted-versus-expected cash reconciliation and reporting remain outside this milestone. Daily Caja and automatic historical closure are now implemented locally. Physical deletion remains intentionally limited to unused payment methods and product categories with zero product references; product records, services, customers and users retain their existing lifecycle rules.
- The application and migration now share canonical `create_income` with per-product exception flags; migration `015` must be installed after `014` before this application slice can be deployed safely.
- A dedicated fixed-customer management route is not part of this increment; scheduling remains in the shared customer create/edit modal.
- The latest `016_payment_methods.sql` includes the legacy `income_payments.method` compatibility repair used by the functioning dynamic payment flow.
- The approved roadmap intentionally supersedes two current rules only when its matching SQL and application blocks are installed: block `020` makes owner commission configurable with charged-price overrides, and `022` evolves Caja with manual open/close/confirm. Both blocks are implemented locally and await their remote migrations; until installed, owner rates remain forced to zero by `012` and Caja stays at its `018` automatic baseline.
- Block `020` employee-safe financial projections and basis-point payment entry are wired through the repository and route handler, but the income entry/history/dashboard components still render with the manager shape. Full employee sanitization at the UI boundary is a follow-up that does not require another database migration.
- Migration `020` materializes the `income_as_employee_json` projection, the `get_income_detail` viewer-dispatching RPC and the rewritten `list_incomes` RPC. The SQL is structurally covered by the migration test; real-Supabase acceptance remains unexecuted.
- Historical manager filter coverage for employees later promoted to a manager role remains outside the current catalog contract. Excluding logically deleted users follows the existing lifecycle ruling; this final-fix round intentionally does not change either historical-filter boundary.

## Recommended next task

Blocks `019`, `020`, `021`, `022` and `023` are implemented locally and the entire operational-control roadmap is ready for remote deployment. Apply migration `019`, then `020`, `021`, `022` and `023` in order, running each rollback-wrapped acceptance block before moving on. The pending preflight for migration `021` (legacy fixed schedules) and migration `022` (exactly one normalized payment method named `Efectivo`) must succeed against the configured Supabase project before applying the script; if either aborts, resolve the legacy data and rerun. Once all five migrations are applied, push the cumulative commits and validate the manager and employee flows end to end on `/cash`, `/incomes`, `/customers` and `/work-sessions`. No remote database mutation was performed by this worktree.

## Context maintenance rule

Update this file after every completed task with the active branch, delivered behavior, unresolved external actions, known boundaries and the single best next task. Update `product.md` whenever scope, module status or objectives change; update `AGENTS.md` only when durable architecture or workflow changes.

## Fresh final verification — block 021

- Current branch test suite: 172 files / 736 tests passed.
- ESLint passed with zero warnings; Next.js 16.3 route type generation, standalone TypeScript and `git diff --check` all passed.
- The Next.js 16.3 Webpack production build completed successfully and `/api/fixed-customer-months` (list, pay, get) routes are emitted alongside the existing API surface.
- Migration `021` and its rollback-wrapped SQL acceptance remain unapplied locally/remotely by this task, as intended. The preflight query documented in the README must be executed against the configured Supabase project before applying the script; `LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED` will abort if any active schedule still lacks `responsible_user_id` or `monthly_price`.

## Fresh final verification — blocks 022 and 023

- Current branch test suite: 179 files / 770 tests passed (count after block 022 manual reconciliation workspace + block 023 last-visit column).
- ESLint passed with zero warnings; Next.js 16.3 route type generation, standalone TypeScript, `git diff --check` and the Next.js 16.3 Webpack production build all completed successfully.
- `/api/cash/open`, `/api/cash/close` and `/api/cash/[id]/confirm` routes are emitted alongside the existing `/api/cash` surface; the cash client exposes `open`, `close` and `confirm` mutations and the `/cash` workspace renders three dialogs with `Abrir caja`, `Cerrar caja` and `Confirmar conteo`.
- `/api/customers` continues to serve the canonical `list_customers` projection that derives each customer's `lastVisitBusinessDate` from the latest active normal sale; the customer directory renders the new "Última visita" column with `formatLastVisit` (date label + relative label).
- Migrations `022` and `023` and their rollback-wrapped SQL acceptance remain unapplied locally/remotely by this task, as intended. The `022` preflight requires exactly one normalized payment method named `Efectivo` (`CASH_PAYMENT_METHOD_REQUIRED`) and the `021` preflight requires every active fixed schedule to carry `responsible_user_id` and a positive `monthly_price` (`LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED`). Apply `019` → `020` → `021` → `022` → `023` in order, running each rollback block before moving on.
