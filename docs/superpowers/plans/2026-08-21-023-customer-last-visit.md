# Customer Last Visit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each customer's latest qualifying visit date and relative age in the customer directory, derived from active normal sales.

**Architecture:** Migration `023` adds a supporting partial index and promotes one canonical `list_customers` RPC that derives the latest active `source_type='sale'` business date. The customer repository validates that projection, and desktop/mobile directory views format the date without storing a denormalized customer value.

**Tech Stack:** PostgreSQL/Supabase SQL, Next.js 16, strict TypeScript, Zod, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-21-operational-control-and-employee-privacy-design.md`

**Status:** Planned and not implemented. Runs after block `022` and derives its projection from active normal sales without storing mutable visit state on customers.

## Global Constraints

- Run after migration `022`.
- Qualifying visits are active normal service and/or product incomes with a customer.
- Exclude voided incomes and `fixed_subscription` income.
- Derive from `business_date` in `America/Argentina/Buenos_Aires`; do not add a mutable customer column.
- A void immediately reveals the previous qualifying sale.
- Customer projection adds no employee, payment, price, discount, commission or cash data.
- Keep canonical `list_customers`; add no `_v2` object.

---

### Task 1: Extend customer contracts and formatting

**Files:**
- Modify: `src/types/customer.ts`
- Modify: `src/lib/customers/frontend-customer-contracts.ts`
- Modify: `src/lib/customers/frontend-customer-contracts.test.ts`
- Create: `src/lib/customers/last-visit.ts`
- Create: `src/lib/customers/last-visit.test.ts`

**Interfaces:**

```ts
export type Customer = {
  // existing fields
  lastVisitBusinessDate: string | null;
};

export const formatLastVisit = (
  businessDate: string | null,
  today: string,
): { dateLabel: string; relativeLabel: string | null };
```

- [ ] **Step 1: Write failing strict/format tests**

Test null => `Sin visitas`, today => `hoy`, one day => `hace 1 día`, plural days, year/month boundaries and Buenos Aires date parsing without UTC drift. Reject invalid date and unknown sensitive keys in the customer projection.

- [ ] **Step 2: Run RED**

Run customer frontend-contract and last-visit tests.

- [ ] **Step 3: Implement pure formatter and strict type**

Compute whole-day difference from date-only UTC-safe ordinals; use `Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })` for the visible date.

- [ ] **Step 4: Run GREEN and commit**

Commit: `feat(customers): define last visit projection`

---

### Task 2: Add migration 023 and repository projection

**Files:**
- Create: `supabase/queries/023_customer_last_visit.sql`
- Create: `src/lib/customers/migration-023.test.ts`
- Modify: `src/lib/customers/contracts.ts`
- Modify: `src/lib/customers/repository.ts`
- Modify: `src/lib/customers/repository.test.ts`
- Modify: `src/lib/customers/service.ts`
- Modify: `src/lib/customers/service.test.ts`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `supabase/queries/README.md`
- Modify: `src/app/(dashboard)/incomes/new/page.tsx`
- Modify: `src/app/(dashboard)/incomes/new/page.test.tsx`

**Interfaces:**
- Produces partial index on customer/business date for active normal incomes.
- Produces `list_customers(actor_user_id uuid) returns jsonb` with `lastVisitBusinessDate`.
- Changes `CustomerRepository.list(actorId)` and `listCustomers(actor)` to use the canonical RPC.

- [ ] **Step 1: Write failing migration/repository tests**

```ts
expect(sql).toMatch(/create index[\s\S]*customer_id[\s\S]*business_date desc/i);
expect(sql).toMatch(/status = 'active'/i);
expect(sql).toMatch(/source_type = 'sale'/i);
expect(sql).toMatch(/create or replace function public\.list_customers/i);
expect(sql).not.toMatch(/_v2/i);
```

Repository fixture must map date/null and reject subscription-derived or sensitive extra fields.

- [ ] **Step 2: Run RED**

Run migration/repository/service tests.

- [ ] **Step 3: Implement indexed query and strict repository**

Use `distinct on (customer_id)` ordered by `business_date desc, created_at desc` over the partial index. Authorize the actor as an active non-deleted user before returning customers. Preserve the `021` role-scoped fixed-schedule projection and existing customer ordering. Update both the customer page service and income-entry catalog caller to pass the authenticated actor ID into `CustomerRepository.list(actorId)`.

- [ ] **Step 4: Add rollback acceptance**

Create an old active sale, newer voided sale and newest subscription; assert the old active sale wins. Reactivate/create a newer normal sale, assert it wins; void it, assert fallback to old. Assert a no-sale customer returns null.

- [ ] **Step 5: Run GREEN and commit**

Commit: `feat(customers): derive last visit from sales`

---

### Task 3: Render desktop and mobile last visit

**Files:**
- Modify: `src/components/customers/customers-view.tsx`
- Modify: `src/components/customers/customers-view.test.tsx`
- Modify: `src/app/(dashboard)/customers/page.tsx`
- Modify: `src/app/(dashboard)/customers/page.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Assert desktop column `Última visita`, visible `15/08/2026 · hace 6 días`, mobile equivalent, `Sin visitas`, and no price/payment/employee leakage. Freeze `today` through an injected formatter input or deterministic helper.

- [ ] **Step 2: Run RED**

Run customer view/page tests.

- [ ] **Step 3: Implement responsive presentation**

Add the column without removing visits count or fixed schedule. On mobile, place last visit beneath visit count using short copy. Calculate Buenos Aires today on the server page and pass only the date string.

- [ ] **Step 4: Run GREEN and commit**

Commit: `feat(customers): show last visit in directory`

---

### Task 4: Verify and document block 023

**Files:**
- Modify: `AGENTS.md`
- Modify: `product.md`
- Modify: `context_snapshot.md`
- Modify: `supabase/queries/README.md`

- [ ] **Step 1: Record query-derived last-visit invariant and migration order**

- [ ] **Step 2: Run full verification**

```bash
npm test
npm run lint
npx next typegen
npx tsc --noEmit
npm run build -- --webpack
git diff --check
```

- [ ] **Step 3: Apply `023` when authorized and run rollback acceptance**

- [ ] **Step 4: Validate desktop and 390x844 customer directory**

- [ ] **Step 5: Commit**

Commit: `docs(customers): record last visit rollout`
