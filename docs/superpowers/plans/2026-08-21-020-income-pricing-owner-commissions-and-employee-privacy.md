# Income Pricing, Owner Commissions and Employee Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make owner commission configurable, let managers override service/product prices with audit, calculate commission on charged value and ensure employees receive only their own earnings throughout income entry, history and dashboard.

**Architecture:** Migration `020` removes the owner-zero invariant and promotes one canonical role-aware `create_income` contract supporting manager exact payments/price overrides and employee basis-point payments. TypeScript uses discriminated manager/employee form, detail and metrics contracts so sensitive values are absent from employee JSON rather than hidden in components.

**Tech Stack:** PostgreSQL PL/pgSQL, Supabase RPC, Next.js 16, React Hook Form, strict TypeScript, Zod, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-21-operational-control-and-employee-privacy-design.md`

**Status:** Planned and not implemented. This is the next local implementation block after the reviewed `019` contracts; migration order remains `019` then `020`.

## Global Constraints

- Run after migration `019` and preserve work-session trigger/linkage.
- Existing owner rates remain zero until edited; future owner sales use configured rates.
- Only owner/admin may override a catalog price; every changed line requires actor and reason.
- Charged line values may be lower, higher or zero; commission uses charged subtotal.
- Employee browser JSON contains no catalog/charged price, gross total, adjustment, payment amount or barbershop net.
- Employee payment splits use distinct payment-method UUIDs and integer basis points summing to 10,000; managers use exact ARS amounts.
- A zero-total manager sale has no payment rows, zero commission and still records items/customer/stock/audit.
- Keep canonical `create_income`, `list_incomes`, `get_income_detail` and `income_as_json`; add no `_v2` names.

---

### Task 1: Remove owner normalization from user administration

**Files:**
- Modify: `src/lib/users/service.test.ts`
- Modify: `src/lib/users/service.ts`
- Modify: `src/components/users/user-editor-dialog.test.tsx`
- Modify: `src/components/users/user-editor-dialog.tsx`
- Modify: `src/lib/users/presentation.test.ts`
- Modify: `src/lib/users/presentation.ts`

**Interfaces:**
- Owner create/update accepts the existing integer `serviceCommissionRate` and `productCommissionRate` fields exactly like admin/employee.

- [ ] **Step 1: Change tests to RED**

Assert creating an owner with rates `35/12` persists `35/12`, promoting a user preserves submitted rates, owner editor inputs are enabled and user presentation no longer emits `No aplica`.

- [ ] **Step 2: Run RED**

Run `npm test -- src/lib/users/service.test.ts src/lib/users/presentation.test.ts src/components/users/user-editor-dialog.test.tsx`.

- [ ] **Step 3: Remove role-based zeroing**

Delete `isOwner ? 0 : rate`, owner-disabled inputs and role-change resets. Keep integer 0–100 validation and historical copy.

- [ ] **Step 4: Run GREEN and commit**

Commit: `feat(users): allow configurable owner commissions`

---

### Task 2: Define charged-price and role-specific income contracts

**Files:**
- Modify: `src/types/income.ts`
- Modify: `src/types/income-commissions.ts`
- Modify: `src/lib/incomes/income-schema.ts`
- Modify: `src/lib/incomes/income-schema.test.ts`
- Modify: `src/lib/incomes/contracts.ts`
- Modify: `src/lib/incomes/frontend-contracts.ts`
- Modify: `src/lib/incomes/frontend-contracts.test.ts`
- Modify: `src/lib/incomes/income-calculations.ts`
- Modify: `src/lib/incomes/income-calculations.test.ts`
- Modify: `src/lib/incomes/income-commissions.ts`
- Modify: `src/lib/incomes/income-commissions.test.ts`

**Interfaces:**
- Produces `ManagerCreateIncomeInput | EmployeeCreateIncomeInput`, `ManagerIncomeFormData | EmployeeIncomeFormData`, `ManagerIncomeListItem | EmployeeIncomeListItem` and role-specific metrics.

- [ ] **Step 1: Write failing strict-contract tests**

```ts
type PriceOverride = {
  chargedUnitPrice: number;
  reason: string;
};

type ManagerPaymentInput = { paymentMethodId: string; amount: number };
type EmployeePaymentInput = { paymentMethodId: string; basisPoints: number };

type EmployeeIncomeListItem = {
  id: string;
  createdAt: string;
  businessDate: string;
  customer: Employee | null;
  concepts: Array<{ id: string; type: "service" | "product"; name: string; quantity: number; earning: number }>;
  employeeCommission: number;
  status: IncomeStatus;
};
```

Manager product/service selections accept optional `priceOverride`; employee inputs reject it. Manager payments reject `basisPoints`; employee payments reject `amount`. Employee response schemas must fail if `price`, `total`, `payments`, `barbershopNet`, `discount` or `surcharge` appears.

- [ ] **Step 2: Write failing calculation tests**

Cover catalog 20,000 charged 10,000 at 50% => commission 5,000/net 5,000; surcharge; free line; quantity-two product override; and deterministic basis-point allocation:

```ts
expect(allocateByBasisPoints(10001, [5000, 5000])).toEqual([5000, 5001]);
```

- [ ] **Step 3: Run RED**

Run the six affected income test files.

- [ ] **Step 4: Implement discriminated schemas and pure calculations**

Use `viewer: "manager" | "employee"` discriminants. Keep manager item snapshots with `catalogUnitPrice`, `chargedUnitPrice`, `catalogSubtotal`, `chargedSubtotal`, signed `adjustmentAmount` and commission. Employee items expose only `earning`.

- [ ] **Step 5: Run GREEN and commit**

Commit: `feat(incomes): define private charged-price contracts`

---

### Task 3: Promote migration 020 and repository boundary

**Files:**
- Create: `supabase/queries/020_income_pricing_owner_commissions_and_employee_privacy.sql`
- Create: `src/lib/incomes/migration-020.test.ts`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `src/lib/incomes/repository.ts`
- Modify: `src/lib/incomes/repository.test.ts`
- Modify: `src/lib/incomes/service.ts`
- Modify: `src/lib/incomes/service.test.ts`
- Modify: `src/lib/incomes/client.ts`
- Modify: `src/lib/incomes/client.test.ts`
- Modify: `src/app/api/incomes/route.ts`
- Modify: `src/app/api/incomes/route.test.ts`
- Modify: `supabase/queries/README.md`

**Interfaces:**
- Extends item snapshots with `catalog_unit_price`, `charged_unit_price`, `catalog_subtotal`, `charged_subtotal`, `price_override_by`, `price_override_reason`.
- Canonical `create_income` accepts strict line pricing plus role-specific payment JSON and returns the created UUID.
- Role-aware JSON/list/detail RPCs omit sensitive keys for employees.

- [ ] **Step 1: Write failing migration and repository tests**

Assert `020` drops `enforce_owner_user_commission_rates`, `enforce_owner_income_commission` and `users_owner_commission_rates_check`; contains no `responsible_role = 'owner' then 0`; snapshots both prices; validates override actor/reason; supports basis points; permits zero total without payments; retains work-session columns; and has no `_v2` identifiers. Route tests require authentication before choosing the manager or employee body schema.

- [ ] **Step 2: Run RED**

Run `npm test -- src/lib/incomes/migration-020.test.ts src/lib/incomes/repository.test.ts src/lib/incomes/service.test.ts`.

- [ ] **Step 3: Implement authoritative SQL**

Lock actor, responsible user, service, products, payment methods, customer and open work session in the existing documented order. For each line:

```sql
charged_unit_price := coalesce(manager_override_price, catalog_unit_price);
charged_subtotal := charged_unit_price * quantity;
commission_amount := round(charged_subtotal::numeric * effective_rate / 100)::bigint;
adjustment_amount := charged_subtotal - catalog_subtotal;
```

Reject employee overrides, missing reasons, negative charged values, mixed payment modes, invalid basis-point sums and positive-total sales without payments. For employee allocations, calculate all but the final amount by integer division and assign the exact remainder to the last row.

- [ ] **Step 4: Implement role-specific projections and repository parsing**

Keep manager JSON complete. Employee JSON is built separately in PostgreSQL and validated by a separate Zod schema. Do not parse full JSON and delete keys afterward. Remove the `responsibleRole === "owner"` zero shortcut from the preview calculation; use the configured owner rates while continuing to reject exceptional 100% grants to an owner target.

- [ ] **Step 5: Add rollback-wrapped SQL acceptance**

Cover configurable owner rates, normal employee price, discount/surcharge/free lines, unauthorized override, full-commission interaction, percentage remainder, zero-total no-payment sale, idempotent retry, stock and work-session linkage.

- [ ] **Step 6: Run GREEN and commit**

Run the focused income/user slice, TypeScript and diff check.

Commit: `feat(incomes): persist charged prices and private projections`

---

### Task 4: Build role-safe income entry

**Files:**
- Modify: `src/app/(dashboard)/incomes/new/page.tsx`
- Modify: `src/app/(dashboard)/incomes/new/page.test.tsx`
- Modify: `src/components/incomes/income-form.tsx`
- Modify: `src/components/incomes/income-form.test.tsx`
- Modify: `src/components/incomes/service-selector.tsx`
- Modify: `src/components/incomes/service-selector.test.tsx`
- Modify: `src/components/incomes/product-selector.tsx`
- Modify: `src/components/incomes/product-selector.test.tsx`
- Create: `src/components/incomes/line-price-editor.tsx`
- Create: `src/components/incomes/line-price-editor.test.tsx`
- Modify: `src/components/incomes/payment-method-selector.tsx`
- Modify: `src/components/incomes/payment-method-selector.test.tsx`
- Modify: `src/components/incomes/commission-preview.tsx`
- Modify: `src/components/incomes/commission-preview.test.tsx`
- Modify: `src/components/incomes/income-summary.tsx`
- Modify: `src/components/incomes/income-summary.test.tsx`
- Modify: `src/components/incomes/income-confirmation-dialog.tsx`
- Modify: `src/components/incomes/income-confirmation-dialog.test.tsx`
- Modify: `src/components/incomes/income-success-state.tsx`
- Modify: `src/components/incomes/income-success-state.test.tsx`

**Interfaces:**
- Server page sends full price catalogs only to managers and earning-only catalogs to employees.
- Manager line editor emits charged unit price plus reason; employee payment editor emits basis points.

- [ ] **Step 1: Write failing leakage and interaction tests**

Assert employee page props/HTML never contain catalog prices, gross total or net; selectors show only `Tu ingreso`; confirmation and success state show only commission; percentages must total 100%. Assert manager can discount/surcharge/free each line, reason is mandatory and confirmation/success show catalog, charged, adjustment, gross, commission and net.

- [ ] **Step 2: Run RED**

Run the page plus all listed component tests.

- [ ] **Step 3: Split form rendering by discriminant**

Do not pass hidden manager fields into employee components. Extract shared selection identity/quantity state, then render manager money controls or employee earning/percentage controls from the discriminated `data.viewer` contract.

- [ ] **Step 4: Implement free-sale and reset behavior**

When manager total becomes zero, clear payments and accept review. Changing/removing a line clears its override and reason. Switching responsible employee recomputes preview and preserves no stale 100% exception or price state.

- [ ] **Step 5: Run GREEN and commit**

Commit: `feat(incomes): add role-safe pricing entry`

---

### Task 5: Sanitize income history, detail and dashboard

**Files:**
- Modify: `src/app/(dashboard)/incomes/page.tsx`
- Modify: `src/app/(dashboard)/incomes/page.test.tsx`
- Modify: `src/components/incomes/incomes-view.tsx`
- Modify: `src/components/incomes/incomes-view.test.tsx`
- Modify: `src/components/incomes/income-table.tsx`
- Modify: `src/components/incomes/income-table.test.tsx`
- Modify: `src/components/incomes/income-mobile-list.tsx`
- Modify: `src/components/incomes/income-mobile-list.test.tsx`
- Modify: `src/components/incomes/income-detail-sheet.tsx`
- Modify: `src/components/incomes/income-detail-sheet.test.tsx`
- Modify: `src/components/incomes/income-metrics.tsx`
- Modify: `src/components/incomes/income-metrics.test.tsx`
- Modify: `src/lib/incomes/income-metric-cards.ts`
- Modify: `src/lib/incomes/income-metric-cards.test.ts`
- Modify: `src/lib/dashboard/income-summary.ts`
- Modify: `src/lib/dashboard/income-summary.test.ts`
- Modify: `src/components/dashboard/income-summary-card.tsx`
- Modify: `src/components/dashboard/income-summary-card.test.tsx`
- Modify: `src/app/(dashboard)/(home)/page.tsx`
- Modify: `src/app/(dashboard)/(home)/page.test.tsx`

- [ ] **Step 1: Write failing employee privacy tests**

Render employee fixtures containing only concepts/commission and assert no labels or accessible values for total sold, average ticket, payment totals, catalog/charged price, discount, barbershop net or registrant. Manager fixtures continue to show the complete audit.

- [ ] **Step 2: Run RED**

Run the affected income/dashboard slice.

- [ ] **Step 3: Implement explicit manager/employee components**

Use narrowing on `viewer`; avoid optional money fields and fallback labels. Employee cards are `Mi ingreso` and `Ventas`; employee list/detail rows show customer, concepts, quantities, date/status and own earning only.

- [ ] **Step 4: Run GREEN and commit**

Commit: `feat(incomes): enforce employee financial privacy`

---

### Task 6: Verify and document block 020

**Files:**
- Modify: `AGENTS.md`
- Modify: `product.md`
- Modify: `context_snapshot.md`
- Modify: `supabase/queries/README.md`

- [ ] **Step 1: Update delivered invariants**

Replace owner-zero documentation with configurable rates, record charged/catalog snapshots, zero-total sales, percentage allocations and server-side employee privacy.

- [ ] **Step 2: Run complete verification**

```bash
npm test
npm run lint
npx next typegen
npx tsc --noEmit
npm run build -- --webpack
git diff --check
```

- [ ] **Step 3: Apply and validate migration when authorized**

Install `020` after `019`, run every rollback-wrapped acceptance scenario and verify employee JSON directly contains none of the forbidden keys.

- [ ] **Step 4: Validate desktop and 390x844 for both roles**

Exercise manager discount/surcharge/free sale and employee percentage entry/history using separate authenticated sessions; inspect network responses for leakage.

- [ ] **Step 5: Commit**

Commit: `docs(incomes): record pricing and privacy rollout`
