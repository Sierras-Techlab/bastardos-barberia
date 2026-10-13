# Employee Chair Rental Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hardening the existing chair-rental flow so Caja remains usable, agreement edits cannot race with loading, audit history is complete, and the desktop/mobile UI is clear.

**Architecture:** Keep the existing SQL and API contracts, add deterministic fixture cleanup in the acceptance harness, make the agreement dialog explicitly distinguish loading/error/loaded states, and keep responsive presentation logic in the existing user list and history/report components. Preserve recurring due days at 1..28.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Vitest, PostgreSQL/Supabase RPCs, Tailwind CSS.

**Spec:** `docs/tasks/TASK-02-employee-commercial-agreement-chair-rental.md` plus the reviewed implementation brief supplied in the user request.

## Global Constraints

- Work only on `codex/employee-chair-rental` and preserve existing uncommitted changes.
- `.env` targets the test database; do not apply SQL or repairs to production.
- Keep `chairRentalDueDay` constrained to `1..28`; do not invent end-of-month semantics.
- Keep owner-only mutations, immutable payment attempts, audit history, and report/Caja accounting invariants.
- Use strict existing schemas and `{ data }` / `{ error }` API envelopes.

## Review Focus

- A failed acceptance cleanup must not leave a `daily_cash_registers.opened_by` orphan; add cleanup verification.
- An agreement response arriving after another employee is opened must not replace the newer dialog state.
- A loaded agreement must never be presented as an empty default while saving is possible.
- A voided rental must show void date, actor, reason, payment date, method, and amount.
- Popovers and responsive rental summaries must not clip, shift the drawer horizontally, or duplicate desktop content.

### Task 1: Repair acceptance Caja fixture cleanup

**Files:**
- Modify: `scripts/system-concurrency-acceptance.ts`
- Test: `scripts/system-concurrency-acceptance.ts` acceptance assertions

**Interfaces:**
- Consumes: fixture IDs already tracked by `ids` and current chair-rental/Caja schema.
- Produces: repeatable cleanup with no orphaned daily cash rows.

- [ ] **Step 1: Add a failing cleanup assertion** for daily cash registers opened by fixture users and run `npm run acceptance:concurrency`; expected failure is the existing `23503`/orphan state.
- [ ] **Step 2: Trace every fixture-created cash row and dependency** through `confirm_chair_rental_payment`, `ensure_daily_cash_open`, and cleanup paths; include stale fixture cleanup.
- [ ] **Step 3: Implement targeted deletion/restoration** of fixture cash rows and dependent records before users are deleted, without broad date-based deletes.
- [ ] **Step 4: Add a post-cleanup assertion** that no `daily_cash_registers.opened_by` points to missing users and that repeated acceptance runs remain clean.
- [ ] **Step 5: Run `npm run acceptance:concurrency` twice** and verify both runs pass without accumulating rows.

### Task 2: Make agreement loading race-safe

**Files:**
- Modify: `src/components/users/users-view.tsx`
- Modify: `src/components/users/employee-agreement-dialog.tsx`
- Test: `src/components/users/users-view.test.tsx`
- Test: `src/components/users/employee-agreement-dialog.test.tsx`

**Interfaces:**
- Consumes: `chairRentalClient.agreement`, existing `EmployeeAgreementDialog` props and save handler.
- Produces: explicit loading/error/loaded state and guarded save behavior.

- [ ] **Step 1: Write failing tests** for loading lockout, load error/retry, and stale response isolation.
- [ ] **Step 2: Run the focused tests** and verify they fail for the current null/default behavior.
- [ ] **Step 3: Implement per-user request state** with request identity/cancellation so late responses cannot update another employee’s dialog.
- [ ] **Step 4: Render a loading state and disable save** until the agreement is loaded; render retry on error; preserve owner-only edit authorization.
- [ ] **Step 5: Run the two focused test files** and verify they pass.

### Task 3: Complete rental audit history presentation

**Files:**
- Modify: `src/components/users/chair-rental-history-sheet.tsx`
- Test: `src/components/users/chair-rental-history-sheet.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `ChairRentalPayment` fields `paidAt`, `confirmedBy`, `voidedAt`, `voidedBy`, `voidReason`, payment method, amount.
- Produces: readable, complete history cards.

- [ ] **Step 1: Write failing tests** asserting void date, void actor, reason, paid date, payment method, and amount.
- [ ] **Step 2: Run the focused test and verify it fails** because `voidedAt` is absent.
- [ ] **Step 3: Implement explicit labeled audit metadata** using Buenos Aires date/time formatting.
- [ ] **Step 4: Run the focused history test and verify it passes.**

### Task 4: Polish responsive rental and report presentation

**Files:**
- Modify: `src/components/users/user-list.tsx`
- Modify: `src/components/reports/report-composition.tsx`
- Modify: `src/components/users/employee-agreement-dialog.tsx`
- Test: `src/components/users/user-list.test.tsx`
- Test: `src/components/reports/report-composition.test.tsx`
- Test: `src/components/users/employee-agreement-dialog.test.tsx`

**Interfaces:**
- Consumes: existing rental summary, report breakdown, and month/day popover components.
- Produces: one rental summary per breakpoint, correct singular/plural copy, and viewport-safe popovers.

- [ ] **Step 1: Add failing tests** for desktop-only column/mobile-only compact card, singular report labels, and due-day explanatory copy.
- [ ] **Step 2: Run focused tests and verify the expected failures.**
- [ ] **Step 3: Make the compact card mobile-only**, keep the desktop column authoritative, and preserve accessible payment actions.
- [ ] **Step 4: Add singular/plural formatting and clarify the recurring 1..28 rule without changing the backend contract.**
- [ ] **Step 5: Ensure month/day popovers use portal/overflow/collision behavior that stays above the drawer and within the viewport.**
- [ ] **Step 6: Run focused component tests and inspect notebook/mobile layouts.**

### Task 5: Improve payment-method loading resilience

**Files:**
- Modify: `src/components/users/users-view.tsx`
- Modify: `src/components/users/chair-rental-dialogs.tsx`
- Test: `src/components/users/users-view.test.tsx`
- Test: `src/components/users/chair-rental-dialogs.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `paymentMethodClient.list()` and confirmation dialog props.
- Produces: explicit loading/error/empty states and disabled confirmation until methods are available.

- [ ] **Step 1: Write failing tests** for loading, request error/retry, and no-active-method states.
- [ ] **Step 2: Run focused tests and verify failure.**
- [ ] **Step 3: Implement explicit payment-method state and retry UI.**
- [ ] **Step 4: Run focused tests and verify pass.**

### Task 6: Verify database state and full application

**Files:**
- Modify: `context_snapshot.md`

- [ ] **Step 1: Repair only the confirmed stale fixture row in the test database**, recording the exact target and rollback-safe query.
- [ ] **Step 2: Run `npm test`, `npm run lint`, `npx next typegen`, `npx tsc --noEmit`, `npm run build`, `npm run audit:db`, `npm run acceptance:db`, and `npm run acceptance:concurrency`.**
- [ ] **Step 3: Run `git diff --check` and inspect the final diff.**
- [ ] **Step 4: Update `context_snapshot.md` with changes, test results, test DB state, and explicit production untouched status.**

