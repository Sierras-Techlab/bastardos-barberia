# Automatic Daily Cash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a manager-only `/cash` module with live current-day economics, automatic immutable historical closures, dynamic payment totals and auditable post-close void adjustments.

**Architecture:** Migration `018` owns authoritative calculations, insert-only snapshots, the post-close void trigger and the recovery-safe Supabase Cron closer. Next.js Route Handlers authorize before validation, a typed server repository validates database JSON with Zod, and a focused client workspace renders today plus selectable historical closures while reusing the existing income detail endpoint.

**Tech Stack:** PostgreSQL/Supabase SQL and pg_cron, Next.js 16 App Router and Route Handlers, React 19, TypeScript strict mode, Zod, Tailwind CSS, shadcn/base-ui, Vitest and Testing Library.

## Global Constraints

- Use `America/Argentina/Buenos_Aires` for cash business dates, identical to income `business_date`.
- Only `owner` and `admin` can access cash data at page, API, service and PostgreSQL boundaries.
- There is no manual open/close operation and no cash CRUD.
- Today's cash is live; dates before today are immutable snapshots created only when sales or adjustments exist.
- A same-day void contributes zero at close; a post-close void creates one negative adjustment without rewriting the original closure.
- Dynamic payment methods are keyed by UUID and retain immutable name snapshots.
- Run `018_automatic_daily_cash.sql` after the latest `017_product_category_deletion.sql`.
- Add no new npm dependency and never expose the Supabase secret to browser code.

---

### Task 1: Cash database contract and automatic closer

**Files:**
- Create: `supabase/queries/018_automatic_daily_cash.sql`
- Create: `src/lib/cash/migration-018.test.ts`
- Modify: `supabase/queries/README.md`

**Interfaces:**
- Consumes: `incomes`, `income_items`, `income_payments`, `payment_methods`, `users` and canonical `void_income` from migrations `009` through `016`.
- Produces: snapshot/adjustment tables plus `close_pending_daily_cash()`, `get_daily_cash(uuid,date)` and `list_daily_cash(uuid,date,date,integer,integer)`.

- [ ] **Step 1: Write the failing structural migration test**

Assert the SQL contains:

```ts
expect(sql).toMatch(/create table public\.daily_cash_registers/i);
expect(sql).toMatch(/business_date date not null unique/i);
expect(sql).toMatch(/create table public\.daily_cash_sales/i);
expect(sql).toMatch(/create table public\.daily_cash_payment_totals/i);
expect(sql).toMatch(/create table public\.daily_cash_adjustments/i);
expect(sql).toMatch(/create table public\.daily_cash_adjustment_payments/i);
expect(sql).toContain("America/Argentina/Buenos_Aires");
expect(sql).toMatch(/old\.status = 'active'[\s\S]*new\.status = 'voided'/i);
expect(sql).toMatch(/pg_advisory_xact_lock/i);
expect(sql).toMatch(/create or replace function public\.get_daily_cash/i);
expect(sql).toMatch(/create or replace function public\.list_daily_cash/i);
expect(sql).toMatch(/cron\.schedule/i);
expect(sql).toMatch(/alter table public\.daily_cash_registers enable row level security/i);
expect(sql).toMatch(/grant execute[\s\S]*to service_role/i);
```

- [ ] **Step 2: Run the test and verify RED**

Run `npm test -- src/lib/cash/migration-018.test.ts`.

Expected: FAIL because migration `018` does not exist.

- [ ] **Step 3: Implement the transactional migration**

Use bigint amounts and checks enforcing:

```sql
sales_gross_total >= 0
sales_commission_total >= 0
sales_barbershop_net >= 0
sales_barbershop_net + sales_commission_total = sales_gross_total
adjustment_gross_total <= 0
adjustment_commission_total <= 0
adjustment_barbershop_net <= 0
adjustment_barbershop_net + adjustment_commission_total = adjustment_gross_total
```

The post-close trigger must insert exactly once through `unique(source_income_id)`. The closer must lock once, select missing dates `< current local date` from the union of incomes and adjustments, insert all sale memberships, aggregate only active-at-close sales into economics, include adjustment deltas, and materialize per-method sales/adjustment/net values.

Schedule:

```sql
create extension if not exists pg_cron;
select cron.schedule(
  'bastardos-close-daily-cash',
  '0 * * * *',
  'select public.close_pending_daily_cash();'
);
```

Remove an existing job with that name before scheduling so rerunning `018` is idempotent.

- [ ] **Step 4: Add rollback-wrapped acceptance checks**

Document a transaction that creates a split-payment active sale, a same-day voided sale, closes the date twice, asserts one register and stable totals, voids the active sale after closure, asserts one adjustment, and rolls back.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- src/lib/cash/migration-018.test.ts
git diff --check
```

Commit: `feat(cash): add automatic daily closure migration`

---

### Task 2: Strict cash types, schemas and server repository

**Files:**
- Create: `src/types/cash.ts`
- Create: `src/lib/cash/contracts.ts`
- Create: `src/lib/cash/schemas.ts`
- Create: `src/lib/cash/schemas.test.ts`
- Create: `src/lib/cash/repository.ts`
- Create: `src/lib/cash/repository.test.ts`
- Create: `src/lib/cash/date.ts`
- Create: `src/lib/cash/date.test.ts`

**Interfaces:**
- Produces `CashDay`, `CashHistoryItem`, `CashHistoryQuery`, `PaginatedCashHistory`, `cashRepository.getDay(actorId,date)` and `cashRepository.list(actorId,query)`.

- [ ] **Step 1: Write failing schema and repository tests**

Use this public shape:

```ts
type CashDay = {
  id: string | null;
  businessDate: string;
  state: "live" | "closed";
  closedAt: string | null;
  summary: CashSummary;
  payments: CashPaymentTotal[];
  sales: CashSaleAuditItem[];
  adjustments: CashAdjustment[];
};

type CashSummary = {
  salesGrossTotal: number;
  salesCommissionTotal: number;
  salesBarbershopNet: number;
  adjustmentGrossTotal: number;
  adjustmentCommissionTotal: number;
  adjustmentBarbershopNet: number;
  grossTotal: number;
  commissionTotal: number;
  barbershopNet: number;
  serviceTotal: number;
  productTotal: number;
  saleCount: number;
  activeSaleCount: number;
  voidedSaleCount: number;
  adjustmentCount: number;
};

type CashPaymentTotal = {
  paymentMethodId: string;
  name: string;
  salesAmount: number;
  adjustmentAmount: number;
  netAmount: number;
};

type CashSaleAuditItem = {
  id: string;
  createdAt: string;
  employee: { id: string; firstName: string; lastName: string };
  customerName: string | null;
  kind: "service" | "products" | "combined";
  statusAtClose: "active" | "voided";
  currentStatus: "active" | "voided";
  grossTotal: number;
  commissionTotal: number;
  barbershopNet: number;
};

type CashAdjustment = {
  id: string;
  sourceIncomeId: string;
  originalBusinessDate: string;
  createdAt: string;
  createdBy: { id: string; firstName: string; lastName: string };
  grossDelta: number;
  commissionDelta: number;
  barbershopNetDelta: number;
};
```

Tests must reject unknown keys, invalid dates, positive adjustment deltas, broken net identities and an employee-shaped actor chosen by a browser payload.

- [ ] **Step 2: Verify RED**

Run `npm test -- src/lib/cash` and confirm missing-module failures.

- [ ] **Step 3: Implement schemas and repository**

Repository RPC calls:

```ts
getSupabaseAdmin().rpc("get_daily_cash", {
  requesting_user_id: actorId,
  target_business_date: date,
});

getSupabaseAdmin().rpc("list_daily_cash", {
  requesting_user_id: actorId,
  filter_date_from: query.dateFrom ?? null,
  filter_date_to: query.dateTo ?? null,
  page_number: query.page,
  page_size: query.pageSize,
});
```

Validate every RPC response with Zod and map `MANAGER_REQUIRED`, invalid date and missing day to stable `AppError` values.

- [ ] **Step 4: Implement local date helper**

`getBuenosAiresToday(now = new Date()): string` must use `Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" })` and have UTC-boundary tests.

- [ ] **Step 5: Verify and commit**

Run `npm test -- src/lib/cash` and `npx tsc --noEmit`.

Commit: `feat(cash): add strict cash data boundary`

---

### Task 3: Manager service, Route Handlers and browser client

**Files:**
- Create: `src/lib/cash/service.ts`
- Create: `src/lib/cash/service.test.ts`
- Create: `src/lib/cash/client.ts`
- Create: `src/lib/cash/client.test.ts`
- Create: `src/app/api/cash/route.ts`
- Create: `src/app/api/cash/route.test.ts`
- Create: `src/app/api/cash/history/route.ts`
- Create: `src/app/api/cash/history/route.test.ts`

**Interfaces:**
- Produces `getCashDay(actor,date)`, `listCashHistory(actor,query)` and `cashClient` with no-store reads.

- [ ] **Step 1: Write failing authorization and transport tests**

Assert:

```ts
await expect(getCashDay(employee, "2026-08-15", deps))
  .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
expect(requireManager.mock.invocationCallOrder[0])
  .toBeLessThan(repositoryCall.mock.invocationCallOrder[0]);
expect(fetch).toHaveBeenCalledWith(
  "/api/cash?date=2026-08-15",
  { cache: "no-store" },
);
```

- [ ] **Step 2: Verify RED**

Run `npm test -- src/lib/cash src/app/api/cash`.

- [ ] **Step 3: Implement service and routes**

Both services call `assertManager(actor)` before persistence. Both routes call `requireManager()` before parsing URL input. `GET /api/cash` defaults date to `getBuenosAiresToday()` only when omitted; history defaults to page 1 and pageSize 10.

- [ ] **Step 4: Implement no-store client**

Reuse the existing `{data}` / `{error}` contract and expose structured errors without any mutation method.

- [ ] **Step 5: Verify and commit**

Run `npm test -- src/lib/cash src/app/api/cash` and `npx tsc --noEmit`.

Commit: `feat(cash): expose manager cash API`

---

### Task 4: Responsive cash workspace and navigation

**Files:**
- Create: `src/app/(dashboard)/cash/page.tsx`
- Create: `src/app/(dashboard)/cash/page.test.tsx`
- Create: `src/app/(dashboard)/cash/loading.tsx`
- Create: `src/app/(dashboard)/cash/loading.test.tsx`
- Create: `src/app/(dashboard)/cash/error.tsx`
- Create: `src/app/(dashboard)/cash/error.test.tsx`
- Create: `src/components/cash/cash-view.tsx`
- Create: `src/components/cash/cash-view.test.tsx`
- Create: `src/components/cash/cash-summary-cards.tsx`
- Create: `src/components/cash/cash-payment-breakdown.tsx`
- Create: `src/components/cash/cash-sales-audit.tsx`
- Create: `src/components/cash/cash-history-table.tsx`
- Modify: `src/components/app-sidebar.tsx`
- Modify: `src/components/app-sidebar.test.tsx`

**Interfaces:**
- Consumes: initial `CashDay`, `PaginatedCashHistory`, `cashClient`, `incomeClient.get()` and `IncomeDetailSheet`.
- Produces: manager page `/cash` and active sidebar link.

- [ ] **Step 1: Write failing page, navigation and workspace tests**

Cover:

```ts
expect(screen.getByRole("link", { name: "Cargar ingreso" }))
  .toHaveAttribute("href", "/incomes/new");
expect(screen.getByText("Caja de hoy")).toBeVisible();
expect(screen.getByText("Cierre guardado")).toBeVisible();
expect(screen.getByText("Efectivo")).toBeVisible();
expect(screen.getByRole("table", { name: "Ventas de la caja" })).toBeVisible();
expect(screen.getByRole("table", { name: "Historial de cajas" })).toBeVisible();
```

Assert employees never receive the Caja navigation link and manager pathname `/cash` is active.

- [ ] **Step 2: Verify RED**

Run `npm test -- src/components/cash src/app/'(dashboard)'/cash src/components/app-sidebar.test.tsx`.

- [ ] **Step 3: Implement the server page and boundaries**

The page calls `requirePageUser()`, asserts manager access, loads today and history in parallel and passes serializable data into a focused client workspace. `loading.tsx` uses the shared centered dashboard loader pattern. `error.tsx` is a Client Component and calls `retry()`.

- [ ] **Step 4: Implement the visual workspace**

Use existing `Card`, `Button`, table/sheet primitives and Bastardos colors. Keep the three primary economics cards compact, render payment methods from data, show adjustments only when nonzero, render desktop table plus mobile list, and load an income detail on selection through `incomeClient.get(id)`.

- [ ] **Step 5: Verify and commit**

Run focused tests, ESLint and TypeScript.

Commit: `feat(cash): add automatic cash workspace`

---

### Task 5: Documentation, database validation and complete verification

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `product.md`
- Modify: `context_snapshot.md`
- Modify: `supabase/queries/README.md`

**Interfaces:**
- Produces the deployment handoff for migration `018` and records cash invariants.

- [ ] **Step 1: Update durable documentation**

Document ordered migration `018`, pg_cron ownership, manager-only visibility, immutable closures, post-close adjustments, `/cash`, `/api/cash`, `/api/cash/history` and the fact that Expenses remain separate.

- [ ] **Step 2: Run SQL acceptance against Supabase when authorized**

Execute the latest pending migrations in order, then run the rollback-wrapped `018` acceptance block. Confirm the cron job exists and no sample rows remain after rollback.

- [ ] **Step 3: Run complete verification**

```bash
npm test
npm run lint
npx next typegen
npx tsc --noEmit
npm run build -- --webpack
git diff --check
```

- [ ] **Step 4: Validate UI at desktop and 390×844**

Confirm no horizontal overflow, readable live/closed states, dynamic payment totals, historical date selection, sale detail and manager-only navigation.

- [ ] **Step 5: Commit**

Commit: `docs(cash): record automatic closure rollout`
