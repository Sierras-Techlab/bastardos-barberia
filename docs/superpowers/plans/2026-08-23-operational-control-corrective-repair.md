# Operational Control Corrective Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the remaining cross-layer failures in blocks 020–023 so employee incomes, fixed-customer monthly payments, Caja and customer last-visit behavior work against a real PostgreSQL database, not only mocked or structural tests.

**Architecture:** Keep the existing canonical migrations and object names because this project has not shipped to production; do not introduce `_v2` tables, RPCs or compatibility layers. Repair each block in dependency order, make browser contracts discriminated by viewer role, and make PostgreSQL the authority for prices, commissions, payment allocation, work-session linkage and cash reconciliation. A block is complete only after focused tests, the whole application suite and executable database acceptance pass.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Zod, Supabase PostgreSQL, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-21-operational-control-and-employee-privacy-design.md`

## Global Constraints

- Read `AGENTS.md`, `context_snapshot.md`, `product.md`, the approved spec and the original plans for blocks 020–023 before editing.
- Inspect the relevant Next.js 16 guides under `node_modules/next/dist/docs/` before changing pages or Route Handlers.
- Do not apply migrations 020–023 to the shared test database until Tasks 1–6 of this plan pass locally and the SQL has been reviewed.
- Do not add `_v2` objects. Migrations 020–023 are not deployed and may be corrected in place.
- All monetary values are integer ARS. Never divide or multiply business amounts by 100.
- Managers submit exact ARS payment amounts. Employees submit integer basis points totaling exactly `10000`.
- Employee browser payloads must not contain catalog price, charged price, gross total, payments, barbershop net or registrant identity.
- Commission is calculated from the actual charged amount. Database values remain authoritative.
- Only the payment method with `system_code = 'cash'` affects physical cash.
- Preserve the canonical `void_income` behavior and its audit/stock semantics.
- Each task follows RED → GREEN → focused verification → review → commit. Do not weaken Zod schemas or cast incompatible role projections.

---

### Task 1: Repair role-safe income entry and employee privacy

**Files:**
- Modify: `src/types/income.ts`
- Modify: `src/lib/incomes/income-schema.ts`
- Modify: `src/app/(dashboard)/incomes/new/page.tsx`
- Modify: `src/components/incomes/income-form.tsx`
- Modify: `src/components/incomes/payment-method-selector.tsx`
- Modify: `src/components/incomes/income-summary.tsx`
- Modify: `src/components/incomes/commission-preview.tsx`
- Modify: `src/components/incomes/income-confirmation-dialog.tsx`
- Test: `src/components/incomes/role-safety.test.tsx`
- Test: `src/components/incomes/income-form.test.tsx`
- Test: `src/app/(dashboard)/incomes/new/page.test.tsx`

**Interfaces:**
- Consumes: authenticated role, active catalog rows and user commission rates.
- Produces: `ManagerIncomeFormData | EmployeeIncomeFormData` discriminated by `viewer`; manager submissions use `amount`, employee submissions use `basisPoints`.

- [ ] **Step 1: Write failing role-boundary tests**

  Add tests proving that serialized employee form data contains only `{ id, name, earning }` for services and `{ id, name, earning, stock }` for products. Assert recursively that none of these keys exist in the employee payload: `price`, `catalogUnitPrice`, `chargedUnitPrice`, `total`, `payments`, `barbershopNet`, `registeredBy`.

  Add an employee submission test that selects one payment method and expects:

  ```ts
  payments: [{ paymentMethodId: cashId, basisPoints: 10000 }]
  ```

  Add a combined employee payment test expecting `6000 + 4000`, and a manager test expecting exact ARS amounts. Add manager tests for a discounted line, a surcharge, a zero-priced line with a required reason, and a zero-total sale with `payments: []`.

- [ ] **Step 2: Run the RED slice**

  Run:

  ```bash
  npm test -- --run src/components/incomes/role-safety.test.tsx src/components/incomes/income-form.test.tsx "src/app/(dashboard)/incomes/new/page.test.tsx"
  ```

  Expected: failures showing employee catalog prices, amount-based employee payments, absent override payloads and rejection of zero-total manager sales.

- [ ] **Step 3: Split form contracts by role**

  Replace the broad `IncomeFormData` shape with a discriminated union equivalent to:

  ```ts
  type EmployeeCatalogService = { id: string; name: string; earning: number };
  type EmployeeCatalogProduct = { id: string; name: string; earning: number; stock: number };
  type ManagerIncomeFormData = { viewer: "manager"; services: Service[]; products: Product[]; /* shared fields */ };
  type EmployeeIncomeFormData = { viewer: "employee"; services: EmployeeCatalogService[]; products: EmployeeCatalogProduct[]; /* shared fields */ };
  type IncomeFormData = ManagerIncomeFormData | EmployeeIncomeFormData;
  ```

  The server page may calculate the employee-visible earning preview from the authenticated user's configured percentage, but it must not serialize the underlying catalog price. Keep final calculation authoritative in PostgreSQL.

- [ ] **Step 4: Use the correct schema and selector for each role**

  In `IncomeForm`, select `managerIncomeFormSchema` or `employeeIncomeFormSchema` from `data.viewer`. Make the payment selector accept a discriminated prop:

  ```ts
  | { mode: "manager"; payments: Array<{ paymentMethodId: string; amount: number }>; total: number }
  | { mode: "employee"; payments: Array<{ paymentMethodId: string; basisPoints: number }> }
  ```

  Managers see integer ARS inputs and exact remaining/excess amounts. Employees see percentages derived from basis points, never the sale total. A single employee method defaults to `10000`; combined methods must sum to `10000`.

- [ ] **Step 5: Wire charged-price overrides completely**

  Render the existing line-price editor only for managers. Store `servicePriceOverride` and `productPriceOverrides` in form state and include them in `CreateIncomeInput`. Require a trimmed reason whenever charged price differs from catalog price. Clear an override when its line is removed or replaced.

  Permit a manager total of zero only when every charged subtotal is valid and `payments` is empty. For positive totals, require exact manager allocations.

- [ ] **Step 6: Sanitize previews and confirmation**

  Manager review shows catalog value, charged value, signed adjustment, commission and barbershop net. Employee review shows concepts and their own estimated earning only. Remove the mobile `Total actual` block for employees and ensure item rows do not render hidden catalog prices.

- [ ] **Step 7: Run GREEN and commit**

  Run the RED slice again, then:

  ```bash
  npx tsc --noEmit
  git diff --check
  ```

  Commit:

  ```bash
  git add src/types/income.ts src/lib/incomes src/app/(dashboard)/incomes/new src/components/incomes
  git commit -m "fix(incomes): enforce role-safe entry contracts"
  ```

---

### Task 2: Repair income history and dashboard projections

**Files:**
- Modify: `src/types/income.ts`
- Modify: `src/lib/incomes/client.ts`
- Modify: `src/app/(dashboard)/incomes/page.tsx`
- Modify: `src/app/(dashboard)/(home)/page.tsx`
- Modify: `src/components/incomes/incomes-view.tsx`
- Modify: `src/components/incomes/income-table.tsx`
- Modify: `src/components/incomes/income-mobile-list.tsx`
- Modify: `src/components/incomes/income-detail-sheet.tsx`
- Modify: `src/components/dashboard/income-summary-card.tsx`
- Test: corresponding component, page and client tests.

**Interfaces:**
- Consumes: strict manager or employee projection returned by `list_incomes` and `get_income_detail`.
- Produces: role-specific history and dashboard UI without `as never`, double casts or post-parse key stripping.

- [ ] **Step 1: Add failing employee projection tests**

  Test a non-empty employee list and detail with only:

  ```ts
  {
    id,
    createdAt,
    businessDate,
    employee,
    customer,
    concepts: [{ type, name, quantity, earning }],
    employeeCommission,
    status
  }
  ```

  Assert the page renders the concepts and employee earning without crashing. Assert gross, average ticket, payment totals, barbershop net, registrant and void action are absent. Add a dashboard test where `employeeCommissionTotal = 10000` and expect `$ 10.000`, not zero and not “Tu facturación”.

- [ ] **Step 2: Remove manager-shape casts**

  Define `ManagerPaginatedIncomes` and `EmployeePaginatedIncomes` as separate types. Parse API success envelopes with the schema selected from the authenticated viewer role. Render a manager view or employee view explicitly; never cast the employee result into manager data.

- [ ] **Step 3: Correct dashboard aggregation**

  Remove the filter that discards objects containing `employeeCommission`. The employee dashboard must consume the employee metric returned by PostgreSQL and label it “Tu ingreso” or “Lo generado para vos”. Manager cards retain gross, commission, net and dynamic payment breakdown.

- [ ] **Step 4: Verify and commit**

  Run focused history/dashboard/client tests, `npx tsc --noEmit`, `git diff --check`, then commit:

  ```bash
  git commit -am "fix(incomes): render role-specific history and metrics"
  ```

---

### Task 3: Rebuild migration 021 and the monthly-payment boundary

**Files:**
- Modify: `supabase/queries/021_fixed_customer_monthly_payments.sql`
- Modify: `src/lib/fixed-customer-payments/client.ts`
- Modify: `src/lib/fixed-customer-payments/schemas.ts`
- Modify: `src/lib/fixed-customer-payments/repository.ts`
- Modify: `src/components/customers/customer-editor-dialog.tsx`
- Modify: `src/components/fixed-customers/fixed-customer-payment-dialog.tsx`
- Modify: related migration, repository, client, dialog and route tests.

**Interfaces:**
- Consumes: migration 020 canonical incomes and existing fixed schedules.
- Produces: one active monthly attempt per customer/period, role-safe projections and immutable income snapshots.

- [ ] **Step 1: Add RED tests for the real defects**

  Migration tests must assert that the attempts table defines `status`, its check constraint and a partial unique index for active `(customer_id, period)`. Assert no `uuid::jsonb`, no JWT `current_setting`, no call to a 022-only helper, and no replacement of canonical `void_income` with a reduced implementation.

  Client tests must mock actual envelopes such as `{ data: { items: [] } }` and `{ error: { code, message } }`. Amount tests must assert `15000` remains `15000` through editor → API input.

- [ ] **Step 2: Correct the attempts schema**

  Define `status text not null default 'active' check (status in ('active','voided'))`, keep `voided_at`/`voided_by`, and add a partial unique index:

  ```sql
  create unique index fixed_payment_attempts_one_active_period
    on public.fixed_customer_monthly_payment_attempts(customer_id, period)
    where status = 'active';
  ```

  Preserve request idempotency without deleting old attempts. Do not invent responsible professionals during backfill; abort with the documented preflight when an active schedule lacks a valid responsible user or positive monthly price.

- [ ] **Step 3: Correct `pay_fixed_customer_month`**

  Remove the call to `ensure_daily_cash_open`; migration 021 must work directly after 020. Migration 022 will add universal first-income opening.

  Lock the schedule, customer, responsible user, payment methods and active attempt key. Select the role snapshot as the canonical text role (`owner`, `admin`, `employee`), not the numeric role id. Store a hexadecimal fingerprint with `encode(extensions.digest(...), 'hex')` if the target column is text.

  Validate distinct active payment-method UUIDs. Manager amounts must be positive integers totaling `monthly_price`; employee basis points must be non-negative integers totaling `10000`, and the deterministic allocation must never insert a zero `income_payments.amount` row.

- [ ] **Step 4: Correct role-safe list/get projections**

  Pass `actor_user_id` explicitly into the JSON projection; do not infer the viewer from JWT settings. Join `incomes` to read `commission_total`; never cast an income UUID to JSON.

  Manager objects include `monthlyPrice`; employee objects include `employeeEarning` and omit `monthlyPrice` and barbershop net. `get_fixed_customer_month` must synthesize a pending object from the active schedule when no attempt exists, so the first payment dialog can open.

- [ ] **Step 5: Preserve canonical voiding**

  Do not replace `void_income` with a shortened function. Prefer an `AFTER UPDATE OF status` trigger that marks the linked active attempt voided when the canonical income becomes voided. This retains all existing void audit, inventory and post-close Caja behavior.

- [ ] **Step 6: Correct browser envelopes and ARS units**

  Parse `{ data: { items } }`, `{ data: { month } }` and `{ error: { code, message, fields } }` with strict Zod schemas. Remove every `/ 100` and `* 100` conversion from customer monthly price and payment dialogs. Inputs use integer ARS (`step="1"`).

- [ ] **Step 7: Verify and commit**

  Run all 021-focused tests plus TypeScript and diff checks. Commit:

  ```bash
  git commit -am "fix(subscriptions): rebuild monthly payment contract"
  ```

---

### Task 4: Rebuild migration 022 around the existing 018 cash snapshots

**Files:**
- Modify: `supabase/queries/022_manual_cash_lifecycle.sql`
- Modify: `src/lib/cash/schemas.ts`
- Modify: `src/lib/cash/repository.ts` only if the canonical RPC response signatures change.
- Modify: `src/components/cash/cash-view.tsx`
- Modify: `src/components/cash/cash-close-dialog.tsx`
- Modify: `src/components/cash/cash-confirm-dialog.tsx`
- Test: all migration, repository, schema, API and cash component tests.

**Interfaces:**
- Consumes: 018 snapshot tables, 020/021 incomes and 016 payment methods.
- Produces: manual open/close/confirm, automatic first-income open and automatic pending closure, with physical cash based only on `system_code='cash'`.

- [x] **Step 1: Add RED migration-order and lifecycle tests**

  Tests must verify textual order: add `payment_methods.system_code`, backfill normalized Efectivo, then assert exactly one cash method. Assert 022 drops the old `closed_at NOT NULL/default` behavior and replaces the `daily_cash_counts_check` that rejects an empty opened register.

  Assert no `$4` references exist in three-argument RPCs. Assert 022 replaces `get_daily_cash`, `list_daily_cash` and the canonical JSON projection, not only adds an incompatible overload. Assert normal sales and subscriptions both trigger first-income opening.

- [x] **Step 2: Make open register rows structurally valid**

  Alter `closed_at` to drop `NOT NULL` and its automatic default. Drop/recreate the 018 count constraint so an open register with zero sales is valid. Add lifecycle checks equivalent to:

  - open: `closed_at is null`, `close_mode is null`, `reconciliation_state='not_applicable'`, no count/difference;
  - manually closed: `closed_at is not null`, `close_mode='manual'`, counted/difference present, state `confirmed` even when difference is non-zero;
  - automatically closed: `close_mode='automatic'`, initially `pending_confirmation`; confirmation stores counted/difference without recomputing financial snapshots.

- [x] **Step 3: Protect Efectivo in the correct order**

  Add `system_code` first, assign `'cash'` to exactly one normalized Efectivo row, then run the preflight and create the unique partial index. Protect that row by `system_code`, not by its mutable display name.

- [x] **Step 4: Implement universal automatic opening**

  Install a security-definer `AFTER INSERT` income trigger that calls `ensure_daily_cash_open(NEW.registered_by, NEW.business_date)`. This covers ordinary sales and fixed subscriptions without duplicating calls in two creation RPCs. The helper inserts a zero-opening live register under the business-date advisory lock and is idempotent.

- [x] **Step 5: Calculate expected physical cash correctly**

  Use:

  ```text
  expectedCash = openingBalance
               + active income payments whose method has system_code='cash'
               + cash-method post-close adjustments applicable to the day
  ```

  Transfer, QR and any other dynamic method must never affect expected physical cash. Gross, commission and barbershop net remain separate financial metrics.

- [x] **Step 6: Promote canonical read/close functions**

  `get_daily_cash(today)` must return a synthetic unopened day when no register exists, or a live day with the real register id after opening. `list_daily_cash` returns only closed history with lifecycle included. Update the Zod lifecycle rule to allow a live opened day with a non-null id.

  Manual close always snapshots active sales/payments, stores counted/difference, closes and confirms—even with shortage or surplus. Automatic close snapshots previous open days and leaves them pending. Confirm changes only reconciliation fields and never recalculates totals. Replace `$3/$4` assignments with named PL/pgSQL variables.

  Preserve same-day void exclusion and post-close negative adjustment behavior. Extend snapshot kind checks/mapping to `fixed_subscription` as `subscription`.

- [x] **Step 7: Correct Caja UI semantics**

  An opened live register always shows “Cerrar caja”. Manual close success must say it was closed and confirmed; only automatic closures show “Pendiente de confirmación” and the confirm action. Opening balance is displayed separately and never as an income.

- [x] **Step 8: Verify locally; PostgreSQL acceptance remains Task 6**

  Run every cash migration/schema/repository/API/component test, then TypeScript and diff checks. Commit:

  ```bash
  git commit -am "fix(cash): rebuild canonical manual lifecycle"
  ```

---

### Task 5: Verify and preserve customer last-visit behavior

**Files:**
- Review/modify if required: `supabase/queries/023_customer_last_visit.sql`
- Test: `src/lib/customers/migration-023.test.ts`
- Test: customer repository/service/component tests.

**Interfaces:**
- Consumes: active `source_type='sale'` incomes.
- Produces: nullable `lastVisitBusinessDate` derived from the latest qualifying sale.

- [ ] **Step 1: Add behavioral regression cases**

  Cover no visits, one active sale, newer voided sale revealing the prior active sale, fixed subscription exclusion, and Buenos Aires business-date ordering. Ensure `list_customers` retains the complete existing customer/fixed-schedule projection.

- [ ] **Step 2: Run focused tests and correct only verified defects**

  Do not store a mutable last-visit column. Keep the partial index and query-derived projection. If 023 is already correct, make no production change and record the evidence.

- [ ] **Step 3: Commit only if production or test files changed**

  Use `fix(customers): preserve qualifying last visit` if a commit is required.

---

### Task 6: Execute real PostgreSQL acceptance before deployment

**Files:**
- Modify: `supabase/queries/README.md`
- Add or update rollback-wrapped acceptance sections in migrations 020–023.
- Test: the disposable/test Supabase database, never production.

**Interfaces:**
- Consumes: clean ordered migrations 001–023.
- Produces: evidence that SQL compiles and cross-module behavior works transactionally.

- [ ] **Step 1: Prove a clean installation**

  Apply 001 through 023 in order to an empty disposable database. Every script must complete without editing the database manually between scripts, except documented seed/preflight data. Confirm PostgREST can resolve every RPC signature.

- [ ] **Step 2: Run role and income scenarios**

  Seed owner, admin and employee; configure non-zero owner and employee commission; open the employee's work session. Verify manager discount/surcharge/zero-total sales, employee basis-point split, database-derived charged totals, owner commission and employee privacy at RPC/API payload level.

- [ ] **Step 3: Run monthly-payment scenarios**

  Verify pending month retrieval, manager payment, employee payment with an open session, duplicate conflict, idempotent retry, void reopening and re-payment. Confirm subscription affects income/dashboard/Caja but not visits or last visit.

- [ ] **Step 4: Run Caja scenarios**

  Verify manual open at `0`, manual open at `10000`, first-income auto-open, and a split sale where only Efectivo changes expected cash. Verify a manual close with exact count and another with a non-zero difference both close as confirmed. Verify automatic prior-day close is pending and confirmation does not change frozen financial totals.

- [ ] **Step 5: Run privacy probes**

  Capture employee responses for `/api/incomes`, income detail, dashboard, work sessions and fixed-customer months. Recursively fail if any forbidden key appears. Confirm managers still receive the full audit projection.

- [ ] **Step 6: Record evidence**

  Save exact commands/SQL, exit results and representative sanitized JSON in the README or task report. Structural regex tests are supporting checks only; they do not count as database acceptance.

---

### Task 7: Final verification and truthful documentation

**Files:**
- Modify: `AGENTS.md` only if the final architecture differs.
- Modify: `context_snapshot.md`
- Modify: `product.md`
- Modify: `docs/superpowers/plans/2026-08-22-operational-control-roadmap-status.md`
- Modify: `docs/superpowers/plans/2026-08-23-operational-control-stabilization.md` to mark it superseded.

**Interfaces:**
- Consumes: verified Tasks 1–6.
- Produces: a truthful deployment status and handoff.

- [ ] **Step 1: Run complete verification freshly**

  Run, in order:

  ```bash
  npx next typegen
  npx tsc --noEmit
  npm test
  npm run lint
  npm run build
  git diff --check
  ```

  Record actual counts and exit codes. Do not infer integrated correctness from mocked tests; include the Task 6 database evidence.

- [ ] **Step 2: Reconcile documentation**

  Remove claims that blocks are deployable before database acceptance. Correct `product.md` so owner commission is configurable, not permanently zero. Document the installed remote migration revision separately from the repository HEAD.

- [ ] **Step 3: Review the final diff**

  Confirm no credentials, `_v2` objects, broad casts, employee financial leakage, cents conversion or reduced canonical void function remain. Confirm every migration can be installed once on a clean schema in numerical order.

- [ ] **Step 4: Commit the verified handoff**

  ```bash
  git add AGENTS.md context_snapshot.md product.md docs/superpowers supabase/queries/README.md
  git commit -m "docs(operations): record verified stabilization rollout"
  ```

## Definition of done

- Employee sale entry sends basis points, never catalog prices, and successfully creates an authoritative income.
- Employee history/dashboard/detail show only their earning and sanitized concepts.
- Migration 021 installs and supports pending/pay/duplicate/retry/void/re-pay without invalid columns or casts.
- Migration 022 installs after 021; manual and automatic Caja states match the approved lifecycle.
- Expected physical cash uses only Efectivo plus opening balance and cash adjustments.
- Subscription payments enter the day's income and Caja without becoming customer visits.
- Last visit derives only from the latest active normal sale.
- Clean PostgreSQL installation and end-to-end manager/employee scenarios pass.
- Full tests, lint, TypeScript, build and diff checks pass after the final production change.
