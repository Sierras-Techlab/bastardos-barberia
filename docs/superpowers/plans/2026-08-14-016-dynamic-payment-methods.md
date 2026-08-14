# Dynamic Payment Methods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed cash/transfer enums with an audited payment-method catalog, arbitrary exact split allocations, dynamic filters and dynamic payment totals.

**Architecture:** Add a payment-method domain and manager CRUD UI, migrate payment rows to UUID foreign keys plus historical name snapshots, then generalize every income contract around method IDs. PostgreSQL remains authoritative for active-method validation, exact allocation sums, filtering and role-scoped metrics.

**Tech Stack:** Next.js 16.3 Route Handlers, PostgreSQL, Supabase, strict TypeScript, Zod, React Hook Form, Vitest, Testing Library and Sonner.

## Global Constraints

- Run after migration `015`.
- Read local Next.js Route Handler/dynamic params docs before API work.
- Payment names are globally unique after normalization, including inactive rows.
- `DELETE` deactivates; physical deletion is forbidden.
- At least one payment method remains active.
- A new sale accepts one or more distinct active method IDs with positive integer amounts and exact total equality.
- Historical display uses name snapshots; inactive methods remain filterable.
- Replace hardcoded cash/transfer totals with `paymentTotals[]`.

---

### Task 1: Build the payment-method domain with TDD

**Files:**

- Create: `src/types/payment-method.ts`
- Create: `src/lib/payment-methods/schemas.ts`
- Create: `src/lib/payment-methods/schemas.test.ts`
- Create: `src/lib/payment-methods/contracts.ts`
- Create: `src/lib/payment-methods/repository.ts`
- Create: `src/lib/payment-methods/repository.test.ts`
- Create: `src/lib/payment-methods/service.ts`
- Create: `src/lib/payment-methods/service.test.ts`
- Create: `src/lib/payment-methods/client.ts`
- Create: `src/lib/payment-methods/client.test.ts`

**Interfaces:**

- Produces:

```ts
type PaymentMethod = { id: string; name: string; isActive: boolean };
type PaymentMethodInput = { name: string };
type PaymentMethodUpdate = { name?: string; isActive?: boolean };
type IncomePayment = { paymentMethodId: string; methodName: string; amount: number };
type IncomePaymentInput = { paymentMethodId: string; amount: number };
```

- [ ] **Step 1: Write failing schema/service tests**

Assert strict trimmed 1–80 character names, manager mutations, authenticated list, inactive inclusion for history and safe duplicate/last-active conflict mapping.

- [ ] **Step 2: Write failing repository/client tests**

Assert exact RPC names `create_payment_method`, `update_payment_method`, `deactivate_payment_method`, canonical row mapping and no server import in the browser client.

- [ ] **Step 3: Verify RED**

```bash
npm test -- --run src/lib/payment-methods
```

- [ ] **Step 4: Implement domain and run GREEN**

Follow the product-category domain shape, map `PAYMENT_METHOD_NAME_EXISTS` and `LAST_ACTIVE_PAYMENT_METHOD` to HTTP 409 and rerun Step 3.

### Task 2: Add payment-method Route Handlers

**Files:**

- Create: `src/app/api/payment-methods/route.ts`
- Create: `src/app/api/payment-methods/route.test.ts`
- Create: `src/app/api/payment-methods/[id]/route.ts`
- Create: `src/app/api/payment-methods/[id]/route.test.ts`

**Interfaces:**

- `GET` returns active plus filterable historical methods for authenticated users.
- `GET /api/payment-methods/[id]` returns one method or 404.
- `POST` creates with 201; `PATCH` renames/reactivates; `DELETE` deactivates.

- [ ] **Step 1: Write failing authorization/contract tests**

Require `requireUser` for GET and `requireManager` for mutations; assert strict parsing, awaited params and correct success/error statuses.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run src/app/api/payment-methods/route.test.ts "src/app/api/payment-methods/[id]/route.test.ts"
```

- [ ] **Step 3: Implement handlers and run GREEN**

Use `successResponse`/`errorResponse`, the domain service and canonical IDs; rerun Step 2.

### Task 3: Generalize income schemas and repository contracts

**Files:**

- Modify: `src/types/income.ts`
- Modify: `src/lib/incomes/income-schema.ts`
- Modify: `src/lib/incomes/income-schema.test.ts`
- Modify: `src/lib/incomes/frontend-contracts.ts`
- Modify: `src/lib/incomes/frontend-contracts.test.ts`
- Modify: `src/lib/incomes/contracts.ts`
- Modify: `src/lib/incomes/repository.ts`
- Modify: `src/lib/incomes/repository.test.ts`
- Modify: `src/lib/incomes/client.ts`
- Modify: `src/lib/incomes/client.test.ts`
- Modify: `src/lib/incomes/income-view-query.ts`
- Modify: `src/lib/incomes/income-view-query.test.ts`
- Modify: `src/lib/incomes/income-list.ts`
- Modify: `src/lib/incomes/income-list.test.ts`
- Modify: `src/lib/incomes/income-metric-cards.ts`
- Modify: `src/lib/incomes/income-metric-cards.test.ts`
- Modify: `src/data/incomes.mock.json`
- Modify: `src/data/incomes.mock.test.ts`
- Modify: `src/app/api/incomes/route.ts`
- Modify: `src/app/api/incomes/route.test.ts`

**Interfaces:**

- Remove fixed `PaymentMethod` and `paymentMode`.
- `payments: IncomePaymentInput[]` uses `.min(1)` with no maximum.
- `paymentMethodId?: string` replaces `paymentMethod?: cash|transfer` in list queries.
- `PaginatedIncomes.metrics.paymentTotals: Array<{ paymentMethodId: string; name: string; amount: number }>`.

- [ ] **Step 1: Change tests to three-method allocations and ID filters**

Use three UUID methods totaling $49,000; assert duplicates, zero amounts and invalid UUIDs fail. Assert query serialization uses `paymentMethodId` and repository RPC uses `filter_payment_method_id`.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run src/lib/incomes/income-schema.test.ts src/lib/incomes/frontend-contracts.test.ts src/lib/incomes/repository.test.ts src/lib/incomes/client.test.ts src/lib/incomes/income-view-query.test.ts "src/app/api/incomes/route.test.ts"
```

- [ ] **Step 3: Implement strict dynamic contracts and run GREEN**

Remove enum fallbacks, require payment snapshot names in responses, parse dynamic totals strictly and pass canonical IDs to SQL. Update legacy in-memory list helpers, metric-card builders and shared income fixtures to `payments` plus `paymentTotals`; remove all remaining “V2” fallback copy. Rerun Step 2.

### Task 4: Replace the payment selector and add catalog administration UI

**Files:**

- Rewrite: `src/components/incomes/payment-method-selector.tsx`
- Modify: `src/components/incomes/payment-method-selector.test.tsx`
- Create: `src/components/incomes/payment-methods-dialog.tsx`
- Create: `src/components/incomes/payment-methods-dialog.test.tsx`
- Modify: `src/components/incomes/income-form.tsx`
- Modify: `src/components/incomes/income-form.test.tsx`
- Modify: `src/components/incomes/incomes-view.tsx`
- Modify: `src/components/incomes/incomes-view.test.tsx`
- Modify: `src/app/(dashboard)/incomes/new/page.tsx`
- Modify: `src/app/(dashboard)/incomes/new/page.test.tsx`
- Modify: `src/app/(dashboard)/incomes/page.tsx`
- Modify: `src/app/(dashboard)/incomes/page.test.tsx`

**Interfaces:**

- `IncomeFormData.paymentMethods: PaymentMethod[]` active for creation.
- `IncomesView.paymentMethods: PaymentMethod[]` includes inactive historical methods.
- Selector props: `{ methods, payments, total, onChange, error }`.

- [ ] **Step 1: Write failing selector tests**

Cover one-method autofill, add/remove allocation, distinct method enforcement, three methods, remaining/excess copy, inactive exclusion and exact distribution.

- [ ] **Step 2: Write failing administration/page tests**

Cover manager action visibility, create/rename/deactivate/reactivate, last-active conflict and server-page loading of active/history method sets.

- [ ] **Step 3: Run RED**

```bash
npm test -- --run src/components/incomes/payment-method-selector.test.tsx src/components/incomes/payment-methods-dialog.test.tsx src/components/incomes/income-form.test.tsx src/components/incomes/incomes-view.test.tsx "src/app/(dashboard)/incomes/new/page.test.tsx" "src/app/(dashboard)/incomes/page.test.tsx"
```

- [ ] **Step 4: Implement the dynamic selector/dialog/pages and run GREEN**

Render allocation rows with method select, integer input and remove action; add rows until all active distinct methods are used. Use Sonner mutation feedback and clear invalid allocations when a method disappears. Rerun Step 3.

### Task 5: Generalize history, detail and dashboard presentation

**Files:**

- Modify: `src/components/incomes/income-filters.tsx`
- Modify: `src/components/incomes/income-filters.test.tsx`
- Modify: `src/components/incomes/income-detail-sheet.tsx`
- Modify: `src/components/incomes/income-detail-sheet.test.tsx`
- Modify: `src/components/incomes/income-table.tsx`
- Modify: `src/components/incomes/income-table.test.tsx`
- Modify: `src/components/incomes/income-mobile-list.tsx`
- Modify: `src/components/incomes/income-mobile-list.test.tsx`
- Modify: `src/components/incomes/income-metrics.tsx`
- Modify: `src/components/incomes/income-metrics.test.tsx`
- Modify: `src/components/incomes/income-success-state.tsx`
- Modify: `src/components/incomes/income-success-state.test.tsx`
- Modify: `src/components/incomes/income-void-dialog.test.tsx`
- Modify: `src/lib/incomes/income-presentation.ts`
- Modify: `src/lib/incomes/income-presentation.test.ts`
- Modify: `src/lib/dashboard/income-summary.ts`
- Modify: `src/lib/dashboard/income-summary.test.ts`
- Modify: `src/components/dashboard/income-summary-card.tsx`
- Modify: `src/components/dashboard/income-summary-card.test.tsx`
- Modify: `src/app/(dashboard)/(home)/page.test.tsx`
- Modify: `src/lib/dashboard/recent-activity.test.ts`
- Modify: `src/types/dashboard.ts`

**Interfaces:**

- Payment label is one snapshot name or `Combinado (N medios)`.
- Filters emit `paymentMethodId | "all"`.
- Dashboard today summary carries dynamic `paymentTotals`.

- [ ] **Step 1: Write failing dynamic presentation tests**

Assert inactive names remain visible, a three-method sale is labeled combined, filters use IDs and dashboard totals render every method returned without cash/transfer assumptions.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run src/components/incomes/income-filters.test.tsx src/components/incomes/income-detail-sheet.test.tsx src/lib/incomes/income-presentation.test.ts src/lib/dashboard/income-summary.test.ts src/components/dashboard/income-summary-card.test.tsx
```

- [ ] **Step 3: Implement dynamic presentation and run GREEN**

Remove Banknote/Landmark business branching except optional decorative selection; render method snapshot names and dynamic arrays. Convert all table/mobile/metric/success/void/dashboard fixtures away from the legacy `paymentMethod`, `cashTotal` and `transferTotal` fields. Rerun Step 2.

### Task 6: Create migration 016 and verify dynamic payments

**Files:**

- Create: `supabase/queries/016_payment_methods.sql`
- Modify: `supabase/queries/README.md`
- Modify: `src/lib/supabase/database.types.ts`

**Interfaces:**

- Produces `payment_methods`, `income_payments.payment_method_id`, `method_name_snapshot`, generalized `create_income` and `list_incomes`.

- [ ] **Step 1: Write the transactional catalog/backfill**

Create audited methods with fixed UUID seeds for Efectivo/Transferencia, normalization, RLS and lifecycle functions. Add nullable FK/snapshot columns, map every legacy row, verify zero unmapped rows, make columns non-null, then drop `income_payments.method`, `incomes.payment_method` and their old constraints.

- [ ] **Step 2: Replace sale/list SQL behavior**

Validate a JSON array of one or more unique active UUID methods, lock them in UUID order, fingerprint normalized IDs/amounts and insert ID plus name snapshot. Change `list_incomes` to `filter_payment_method_id uuid`; return historical payment names and grouped `paymentTotals` over active filtered sales.

- [ ] **Step 3: Add SQL acceptance blocks**

Prove legacy mapping, three-method exact sale, duplicate/inactive/mismatched rejection, combined-sale filtering, inactive historical visibility, last-active protection and manager/employee metric scope.

- [ ] **Step 4: Run the complete payment slice**

```bash
npm test -- --run src/lib/payment-methods src/app/api/payment-methods src/lib/incomes src/components/incomes src/lib/dashboard src/components/dashboard src/data/incomes.mock.test.ts "src/app/api/incomes/route.test.ts" "src/app/(dashboard)/(home)/page.test.tsx" "src/app/(dashboard)/incomes/new/page.test.tsx" "src/app/(dashboard)/incomes/page.test.tsx"
npx tsc --noEmit
git diff --check
```

- [ ] **Step 5: Commit**

```bash
git add supabase/queries/016_payment_methods.sql supabase/queries/README.md src/lib/supabase/database.types.ts src/types/payment-method.ts src/types/income.ts src/lib/payment-methods src/app/api/payment-methods src/lib/incomes src/components/incomes src/lib/dashboard src/components/dashboard "src/app/(dashboard)/incomes"
git commit -m "feat(incomes): add dynamic payment methods"
```
