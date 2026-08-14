# Commercial Supabase Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the complete commercial increment locally, apply migrations `012` through `016` safely to the configured Supabase project and reconcile live financial behavior by role.

**Architecture:** Treat local verification as a hard gate before remote mutation. Use the authenticated Supabase dashboard SQL Editor through the in-app browser when available, verify existing `010`/`011` state rather than blindly replaying it, then apply and validate one new transaction at a time.

**Tech Stack:** Vitest, ESLint, Next.js 16.3 production build, Supabase PostgreSQL SQL Editor and authenticated application smoke tests.

## Global Constraints

- Consume migrations `010` through `016` and the acceptance blocks in `supabase/queries/README.md`.
- Remote SQL execution is explicitly authorized for this scope only.
- Never print or paste `.env` secrets into conversation or tracked files.
- Do not proceed past a failed migration or acceptance block.
- Do not claim a migration is applied without reading successful remote output.
- Do not push or create a PR unless separately requested.

---

### Task 1: Run the complete local gate

**Files:**

- Verify: complete repository tree.
- Modify only if a gate exposes an in-scope defect.

**Interfaces:**

- Consumes: final canonical application and SQL contracts.
- Produces: green local evidence before database mutation.

- [ ] **Step 1: Run focused commercial tests**

```bash
npm test -- --run src/lib/users src/components/users src/lib/customers src/components/customers src/lib/product-categories src/lib/products src/components/products src/lib/payment-methods src/lib/incomes src/components/incomes src/lib/dashboard src/components/dashboard src/app/api/admin src/app/api/customers src/app/api/product-categories src/app/api/products src/app/api/payment-methods src/app/api/incomes
```

Expected: zero failed tests.

- [ ] **Step 2: Run the full verification suite**

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: every command exits 0. Record test file/test counts and Next version.

### Task 2: Inspect Supabase migrations 010 and 011

**Files:**

- Read: `supabase/queries/010_income_commissions_and_split_payments.sql`
- Read: `supabase/queries/011_customer_visits_and_fixed_schedules.sql`
- Read: corresponding verification blocks in `supabase/queries/README.md`.

**Interfaces:**

- Produces: explicit evidence that `010`/`011` are present or an exact list of missing objects.

- [ ] **Step 1: Open the configured Supabase SQL Editor**

Invoke `browser:control-in-app-browser`, read its skill instructions, open the project derived from `NEXT_PUBLIC_SUPABASE_URL` without exposing the URL/key, and use the existing authenticated browser session.

- [ ] **Step 2: Run structural inspection**

Execute a read-only query covering:

```sql
select table_name, rowsecurity
from pg_tables
where schemaname = 'public'
  and table_name in ('income_payments','customer_fixed_schedules','fixed_customer_occurrences');

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'create_income_v2','list_incomes','list_customer_visits',
    'create_customer_v2','update_customer_v2','resolve_fixed_customer_occurrence'
  );
```

Also run the exact column/constraint/grant checks documented for `010` and `011`.

- [ ] **Step 3: Decide replay from evidence**

If every expected object/check passes, do not replay `010`/`011`. If anything is missing, execute the complete missing migration in order, then rerun its structural and behavioral acceptance blocks. Stop on any error.

### Task 3: Apply and verify migrations 012 through 016

**Files:**

- Execute: `supabase/queries/012_owner_commission_rules.sql`
- Execute: `supabase/queries/013_customer_visit_financials.sql`
- Execute: `supabase/queries/014_product_categories.sql`
- Execute: `supabase/queries/015_product_item_commissions.sql`
- Execute: `supabase/queries/016_payment_methods.sql`

**Interfaces:**

- Produces: canonical remote schema with no `_v2` RPCs.

- [ ] **Step 1: Apply and verify 012**

Execute the entire file once. Run its README checks proving owner user rates/sale commissions are zero, manager-to-employee commission remains configured, invalid owner override fails and `responsible_role_snapshot` is non-null.

- [ ] **Step 2: Apply and verify 013**

Run the migration and its rollback-wrapped visit checks. Confirm returned prices/subtotals/totals exactly match income snapshots and internal financial/employee keys are absent.

- [ ] **Step 3: Apply and verify 014**

Run the migration and checks. Confirm four seed mappings, no null product category, RLS enabled, manager lifecycle authorization and active-product deactivation protection.

- [ ] **Step 4: Apply and verify 015**

Run the migration and checks. Confirm every item has a valid snapshot, item sums reconcile to parent totals, full product/service exceptions work together, owner/self/employee misuse fails and idempotency includes flags.

- [ ] **Step 5: Apply and verify 016**

Run the migration and checks. Confirm every legacy payment maps, three-method allocation works, duplicate/inactive/mismatched allocations fail, combined filtering matches and dynamic totals reconcile.

- [ ] **Step 6: Confirm canonical final shape**

Run:

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public' and routine_name like '%\_v2' escape '\';

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('product_categories','payment_methods');
```

Expected: zero `_v2` routines; both new tables exist with `rowsecurity = true`.

### Task 4: Reconcile live role-scoped metrics and workflows

**Files:**

- Use: README rollback-wrapped acceptance blocks.
- Use: running local application connected to configured Supabase project.

**Interfaces:**

- Produces: evidence for manager and employee scope plus UI/API smoke behavior.

- [ ] **Step 1: Verify manager metrics**

Within a transaction, create controlled active/voided sales for at least two responsible users. Call `list_incomes` as an active manager and independently aggregate the same filtered `incomes` rows. Assert:

```text
grossTotal = SUM(total WHERE status = active)
commissionTotal = SUM(commission_total WHERE status = active)
barbershopNet = SUM(barbershop_net WHERE status = active)
```

Assert `paymentTotals` equals grouped `income_payments.amount` for those active filtered sales.

- [ ] **Step 2: Verify employee metrics**

Call `list_incomes` as one employee with `can_view_all = false`; prove only their `employee_id` rows contribute even if a foreign `filter_user_id` is supplied.

- [ ] **Step 3: Smoke test the application**

Run the local app and verify manager category/method CRUD, product creation with a dynamic category, a sale split across three methods, simultaneous full service/product lines, owner zero commission, dynamic history filtering and customer visit totals. Verify employee absence of manager controls and self-scoped metrics.

- [ ] **Step 4: Roll back controlled SQL data**

Ensure every SQL behavioral block ends with `ROLLBACK`. Remove no pre-existing user/business data.

### Task 5: Update durable documentation and final evidence

**Files:**

- Modify: `AGENTS.md`
- Modify: `context_snapshot.md`
- Modify: `product.md`
- Modify: `supabase/queries/README.md` only if verification exposed missing execution guidance.

**Interfaces:**

- Produces: accurate deployed state, test evidence, boundaries and next action.

- [ ] **Step 1: Update architecture and product status**

Record canonical category/payment catalogs, owner zero rule, item snapshots, dynamic payment totals, enriched visits, migration state through `016` and removal of `_v2` RPCs.

- [ ] **Step 2: Record exact verification evidence**

Include final test counts, lint/build results, remote migration results and live manager/employee reconciliation. Do not retain prior statements saying Supabase is only through `009` or `011`.

- [ ] **Step 3: Run final verification after documentation changes**

```bash
npm test
npm run lint
npm run build
git diff --check
git status --short
```

- [ ] **Step 4: Commit documentation and any final verified fixes**

```bash
git add AGENTS.md context_snapshot.md product.md supabase/queries/README.md
git commit -m "docs(commercial): record catalog and commission rollout"
```

- [ ] **Step 5: Re-read acceptance criteria**

Compare every criterion in `docs/superpowers/specs/2026-08-14-commercial-catalogs-and-item-commissions-design.md` with code, SQL output and live behavior. Report any unmet item explicitly instead of declaring completion.

