# Customer Visit Financials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show historical unit prices, item subtotals and total spent for each active customer visit while completing canonical customer RPC naming.

**Architecture:** Expand only the sanitized `list_customer_visits` projection from immutable income/item snapshots. Update TypeScript contracts and the existing paginated dialog without exposing employee, payment or commission data.

**Tech Stack:** PostgreSQL JSONB RPCs, Supabase, strict TypeScript, Zod, React 19, Vitest and Testing Library.

## Global Constraints

- Run after migration `012`.
- Include active incomes only.
- `subtotal = unitPrice * quantity`; `totalSpent` comes from the immutable income total.
- Do not expose employee IDs, registrants, payments, commissions or authorizers.
- Final RPC names are `create_customer` and `update_customer`; remove both `_v2` functions.

---

### Task 1: Drive the expanded visit contract with failing tests

**Files:**

- Modify: `src/lib/customers/repository.test.ts`
- Modify: `src/lib/customers/client.test.ts`
- Modify: `src/components/customers/customer-visits-dialog.test.tsx`
- Modify: `src/app/api/customers/[id]/visits/route.test.ts`

**Interfaces:**

- Produces:

```ts
type CustomerVisit = {
  id: string;
  occurredAt: string;
  businessDate: string;
  totalSpent: number;
  items: Array<{
    type: "service" | "product";
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
};
```

- [ ] **Step 1: Update complete repository/API fixtures**

Use a visit with a $19,000 service and two $15,000 products; assert `totalSpent: 49000`, unit prices and `subtotal: 30000`. Assert unknown financial/internal keys are rejected by the strict schema.

- [ ] **Step 2: Add dialog assertions**

Assert visible copy includes `$ 19.000`, `2 × Producto`, `$ 30.000` and `Total de la visita $ 49.000`, while employee and commission text are absent.

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test -- --run src/lib/customers/repository.test.ts src/lib/customers/client.test.ts src/components/customers/customer-visits-dialog.test.tsx "src/app/api/customers/[id]/visits/route.test.ts"
```

Expected: failures for missing `unitPrice`, `subtotal` and `totalSpent`.

### Task 2: Implement TypeScript and UI financial detail

**Files:**

- Modify: `src/types/customer.ts`
- Modify: `src/lib/customers/repository.ts`
- Modify: `src/lib/customers/repository.test.ts`
- Modify: `src/lib/customers/client.test.ts`
- Modify: `src/components/customers/customer-visits-dialog.tsx`
- Modify: `src/components/customers/customer-visits-dialog.test.tsx`

**Interfaces:**

- Consumes: the exact `CustomerVisit` shape from Task 1.
- Produces: strict validated `PaginatedCustomerVisits` and formatted ARS visit rows.

- [ ] **Step 1: Expand the strict Zod response schema and public types**

Require non-negative integer prices/totals and positive quantity. Keep pagination unchanged.

- [ ] **Step 2: Render item and visit totals**

Use existing `formatArs`; render quantity, historical unit price, line subtotal and a separated visit total. Preserve loading, error, retry, empty and pagination states.

- [ ] **Step 3: Switch customer repositories to canonical RPCs**

Replace calls to `create_customer_v2` and `update_customer_v2` with `create_customer` and `update_customer`; update repository expectations.

- [ ] **Step 4: Verify GREEN**

Rerun Task 1's test command. Expected: all focused tests pass.

### Task 3: Create migration 013 and canonical customer functions

**Files:**

- Create: `supabase/queries/013_customer_visit_financials.sql`
- Modify: `supabase/queries/README.md`
- Modify: `src/lib/supabase/database.types.ts`

**Interfaces:**

- Produces: canonical `create_customer`, `update_customer`, expanded `list_customer_visits`.

- [ ] **Step 1: Write the migration**

Create canonical customer functions using the exact existing signatures and bodies, revoke/grant them to `service_role`, then drop their `_v2` predecessors. Replace the visit item JSON with:

```sql
jsonb_build_object(
  'type', ii.item_type,
  'name', ii.name_snapshot,
  'quantity', ii.quantity,
  'unitPrice', ii.unit_price,
  'subtotal', ii.unit_price * ii.quantity
)
```

Add `'totalSpent', p.total` by selecting `i.total` into the paginated visit CTE.

- [ ] **Step 2: Add SQL acceptance checks**

Document a transaction that creates or identifies one customer sale, compares every returned subtotal with `income_items`, compares `totalSpent` with `incomes.total`, asserts voided sales are absent and checks the JSON does not contain `employee`, `payments` or `commission`.

- [ ] **Step 3: Run focused verification and commit**

Run:

```bash
git diff --check
npm test -- --run src/lib/customers/repository.test.ts src/lib/customers/service.test.ts src/lib/customers/client.test.ts src/components/customers/customer-visits-dialog.test.tsx "src/app/api/customers/[id]/visits/route.test.ts"
npx tsc --noEmit
```

Then commit:

```bash
git add supabase/queries/013_customer_visit_financials.sql supabase/queries/README.md src/lib/supabase/database.types.ts src/types/customer.ts src/lib/customers src/components/customers/customer-visits-dialog.tsx src/components/customers/customer-visits-dialog.test.tsx
git commit -m "feat(customers): expose historical visit totals"
```

