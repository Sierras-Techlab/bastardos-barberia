# Role-aware Incomes View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt `/incomes` so employees see only personal sales metrics without an employee filter, while owner/admin users can inspect all employees and view gross, commission and barbershop-net economics in desktop and mobile presentations.

**Architecture:** Extend the browser presentation types with optional V2 payment, registrator and commission snapshots while preserving legacy responses. Centralize role-aware query construction and metric-card composition in pure helpers, then render the same semantics through the existing desktop table, mobile list and detail sheet. Server authorization remains mandatory and unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Tailwind CSS, existing shadcn/base-ui primitives, TanStack Table, Vitest and Testing Library.

## Global Constraints

- Do not modify `src/app/api`, server services/repositories, `supabase/queries` or Supabase.
- Keep desktop table and mobile card presentations.
- Employee queries never contain a frontend-controlled `userId`; the server remains responsible for self-only authorization.
- Owner/admin may use an empty employee filter for all sales or a UUID for one employee.
- Never invent zero commission for legacy responses; display `Pendiente de backend`.
- Do not expose barbershop net to employee users.
- Preserve current loading, error, empty, pagination and void behavior.
- Use arrow functions for new application helpers and components.

---

### Task 1: V2 income presentation contracts and adapters

**Files:**
- Modify: `src/types/income.ts`
- Create: `src/lib/incomes/income-presentation.ts`
- Test: `src/lib/incomes/income-presentation.test.ts`

**Interfaces:**
- `IncomeListItem.registeredBy?: Employee`
- `IncomeListItem.payments?: IncomePayment[]`
- `IncomeListItem.commission?: IncomeCommissionSnapshot`
- `IncomeListMetrics.commissionTotal?: number`
- `IncomeListMetrics.barbershopNet?: number`
- `getIncomePaymentLabel(income): "Efectivo" | "Transferencia" | "Combinado"`
- `getIncomeCommissionState(income): { available: boolean; amount: number | null }`

- [x] Write tests proving one payment renders its method, two payments render `Combinado`, commission snapshots expose their amount and legacy records remain unavailable.
- [x] Run `npm test -- src/lib/incomes/income-presentation.test.ts` and verify RED because the helpers do not exist.
- [x] Add the optional V2 presentation fields and minimal pure adapters without changing server response schemas.
- [x] Run the focused test and verify GREEN.
- [x] Commit only Task 1 files with `feat(incomes): add v2 history presentation contract`.

### Task 2: Role-safe filters and queries

**Files:**
- Create: `src/lib/incomes/income-view-query.ts`
- Test: `src/lib/incomes/income-view-query.test.ts`
- Modify: `src/components/incomes/incomes-view.tsx`
- Modify: `src/components/incomes/incomes-view.test.tsx`
- Modify: `src/components/incomes/income-filters.tsx`
- Modify: `src/components/incomes/income-filters.test.tsx`

**Interfaces:**
- `toRoleSafeIncomeQuery(filters, role, page, pageSize): IncomeListQuery`
- `IncomeFilters` receives `canFilterEmployees: boolean` instead of inferring authorization from copy or employee data.

- [x] Write pure tests showing employee filters always omit `userId`, including malicious initial values, while owner/admin queries include a selected UUID and omit it for `Todos`.
- [x] Write component tests showing only managers receive the employee controls in desktop and mobile filters.
- [x] Run query, filter and view tests and verify RED.
- [x] Implement the pure query builder, sanitize employee initial filters and use `canViewAll` as the explicit filter capability.
- [x] Keep date, search, payment, kind, status, pagination and clearing behavior unchanged.
- [x] Run focused tests and verify GREEN.
- [x] Commit Task 2 files with `feat(incomes): enforce role-aware history filters`.

### Task 3: Metrics adapted to employee and manager audiences

**Files:**
- Create: `src/lib/incomes/income-metric-cards.ts`
- Test: `src/lib/incomes/income-metric-cards.test.ts`
- Modify: `src/components/incomes/income-metrics.tsx`
- Modify: `src/components/incomes/income-metrics.test.tsx`
- Modify: `src/components/incomes/incomes-view.tsx`

**Interfaces:**
- `buildIncomeMetricCards(metrics, role)` returns exactly four cards.
- Employee cards: `Total vendido`, `Mi comisión`, `Ventas`, `Promedio por venta`.
- Manager cards: `Facturación bruta`, `Comisiones`, `Neto barbería`, `Ventas`.
- Missing commission/net values use `Pendiente de backend` and never `0`.

- [x] Write failing pure and component tests for both role variants and legacy unavailable values.
- [x] Run metric tests and verify RED.
- [x] Move card selection to the pure helper and pass `currentUser.role` from `IncomesView`.
- [x] Preserve current responsive grid, visual tones and hover behavior.
- [x] Run focused tests and verify GREEN.
- [x] Commit Task 3 files with `feat(incomes): tailor metrics by role`.

### Task 4: Desktop table and mobile list V2 economics

**Files:**
- Modify: `src/components/incomes/income-table.tsx`
- Modify: `src/components/incomes/income-table.test.tsx`
- Modify: `src/components/incomes/income-mobile-list.tsx`
- Modify: `src/components/incomes/income-mobile-list.test.tsx`

**Interfaces:**
- Both presentations consume `getIncomePaymentLabel` and optional commission snapshots.
- Desktop columns show responsible employee, payment label, total and commission.
- Mobile cards show responsible employee, payment label, total and a compact commission line.
- Legacy commission renders `Pendiente de backend`.

- [x] Write failing tests for cash, transfer, combined payments, available commission, legacy fallback and voided styling in both layouts.
- [x] Run table/mobile tests and verify RED.
- [x] Implement compact columns and card content without exposing registrator/net in the list.
- [x] Ensure small screens remain readable without horizontal overflow.
- [x] Run focused tests and verify GREEN.
- [x] Commit Task 4 files with `feat(incomes): show payments and commissions in history`.

### Task 5: Role-aware V2 income detail

**Files:**
- Modify: `src/components/incomes/income-detail-sheet.tsx`
- Modify: `src/components/incomes/income-detail-sheet.test.tsx`
- Modify: `src/components/incomes/incomes-view.tsx`

**Interfaces:**
- `IncomeDetailSheet` receives `viewerRole: UserRole`.
- Every role sees responsible employee, individual payments and accrued commission.
- Owner/admin additionally see registering user and barbershop net.
- Legacy fields render `Pendiente de backend`.
- Voided entries label economics as excluded from active metrics while retaining snapshots.

- [x] Write failing tests for employee visibility, manager-only registrator/net, split payment rows, 100%-service snapshot, legacy fallback and voided copy.
- [x] Run detail tests and verify RED.
- [x] Implement the role-aware sections and pass the authenticated role from `IncomesView`.
- [x] Preserve existing read-only/void actions and sheet close behavior.
- [x] Run focused tests and verify GREEN.
- [x] Commit Task 5 files with `feat(incomes): expand role-aware sale detail`.

### Task 6: Durable documentation and complete verification

**Files:**
- Modify: `context_snapshot.md`
- Modify: `product.md`
- Modify: `docs/superpowers/plans/2026-08-12-role-aware-incomes-view.md`

**Interfaces:**
- Document frontend readiness and backend V2 dependency without claiming persistence exists.

- [x] Update context and product status with the role-specific metric visibility and dual desktop/mobile history presentation.
- [x] Mark completed plan checkboxes and scan the plan for placeholders or contradictory backend claims.
- [x] Run all modified income component and pure-helper tests and require zero failures.
- [x] Run `npm test` and require zero failures.
- [x] Run `npm run lint` and require zero errors or warnings.
- [x] Run `npm run build -- --webpack` and require a successful production build.
- [x] Run `git diff --check` and require no whitespace errors.
- [x] Confirm `git diff --name-only` contains no `src/app/api`, server repository/service or `supabase/queries` changes.
- [x] Commit documentation with `docs(incomes): update role-aware history status`.
