# Dashboard and Fixed Customers Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dashboard with an income summary, complete quick actions and weekly fixed-customer occurrences, while preparing customer create/edit contracts and the backend handoff without changing backend persistence.

**Architecture:** Add browser-only fixed-schedule contracts, validation and occurrence presentation helpers. Extend the customer editor through a frontend V2 adapter, then compose a simplified server dashboard from role-scoped income data plus an isolated fixed-customer fixture until the backend boundary exists. Keep future quick actions interactive through Sonner rather than dead links.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Zod 4, Tailwind CSS, existing shadcn/base-ui primitives, Sonner, Vitest and Testing Library.

## Global Constraints

- Do not modify `src/app/api`, server services/repositories, `supabase/queries` or Supabase.
- A customer has zero or one weekly schedule, never multiple schedules.
- Weekdays use ISO values `1` through `7`; time uses local `HH:mm` in `America/Argentina/Buenos_Aires`.
- Occurrence status is exactly `pending`, `attended` or `missed`.
- Attendance does not register payment or income and does not change future occurrences.
- All current customer-editor roles may configure a fixed schedule; backend authorization remains required.
- All roles see all quick actions; future actions show an accessible toast instead of using `href="#"`.
- Existing backend incompatibility must remain contextual and must never produce false success.
- Use arrow functions for application helpers and components.

---

### Task 1: Fixed-customer browser contracts and recurrence presentation

**Files:**
- Create: `src/types/fixed-customer.ts`
- Create: `src/lib/customers/fixed-customers.ts`
- Test: `src/lib/customers/fixed-customers.test.ts`
- Create: `src/lib/customers/frontend-customer-contracts.ts`
- Test: `src/lib/customers/frontend-customer-contracts.test.ts`

**Interfaces:**
- `FixedSchedule = { weekday: 1|2|3|4|5|6|7; time: string }`
- `FixedOccurrenceStatus = "pending" | "attended" | "missed"`
- `FixedCustomerOccurrence` contains occurrence ID, customer identity, `date`, `time` and status.
- `formatFixedSchedule(schedule)` returns `Todos los jueves a las 10:00`.
- `sortFixedOccurrences(occurrences)` sorts local date then time.
- `fixedScheduleSchema` accepts one ISO weekday and strict `HH:mm`.
- `FrontendCustomerEditorInput` adds `fixedSchedule: FixedSchedule | null` without changing server types.

- [x] Write failing tests for weekday copy, strict time validation, null schedule, occurrence sorting and immutable status replacement.
- [x] Run both focused files and verify RED because the browser domain does not exist.
- [x] Implement types, pure helpers and strict Zod contracts without importing server repositories or schemas.
- [x] Run focused tests and verify GREEN.

### Task 2: Customer create/edit weekly schedule controls

**Files:**
- Modify: `src/components/customers/customer-editor-dialog.tsx`
- Modify: `src/components/customers/customer-editor-dialog.test.tsx`
- Modify: `src/components/customers/customers-view.tsx`
- Modify: `src/components/customers/customers-view.test.tsx`
- Modify: `src/lib/customers/client.ts`
- Modify: `src/lib/customers/client.test.ts`

**Interfaces:**
- The editor state has `hasFixedSchedule`, `weekday` and `time`.
- Create always sends `fixedSchedule`, either a valid single schedule or `null`.
- Edit initializes legacy customers as no schedule and sends changes through frontend V2 input types.

- [x] Write failing tests for hidden controls by default, required day/time when enabled, readable recurrence preview, create/edit payloads and disabling the schedule.
- [x] Run dialog, view and client tests and verify RED.
- [x] Add an accessible switch/checkbox, weekday select, time input and preview panel to the existing dialog.
- [x] Preserve contact uniqueness, duplicate-submit lock, Sonner success and contextual backend errors.
- [x] Run focused tests and verify GREEN.

### Task 3: Fixed occurrences dashboard card

**Files:**
- Create: `src/data/fixed-customers.mock.json`
- Create: `src/components/dashboard/fixed-customers-card.tsx`
- Test: `src/components/dashboard/fixed-customers-card.test.tsx`

**Interfaces:**
- `FixedCustomersCard({ occurrences, onStatusChange })` shows sorted today/upcoming occurrences.
- Pending rows expose `Asistió` and `No asistió` actions.
- Confirmed rows render a status badge and do not expose one-click replacement controls.
- `onStatusChange(id, status)` only changes the selected occurrence in frontend state.

- [x] Write failing tests for sorting, empty state, pending controls, attended/missed badges and isolated occurrence changes.
- [x] Run the card test and verify RED.
- [x] Implement a client card with responsive rows, accessible action names and a `Ver todos` link to `/customers/fixed`.
- [x] Use the dedicated fixture only at dashboard composition; do not embed demo values in the component.
- [x] Run the focused test and verify GREEN.

### Task 4: Functional quick-actions dashboard card

**Files:**
- Create: `src/components/dashboard/quick-actions-card.tsx`
- Test: `src/components/dashboard/quick-actions-card.test.tsx`

**Interfaces:**
- Implemented actions use Next links: `/incomes/new`, `/incomes`, `/customers`, `/products`.
- `Registrar gasto` and `Cerrar caja` are buttons that call Sonner with `Esta función estará disponible próximamente`.
- All six actions are role-independent.

- [x] Write failing tests for six actions, four exact links, no `href="#"` and the future-action toast.
- [x] Run the card test and verify RED.
- [x] Implement the compact responsive action grid using existing Button/Link patterns and dashboard styling.
- [x] Run focused tests and verify GREEN.

### Task 5: Simplified role-aware home dashboard

**Files:**
- Create: `src/lib/dashboard/income-summary.ts`
- Test: `src/lib/dashboard/income-summary.test.ts`
- Create: `src/components/dashboard/income-summary-card.tsx`
- Test: `src/components/dashboard/income-summary-card.test.tsx`
- Modify: `src/app/(dashboard)/(home)/page.tsx`
- Modify: `src/app/(dashboard)/(home)/page.test.tsx`

**Interfaces:**
- The home page loads role-scoped income metrics for today and the last seven Buenos Aires business dates using existing read capabilities only.
- `IncomeSummaryCard` renders total today, count, average, payment distribution, seven-day bars and `Ver ingresos`.
- The home page composes exactly `IncomeSummaryCard`, `QuickActionsCard` and `FixedCustomersCard` below its compact header.

- [x] Write failing tests proving services/activity blocks are absent, the three approved blocks are present, employee data remains server-scoped and seven-day bars expose accessible daily values.
- [x] Run helper, card and page tests and verify RED.
- [x] Implement pure day-series normalization and the responsive layout: wide income summary plus actions/fixed-customer secondary column on desktop, stacked mobile layout.
- [x] Preserve session revalidation and the dashboard demonstration badge while the fixed-customer fixture remains active.
- [x] Run focused tests and verify GREEN.

### Task 6: Backend handoff and durable documentation

**Files:**
- Modify: `docs/backend-handoffs/2026-08-12-income-commissions-and-split-payments.md`
- Modify: `context_snapshot.md`
- Modify: `product.md`
- Modify: `docs/superpowers/plans/2026-08-12-dashboard-fixed-customers.md`

**Interfaces:**
- Add a self-contained `Clientes fijos` handoff section in Spanish.

- [x] Document the one-schedule-per-customer constraint, recurrence columns/table, occurrences table, status enum, Buenos Aires timezone and idempotent generation.
- [x] Specify frontend request/response examples, reading upcoming occurrences, manager/employee access, attendance audit and error codes.
- [x] Specify reschedule/deactivation semantics and backend tests, including warning that switching Git branches does not revert applied migrations.
- [x] Update context/product state as frontend prepared and backend integration pending.
- [x] Mark completed plan checkboxes and scan for placeholders or contradictory persistence claims.

### Task 7: Complete verification

**Files:**
- Review all files changed by Tasks 1 through 6.

- [x] Run all new and modified focused tests and require zero failures.
- [x] Run `npm test` and require zero failures.
- [x] Run `npm run lint` and require zero errors or warnings.
- [x] Run `npm run build -- --webpack` and require a successful production build.
- [x] Run `git diff --check` and require no whitespace errors.
- [x] Confirm `git diff --name-only` contains no `src/app/api`, server repository/service or `supabase/queries` change.
- [x] Review the final implementation against `docs/superpowers/specs/2026-08-12-dashboard-fixed-customers-design.md`.
