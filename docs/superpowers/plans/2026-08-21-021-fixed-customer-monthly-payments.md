# Fixed Customer Monthly Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assign each fixed customer to one professional with a monthly price, scope employee agendas to their own customers and make paid/pending status create or void a real subscription income atomically.

**Architecture:** Effective-dated fixed-schedule versions gain responsible professional and monthly price. A separate monthly-payment domain exposes derived pending/paid state; canonical `pay_fixed_customer_month` creates a `fixed_subscription` income, payments, work-session link and commission in one transaction, while voiding the linked income reopens the month without deleting attempts.

**Tech Stack:** PostgreSQL PL/pgSQL, Supabase RPC, Next.js 16 Route Handlers, React 19, strict TypeScript, Zod, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-21-operational-control-and-employee-privacy-design.md`

## Global Constraints

- Run after migration `020` and reuse its exact manager/employee payment modes and privacy projections.
- Every active fixed schedule has one active responsible user and a positive integer monthly ARS price.
- Employee-created schedules are forced to that employee; only owner/admin may assign or reassign another professional.
- Employees read only fixed schedules/occurrences/months currently assigned to themselves; managers may filter all.
- Reassignment affects unpaid future collections; paid snapshots never change.
- Monthly commission uses the professional's current service commission rate at payment time.
- Payment creates one real `fixed_subscription` income and daily cash effect; it never creates a customer visit.
- Employee collection requires an open work session; manager collection without one is audited outside-session.
- No subscription-specific commission setting and no `_v2` object.

---

### Task 1: Extend fixed-schedule contracts and customer authorization

**Files:**
- Modify: `src/types/fixed-customer.ts`
- Modify: `src/types/customer.ts`
- Modify: `src/lib/customers/schemas.ts`
- Modify: `src/lib/customers/service.ts`
- Modify: `src/lib/customers/service.test.ts`
- Modify: `src/lib/customers/contracts.ts`
- Modify: `src/lib/customers/repository.ts`
- Modify: `src/lib/customers/repository.test.ts`
- Modify: `src/lib/customers/frontend-customer-contracts.ts`
- Modify: `src/lib/customers/frontend-customer-contracts.test.ts`

**Interfaces:**

```ts
export type FixedSchedule = {
  weekday: IsoWeekday;
  time: string;
  responsibleProfessional: { id: string; firstName: string; lastName: string };
  monthlyPrice: number;
};

export type FixedScheduleInput = {
  weekday: IsoWeekday;
  time: string;
  responsibleUserId?: string;
  monthlyPrice: number;
};
```

- [ ] **Step 1: Write failing role and validation tests**

Reject zero/negative/non-integer monthly price and inactive responsible UUIDs. Assert employee create/update strips any submitted `responsibleUserId` and uses actor ID; employee cannot modify a schedule owned by another employee; manager may reassign.

- [ ] **Step 2: Run RED**

Run the customer schema/service/repository/frontend-contract tests.

- [ ] **Step 3: Implement actor-aware contracts**

Change repository calls to pass `actor_user_id` into canonical customer RPCs. Service provides the actor role; PostgreSQL remains authoritative for forced-self and reassignment authorization. Keep existing optimistic `expectedScheduleVersion` behavior.

- [ ] **Step 4: Run GREEN and commit**

Commit: `feat(customers): assign fixed schedules to professionals`

---

### Task 2: Define the monthly-payment domain

**Files:**
- Create: `src/types/fixed-customer-payment.ts`
- Create: `src/lib/fixed-customer-payments/contracts.ts`
- Create: `src/lib/fixed-customer-payments/schemas.ts`
- Create: `src/lib/fixed-customer-payments/schemas.test.ts`
- Create: `src/lib/fixed-customer-payments/service.ts`
- Create: `src/lib/fixed-customer-payments/service.test.ts`

**Interfaces:**

```ts
type FixedCustomerMonthBase = {
  customer: { id: string; firstName: string; lastName: string };
  responsibleProfessional: { id: string; firstName: string; lastName: string };
  period: string; // YYYY-MM
  status: "pending" | "paid";
  paidAt: string | null;
  incomeId: string | null;
  employeeEarning: number;
};

type EmployeeFixedCustomerMonth = FixedCustomerMonthBase & { viewer: "employee" };
type ManagerFixedCustomerMonth = FixedCustomerMonthBase & {
  viewer: "manager";
  monthlyPrice: number;
};

type PayFixedCustomerMonthInput = {
  requestId: string;
  customerId: string;
  period: string;
  payments: ManagerPaymentInput[] | EmployeePaymentInput[];
};
```

- [ ] **Step 1: Write failing schema/service tests**

Test strict `YYYY-MM`, future/past month acceptance, duplicate payment methods, exact-versus-basis-point role modes, employee forced scope, manager filter scope and employee response rejection when `monthlyPrice` or payment amounts appear.

- [ ] **Step 2: Run RED**

Run `npm test -- src/lib/fixed-customer-payments`.

- [ ] **Step 3: Implement schemas and services**

Expose `listFixedCustomerMonths(actor, query)`, `payFixedCustomerMonth(actor, input)` and `getFixedCustomerMonth`. Use distinct Zod response schemas for managers and employees.

- [ ] **Step 4: Run GREEN and commit**

Commit: `feat(customers): add monthly payment domain`

---

### Task 3: Add migration 021 and repository adapters

**Files:**
- Create: `supabase/queries/021_fixed_customer_monthly_payments.sql`
- Create: `src/lib/fixed-customer-payments/migration-021.test.ts`
- Create: `src/lib/fixed-customer-payments/repository.ts`
- Create: `src/lib/fixed-customer-payments/repository.test.ts`
- Modify: `src/lib/fixed-customers/repository.ts`
- Modify: `src/lib/fixed-customers/repository.test.ts`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `supabase/queries/README.md`

**Interfaces:**
- Adds responsible/monthly-price snapshots to schedule versions.
- Adds `incomes.source_type` with `sale | fixed_subscription` and subscription reference metadata.
- Creates append-only `fixed_customer_monthly_payment_attempts` with one active attempt per customer/period.
- Produces `list_fixed_customer_months`, `pay_fixed_customer_month` and role-scoped fixed-occurrence/customer RPC projections.

- [ ] **Step 1: Write failing structural tests**

Assert effective-dated responsible/price columns, positive-price constraint, payment-attempt unique active index, subscription source check, idempotency, customer/schedule/user/work-session/payment-method locks, service-rate commission and no insert/update of customer visits. Assert no `_v2` names.

- [ ] **Step 2: Run RED**

Run migration/repository/fixed-occurrence tests.

- [ ] **Step 3: Implement migration preflight and schema**

Before applying remotely, run the README preflight query for active legacy schedules. Do not invent professional or monthly price. If rows exist, record their customer IDs and have a manager remove/recreate or explicitly map them before executing `021`; the migration aborts with `LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED` rather than silently assigning money.

New/updated schedule versions require an eligible professional and positive monthly price. Historical versions remain referenced by paid attempts.

- [ ] **Step 4: Implement atomic payment RPC**

Lock customer, current schedule, responsible user, period and payment methods. Calculate:

```sql
commission_amount := round(monthly_price::numeric * service_commission_rate / 100)::bigint;
barbershop_net := monthly_price - commission_amount;
```

Insert an income with `source_type = 'fixed_subscription'`, no service/product item and a subscription concept snapshot. Reuse `019` session attachment rules and `020` payment allocation/privacy functions. Link the attempt to the income. Same request returns the same result; another active payment returns `FIXED_MONTH_ALREADY_PAID`.

- [ ] **Step 5: Integrate voiding**

Extend canonical `void_income` transactionally so a linked active attempt receives `voided_at/voided_by`; derived month status becomes pending. Preserve the attempt and permit a later new request.

- [ ] **Step 6: Add rollback-wrapped acceptance and run GREEN**

Cover manager/employee payment modes, employee session required, owner/employee rates, reassignment before unpaid collection, duplicate/retry, void/re-pay, cash totals and unchanged visits.

Commit: `feat(customers): persist monthly subscription payments`

---

### Task 4: Integrate subscriptions into income, dashboard and cash projections

**Files:**
- Modify: `src/types/income.ts`
- Modify: `src/lib/incomes/contracts.ts`
- Modify: `src/lib/incomes/repository.ts`
- Modify: `src/lib/incomes/repository.test.ts`
- Modify: `src/lib/incomes/income-presentation.ts`
- Modify: `src/lib/incomes/income-presentation.test.ts`
- Modify: `src/components/incomes/income-table.tsx`
- Modify: `src/components/incomes/income-table.test.tsx`
- Modify: `src/components/incomes/income-mobile-list.tsx`
- Modify: `src/components/incomes/income-mobile-list.test.tsx`
- Modify: `src/components/incomes/income-detail-sheet.tsx`
- Modify: `src/components/incomes/income-detail-sheet.test.tsx`
- Modify: `src/lib/dashboard/income-summary.ts`
- Modify: `src/lib/dashboard/income-summary.test.ts`
- Modify: `src/types/cash.ts`
- Modify: `src/lib/cash/schemas.ts`
- Modify: `src/lib/cash/schemas.test.ts`
- Modify: `src/components/cash/cash-sales-audit.tsx`
- Modify: `src/components/cash/cash-view.test.tsx`

**Interfaces:**
- Extends `IncomeSourceType` with `sale | fixed_subscription` and the visible composition kind with `subscription`.
- Adds a subscription concept snapshot `{ period, label, employeeEarning }` to employee income JSON and `{ period, label, monthlyPrice, commission, barbershopNet }` to manager JSON.

- [ ] **Step 1: Write failing projection tests**

Assert subscription income appears in role-scoped history, dashboard totals, exact work-session metrics and cash audit/payment totals. Employee list/detail shows `Mensualidad agosto 2026` plus own earning only; manager sees the full monthly economics. Customer visit history and visit counter remain unchanged.

- [ ] **Step 2: Run RED**

Run affected income/dashboard/cash/customer-visit tests.

- [ ] **Step 3: Implement strict subscription unions**

Do not fabricate a service item. Narrow on `sourceType`; render the immutable subscription concept and reuse aggregate commission/payment snapshots. Expand cash audit kind constraints/schemas to `subscription` while preserving dynamic payments.

- [ ] **Step 4: Run GREEN and commit**

Commit: `feat(incomes): integrate fixed subscription entries`

---

### Task 5: Expose monthly-payment APIs and client

**Files:**
- Create: `src/lib/fixed-customer-payments/client.ts`
- Create: `src/lib/fixed-customer-payments/client.test.ts`
- Create: `src/app/api/fixed-customer-months/route.ts`
- Create: `src/app/api/fixed-customer-months/route.test.ts`
- Create: `src/app/api/fixed-customer-months/pay/route.ts`
- Create: `src/app/api/fixed-customer-months/pay/route.test.ts`
- Modify: `src/app/api/fixed-customer-occurrences/route.ts`
- Modify: `src/app/api/fixed-customer-occurrences/route.test.ts`

**Interfaces:**
- Produces `fixedCustomerPaymentClient.list(query)` and `fixedCustomerPaymentClient.pay(input)` plus the authenticated GET/POST routes.
- Consumes exact `ManagerPaymentInput` and `EmployeePaymentInput` discriminants established by plan `020`.

- [ ] **Step 1: Read Next.js route guides and write failing tests**

Assert authorization precedes parsing, employee cannot supply another professional filter, browser never supplies actor/commission/price and clients use no-store list reads plus idempotent request IDs.

- [ ] **Step 2: Run RED**

Run the new route/client and occurrence route tests.

- [ ] **Step 3: Implement routes/client and run GREEN**

Use `GET /api/fixed-customer-months?period=YYYY-MM&employeeId=` and `POST /api/fixed-customer-months/pay`. Keep status derivation server-side.

- [ ] **Step 4: Commit**

Commit: `feat(customers): expose monthly payment API`

---

### Task 6: Add fixed-customer assignment and payment UI

**Files:**
- Modify: `src/components/customers/customer-editor-dialog.tsx`
- Modify: `src/components/customers/customer-editor-dialog.test.tsx`
- Modify: `src/components/customers/customers-view.tsx`
- Modify: `src/components/customers/customers-view.test.tsx`
- Modify: `src/components/dashboard/fixed-customers-card.tsx`
- Modify: `src/components/dashboard/fixed-customers-card.test.tsx`
- Create: `src/components/fixed-customers/fixed-customer-payment-dialog.tsx`
- Create: `src/components/fixed-customers/fixed-customer-payment-dialog.test.tsx`
- Modify: `src/app/(dashboard)/(home)/page.tsx`
- Modify: `src/app/(dashboard)/(home)/page.test.tsx`
- Modify: `src/app/(dashboard)/customers/page.tsx`
- Modify: `src/app/(dashboard)/customers/page.test.tsx`

**Interfaces:**
- Consumes the role-specific month projections and payment client from Tasks 2 and 5.
- Produces professional/monthly configuration in the existing customer modal and paid/pending collection actions in Customers and Inicio.

- [ ] **Step 1: Write failing UI tests**

Cover manager professional select and monthly price, employee forced-self schedule, employee agenda containing only own clients, period paid/pending badges, manager exact-payment dialog, employee percentage dialog showing only own earning, duplicate submission disabled and successful payment refreshing dashboard/customer state.

- [ ] **Step 2: Run RED**

Run the listed customer/fixed/dashboard tests.

- [ ] **Step 3: Implement role-aware editor and payment dialog**

Reuse payment-method cards but not the income form. The dialog receives a role-specific month projection; employee markup/props never contain manager monthly/payment totals. Confirmation copy states that marking paid creates an income and affects Caja.

- [ ] **Step 4: Run GREEN and commit**

Commit: `feat(customers): add fixed monthly payment workflow`

---

### Task 7: Verify and document block 021

**Files:**
- Modify: `AGENTS.md`
- Modify: `product.md`
- Modify: `context_snapshot.md`
- Modify: `supabase/queries/README.md`

- [ ] **Step 1: Document delivered ownership/payment rules and migration preflight**

- [ ] **Step 2: Run full verification**

```bash
npm test
npm run lint
npx next typegen
npx tsc --noEmit
npm run build -- --webpack
git diff --check
```

- [ ] **Step 3: Apply `021` when authorized and run rollback acceptance**

- [ ] **Step 4: Validate manager/employee desktop and 390x844 flows**

- [ ] **Step 5: Commit**

Commit: `docs(customers): record fixed monthly rollout`
