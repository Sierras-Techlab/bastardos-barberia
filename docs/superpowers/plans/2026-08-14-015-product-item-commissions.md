# Product Item Commissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calculate and audit commission per sale item, allowing managers to grant complete product lines to another non-owner employee.

**Architecture:** Extend the normalized product payload with an exception flag, calculate line snapshots server-side and reconcile them into existing income aggregates. Migration `015` backfills legacy rows, installs canonical `create_income` and removes `create_income_v2`.

**Tech Stack:** PostgreSQL PL/pgSQL, Supabase RPC, strict TypeScript, Zod, React Hook Form, Vitest and Testing Library.

## Global Constraints

- Run after migration `014`.
- A product exception covers the entire line quantity.
- Service and multiple product exceptions may coexist.
- Only owner/admin may grant exceptions to a different non-owner responsible employee.
- Product prices, subtotals, rates, amounts, flags and authorizers are database-authoritative immutable snapshots.
- Item commission sums must exactly equal aggregate commission totals and net reconciliation.
- Final sale RPC name is `create_income`; remove `create_income_v2`.

---

### Task 1: Define item-level types, validation and calculations with TDD

**Files:**

- Modify: `src/types/income.ts`
- Modify: `src/types/income-commissions.ts`
- Modify: `src/lib/incomes/income-schema.test.ts`
- Modify: `src/lib/incomes/frontend-contracts.test.ts`
- Modify: `src/lib/incomes/frontend-contracts.ts`
- Modify: `src/lib/incomes/income-commissions.test.ts`
- Modify: `src/lib/incomes/contracts.ts`

**Interfaces:**

- Produces:

```ts
type IncomeProductInput = {
  productId: string;
  quantity: number;
  grantFullCommission: boolean;
};

type IncomeItemCommissionSnapshot = {
  subtotal: number;
  rate: number;
  amount: number;
  fullCommission: boolean;
  authorizedBy: Employee | null;
};
```

`IncomeListProduct` and the income service snapshot each include `commission: IncomeItemCommissionSnapshot`.

- [ ] **Step 1: Write failing schema tests**

Assert every product requires a strict boolean flag, duplicate product IDs still fail, and manipulated extra rate/amount/authorizer fields fail.

- [ ] **Step 2: Write failing line-calculation tests**

Use two units at $15,000 with base rate 10% and full flag true; expect subtotal/commission $30,000 at 100%. Mix it with a normal $10,000 line at 10% and a full $19,000 service; expect total commission $50,000 and correct net.

- [ ] **Step 3: Verify RED**

```bash
npm test -- --run src/lib/incomes/income-schema.test.ts src/lib/incomes/frontend-contracts.test.ts src/lib/incomes/income-commissions.test.ts
```

Expected: failures for missing flags and aggregate-only calculation.

- [ ] **Step 4: Implement pure preview calculation and strict contracts**

Add a pure `calculateCommissionPreview` input containing selected product lines/prices and compute each line independently. Owner role short-circuits all lines to zero. Rename `CreateIncomeV2Input` to the existing canonical `CreateIncomeInput` and `createIncomeV2InputSchema` to `createIncomeInputSchema`; update imports/tests and remove V2 wording. Keep `calculatePaymentBalance` unchanged.

- [ ] **Step 5: Run GREEN**

Rerun Step 3. Expected: pass.

### Task 2: Update repository RPC and response contracts

**Files:**

- Modify: `src/lib/incomes/repository.ts`
- Modify: `src/lib/incomes/repository.test.ts`
- Modify: `src/lib/incomes/service.test.ts`
- Modify: `src/lib/incomes/client.test.ts`
- Modify: `src/lib/incomes/contracts.ts`

**Interfaces:**

- `incomeRepository.create` calls canonical `create_income`.
- Product payload is passed unchanged as `{ productId, quantity, grantFullCommission }[]`.
- Income JSON returns commission snapshots on service and each product line.

- [ ] **Step 1: Change complete fixtures and RPC expectations, then run RED**

```ts
expect(rpc).toHaveBeenNthCalledWith(1, "create_income", expect.objectContaining({
  product_items: [{ productId, quantity: 2, grantFullCommission: true }],
}));
```

Run:

```bash
npm test -- --run src/lib/incomes/repository.test.ts src/lib/incomes/service.test.ts src/lib/incomes/client.test.ts
```

- [ ] **Step 2: Implement strict parsing and canonical RPC use**

Require every item commission field, remove aggregate-only authorizer assumptions and map database sentinels `INVALID_PRODUCT_COMMISSION_OVERRIDE` and `INVALID_COMMISSION_OVERRIDE` to HTTP 403.

- [ ] **Step 3: Run GREEN**

Rerun Step 1. Expected: pass.

### Task 3: Add product-line exception controls and detailed preview

**Files:**

- Modify: `src/components/incomes/product-selector.tsx`
- Modify: `src/components/incomes/product-selector.test.tsx`
- Modify: `src/components/incomes/income-form.tsx`
- Modify: `src/components/incomes/income-form.test.tsx`
- Modify: `src/components/incomes/commission-preview.tsx`
- Modify: `src/components/incomes/commission-preview.test.tsx`
- Modify: `src/components/incomes/income-confirmation-dialog.tsx`
- Modify: `src/components/incomes/income-confirmation-dialog.test.tsx`
- Modify: `src/components/incomes/income-detail-sheet.tsx`
- Modify: `src/components/incomes/income-detail-sheet.test.tsx`
- Modify: `src/components/incomes/income-summary.tsx`
- Modify: `src/components/incomes/income-summary.test.tsx`
- Modify: `src/components/incomes/income-metrics.test.tsx`

**Interfaces:**

- `ProductSelector` receives `canGrantFullCommission` and stores the flag per selected line.
- `CommissionPreview` renders service/product line snapshots and aggregate commission/net.

- [ ] **Step 1: Write failing eligibility and rendering tests**

Cover manager-to-employee enabled controls, entire quantity labeling, multiple simultaneous flags, service plus product exceptions, owner/self selection clearing every flag, employees never seeing controls and confirmation/detail itemized amounts.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run src/components/incomes/product-selector.test.tsx src/components/incomes/income-form.test.tsx src/components/incomes/commission-preview.test.tsx src/components/incomes/income-confirmation-dialog.test.tsx src/components/incomes/income-detail-sheet.test.tsx src/components/incomes/income-summary.test.tsx
```

- [ ] **Step 3: Implement controls and reset rules**

When the selected responsible user becomes an owner or becomes the current registering manager, set `grantFullServiceCommission` false and map all products to `grantFullCommission: false`. An authenticated employee never receives exception controls. Render a checkbox only for eligible manager-to-other-non-owner attribution and make its copy state the complete selected quantity.

- [ ] **Step 4: Implement itemized preview/detail and run GREEN**

Use the pure calculation for pre-submit estimates and response snapshots for saved details. Remove remaining user-facing/test “V2 backend” wording from this slice. Rerun Step 2.

### Task 4: Create migration 015 with item snapshots and canonical sale RPC

**Files:**

- Create: `supabase/queries/015_product_item_commissions.sql`
- Modify: `supabase/queries/README.md`
- Modify: `src/lib/supabase/database.types.ts`

**Interfaces:**

- Produces item columns `line_subtotal`, `commission_rate`, `commission_amount`, `full_commission`, `full_commission_authorized_by` and canonical `create_income(...)`.

- [ ] **Step 1: Add/backfill item snapshot columns**

Add nullable columns, backfill service rows from service aggregates, and allocate legacy product aggregate amounts proportionally in deterministic item-ID order with the final row absorbing the rounding remainder. Verify sums against every parent income before applying `NOT NULL` and check constraints.

- [ ] **Step 2: Install canonical `create_income`**

Normalize product JSON including `grantFullCommission`, include it in the request fingerprint, validate flags against locked actor/responsible roles, calculate each product row independently and insert its exact snapshot. Reconcile aggregate amounts from item totals before inserting `incomes`. Preserve stock/customer locks, payments, visits and idempotency.

- [ ] **Step 3: Expand `income_as_json` and remove `_v2`**

Return service/product item commission objects and authorizer identities for manager-visible sale detail. Revoke public execution, grant canonical function to `service_role`, update all database callers, then drop `create_income_v2`.

- [ ] **Step 4: Add behavioral SQL checks**

Document rollback transactions for normal mixed rates, a two-unit full product line, multiple full lines plus full service, unauthorized employee request, manager self-request, owner target, idempotent retry and changed-flag request conflict.

- [ ] **Step 5: Run the focused slice**

```bash
npm test -- --run src/lib/incomes src/components/incomes "src/app/api/incomes/route.test.ts"
npx tsc --noEmit
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add supabase/queries/015_product_item_commissions.sql supabase/queries/README.md src/lib/supabase/database.types.ts src/types/income.ts src/types/income-commissions.ts src/lib/incomes src/components/incomes
git commit -m "feat(incomes): snapshot commissions per item"
```
