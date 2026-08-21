# Manual Cash Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Caja into a manager-controlled opening and reconciliation lifecycle while retaining automatic first-income opening and automatic pending-confirmation closing.

**Architecture:** Migration `022` evolves canonical `daily_cash_registers` with opening, closure mode and reconciliation fields. Normal and subscription incomes call one protected database helper that opens today's register at zero when absent; closing freezes the existing `018` snapshots, while later confirmation appends counted-cash facts without recomputing financial totals.

**Tech Stack:** PostgreSQL/Supabase SQL and pg_cron, Next.js 16 Route Handlers, React 19, strict TypeScript, Zod, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-21-operational-control-and-employee-privacy-design.md`

## Global Constraints

- Run after migration `021` and cover both normal and subscription incomes.
- Only owner/admin open, manually close, confirm or view Caja.
- Opening balance is non-negative physical cash; it is never revenue, payment, commission or sale.
- The first committed income opens the current register at ARS 0 when absent.
- Only protected semantic payment method `Efectivo` affects expected physical cash.
- Manual close requires counted cash and is immediately confirmed.
- Automatic close snapshots finance but remains `pending_confirmation` until counted cash is supplied.
- Closed financial snapshots remain immutable; confirmation never recomputes them.
- No parallel/version-suffixed cash table or RPC.

---

### Task 1: Define cash lifecycle contracts and calculations

**Files:**
- Modify: `src/types/cash.ts`
- Modify: `src/lib/cash/contracts.ts`
- Modify: `src/lib/cash/schemas.ts`
- Modify: `src/lib/cash/schemas.test.ts`
- Create: `src/lib/cash/reconciliation.ts`
- Create: `src/lib/cash/reconciliation.test.ts`
- Modify: `src/lib/cash/service.ts`
- Modify: `src/lib/cash/service.test.ts`

**Interfaces:**

```ts
type CashState = "not_open" | "open" | "closed";
type CashOpeningSource = "manual" | "first_income";
type CashCloseMode = "manual" | "automatic";
type CashReconciliationState = "not_applicable" | "pending_confirmation" | "confirmed";

type CashLifecycle = {
  openingBalance: number;
  openingSource: CashOpeningSource | null;
  openedAt: string | null;
  openedBy: CashPerson | null;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  closeMode: CashCloseMode | null;
  reconciliationState: CashReconciliationState;
};
```

- [ ] **Step 1: Write failing lifecycle tests**

Reject negative opening/count, invalid state/field combinations, counted cash on an open day, confirmed without count/difference and mismatched `difference`. Test `expectedCash = openingBalance + Efectivo netAmount` and prove transfer/QR are ignored.

- [ ] **Step 2: Run RED**

Run cash schema/reconciliation/service tests.

- [ ] **Step 3: Implement strict types/services**

Add manager-only `openCash(actor,{openingBalance})`, `closeCash(actor,{countedCash})`, `confirmCash(actor,id,{countedCash})`. Repository remains authoritative; pure calculation exists only for display/test parity.

- [ ] **Step 4: Run GREEN and commit**

Commit: `feat(cash): define opening and reconciliation lifecycle`

---

### Task 2: Add migration 022 and repository mutations

**Files:**
- Create: `supabase/queries/022_manual_cash_lifecycle.sql`
- Create: `src/lib/cash/migration-022.test.ts`
- Modify: `src/lib/cash/repository.ts`
- Modify: `src/lib/cash/repository.test.ts`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `supabase/queries/README.md`
- Modify: `src/lib/payment-methods/repository.ts`
- Modify: `src/lib/payment-methods/repository.test.ts`
- Modify: `src/lib/payment-methods/service.ts`
- Modify: `src/lib/payment-methods/service.test.ts`

**Interfaces:**
- Evolves `daily_cash_registers` with opening/closing/reconciliation fields.
- Adds protected `payment_methods.system_code = 'cash'` for exactly one Efectivo record.
- Produces `open_daily_cash`, `close_daily_cash`, `confirm_daily_cash` and internal `ensure_daily_cash_open`.
- Promotes existing `get_daily_cash`, `list_daily_cash`, `close_pending_daily_cash` and cash JSON helpers with lifecycle output.

- [ ] **Step 1: Write failing structural/repository tests**

Assert migration alters, rather than duplicates, `daily_cash_registers`; identifies/protects one Efectivo method; opens from normal and subscription income transactions; snapshots only once; keeps cron; stores expected/count/difference; maps stable sentinels; and has no `_v2` identifiers.

- [ ] **Step 2: Run RED**

Run migration, cash repository and payment-method lifecycle tests.

- [ ] **Step 3: Implement safe evolution/backfill**

Backfill existing closed `018` registers with opening zero, `first_income`, automatic close and `pending_confirmation`; preserve all existing financial snapshots. Today's absence projects `not_open`; manually opened zero-activity days create a real register.

Migration preflight requires exactly one normalized payment method named `Efectivo`; otherwise abort with `CASH_PAYMENT_METHOD_REQUIRED`. Set `system_code='cash'` and reject rename/deactivate/delete in payment-method RPCs.

- [ ] **Step 4: Implement opening and closure functions**

`ensure_daily_cash_open(actor,date)` uses an advisory/date lock and this conflict-safe insert shape:

```sql
insert into public.daily_cash_registers (
  business_date, opening_balance, opening_source, opened_at, opened_by
) values (
  target_business_date, 0, 'first_income', now(), actor_user_id
)
on conflict (business_date) do nothing;
```

Manual conflicting balances raise `CASH_ALREADY_OPEN`. Manual/automatic close populate membership/payment snapshots using the `018` logic and calculate:

```sql
expected_cash := opening_balance + cash_sales_amount + cash_adjustment_amount;
difference := counted_cash - expected_cash;
```

Confirmation updates only reconciliation columns guarded by `pending_confirmation`.

- [ ] **Step 5: Wire income transactions**

Promote canonical normal `create_income`, `pay_fixed_customer_month` and the post-close adjustment branch of `void_income` so `ensure_daily_cash_open` runs in the same transaction after validations and before the financial inserts commit. A failed sale/payment/void must roll back an automatic opening. A void adjustment is an income-derived first movement and uses the same zero-balance `first_income` opening source.

- [ ] **Step 6: Add rollback acceptance and run GREEN**

Cover manual 0/10,000 opening, conflict, first-sale auto-open, failed-sale rollback, subscription opening, physical/nonphysical payments, zero-activity manual close, counted surplus/shortage, auto pending close, one-time confirmation and immutable finance.

Commit: `feat(cash): persist manual cash lifecycle`

---

### Task 3: Expose open, close and confirm APIs

**Files:**
- Modify: `src/lib/cash/client.ts`
- Modify: `src/lib/cash/client.test.ts`
- Create: `src/app/api/cash/open/route.ts`
- Create: `src/app/api/cash/open/route.test.ts`
- Create: `src/app/api/cash/close/route.ts`
- Create: `src/app/api/cash/close/route.test.ts`
- Create: `src/app/api/cash/[id]/confirm/route.ts`
- Create: `src/app/api/cash/[id]/confirm/route.test.ts`
- Modify: `src/app/api/cash/route.ts`
- Modify: `src/app/api/cash/route.test.ts`

- [ ] **Step 1: Read Next.js route docs and write failing tests**

Assert manager authorization before parsing, browser cannot submit date/actor/expected/difference, dynamic ID params are awaited and mutation clients parse strict updated `CashDay` responses.

- [ ] **Step 2: Run RED**

Run cash routes/client tests.

- [ ] **Step 3: Implement handlers/client**

Open body `{openingBalance}`, close/confirm body `{countedCash}`. All values are integers >= 0. Use current Buenos Aires date only for open/close.

- [ ] **Step 4: Run GREEN and commit**

Commit: `feat(cash): expose cash lifecycle API`

---

### Task 4: Build opening, closing and confirmation UI

**Files:**
- Modify: `src/components/cash/cash-view.tsx`
- Modify: `src/components/cash/cash-view.test.tsx`
- Modify: `src/components/cash/cash-summary-cards.tsx`
- Create: `src/components/cash/cash-open-dialog.tsx`
- Create: `src/components/cash/cash-open-dialog.test.tsx`
- Create: `src/components/cash/cash-close-dialog.tsx`
- Create: `src/components/cash/cash-close-dialog.test.tsx`
- Create: `src/components/cash/cash-confirm-dialog.tsx`
- Create: `src/components/cash/cash-confirm-dialog.test.tsx`
- Modify: `src/components/cash/cash-history-table.tsx`
- Modify: `src/app/(dashboard)/cash/page.tsx`
- Modify: `src/app/(dashboard)/cash/page.test.tsx`
- Modify: `src/app/(dashboard)/cash/loading.tsx`

- [ ] **Step 1: Write failing state-machine UI tests**

Cover `Caja sin abrir`, open at zero, opening balance input, `Abrir y cargar ingreso`, open badge, expected cash, manual counted close, surplus/shortage, automatic `Pendiente de confirmación`, confirmation and clear separation between saldo inicial and ventas.

- [ ] **Step 2: Run RED**

Run cash components/page tests.

- [ ] **Step 3: Implement dialogs and refreshed state**

Use one mutation at a time, disable duplicate submits, Sonner feedback and replace local `CashDay` with each API response. `Abrir y cargar ingreso` opens successfully before routing to `/incomes/new`.

- [ ] **Step 4: Implement reconciliation presentation**

Render opening, expected, counted and difference in a separate section. Never include opening balance in gross cards or payment breakdown. History badges distinguish manual confirmed, automatic pending and automatic confirmed.

- [ ] **Step 5: Run GREEN and commit**

Commit: `feat(cash): add manual reconciliation workspace`

---

### Task 5: Verify and document block 022

**Files:**
- Modify: `AGENTS.md`
- Modify: `product.md`
- Modify: `context_snapshot.md`
- Modify: `supabase/queries/README.md`

- [ ] **Step 1: Replace automatic/read-only Caja invariants with delivered lifecycle rules**

- [ ] **Step 2: Run full verification**

```bash
npm test
npm run lint
npx next typegen
npx tsc --noEmit
npm run build -- --webpack
git diff --check
```

- [ ] **Step 3: Apply `022` when authorized and run rollback acceptance**

- [ ] **Step 4: Validate desktop and 390x844 open/close/confirm flows**

- [ ] **Step 5: Commit**

Commit: `docs(cash): record manual lifecycle rollout`
