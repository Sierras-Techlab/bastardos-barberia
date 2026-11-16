# Incomes View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adapt the Gemini `/incomes` prototype to the app's real responsive income history and controls.

**Architecture:** Keep the existing server route as the source of role-scoped data and cash state. Rework the existing client components for filters, metrics, composition, and history; do not create mock routes or replacement navigation.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind CSS, existing income clients/components.

**Spec:** `C:/Users/Uriel/Downloads/redise_o_vista_ingresos_incomes_bastardos_barber_a.tsx` plus the user's role, responsive, and functionality requirements in the conversation.

## Global Constraints

- Preserve server APIs, Zod contracts, filtering, pagination, permissions, status display, payment-method management, and void flows.
- Keep the current Bastardos shell, original logo, and global theme control; do not copy mock sidebar, role/theme selectors, or sample data.
- Do not expose manager totals, employee selector, or void actions to employees.
- Render mobile at 390 px, tablet at 768 px, and notebook at 1366 px; prevent horizontal overflow.

## Review Focus

- Manager and employee scopes must continue to show only their permitted metrics and operations.
- Filters must keep their current query and clear behavior when moved into a mobile disclosure.
- The cash-closed state must explain why income entry is unavailable.
- Tablet history must fit its content width while preserving detail access.
- Composition must use server metrics and keep its mobile/desktop disclosure behavior accessible.

---

### Task 1: Header and responsive filters

**Files:** `src/app/(dashboard)/incomes/page.tsx`, `src/components/incomes/income-filters.tsx`, `src/components/incomes/income-filter-scope.tsx`.

- Preserve the real `/incomes/new` link when today's cash is open; show the contextual closed-cash message otherwise.
- Make mobile filters collapsible with a 44 px trigger, visible scope chips, and clear action. Keep date/employee filters visible in the tablet/desktop layout, employee-only-to-managers, and secondary search/payment/kind controls intact.
- Keep full amount-scope explanations and rental/payment-filter warnings available.

### Task 2: Summary and composition hierarchy

**Files:** `src/components/incomes/income-metrics.tsx`, `src/components/incomes/income-totals.tsx`, `src/components/incomes/income-composition.tsx`, `src/components/incomes/incomes-view.tsx`.

- Use the existing manager totals and employee-sanitized metrics; do not invent employee gross totals or example values.
- Keep primary metrics compact and responsive. Move manager composition after history on tablet/desktop and before history on mobile; default it closed below 768 px and open from 768 px upward, while remaining user-toggleable.
- Preserve the explanations about generated commissions, chair rentals, and totals.

### Task 3: Responsive history and details

**Files:** `src/components/incomes/incomes-view.tsx`, `src/components/incomes/income-table.tsx`, `src/components/incomes/income-mobile-list.tsx`.

- Keep real data, pagination, role-specific columns, combined-payment labels, voided status, and the connected detail sheet.
- Use touch cards below tablet and a condensed table from 768 px, hiding separate employee/customer columns at tablet and folding permitted context into the concept cell.
- Make table rows open their real detail sheet on pointer click while retaining a keyboard-accessible explicit action.

### Task 4: Documentation and verification

**Files:** `context_snapshot.md`, `product.md`.

- Record the responsive history redesign without changing database/API status.
- Run lint, Next type generation, TypeScript, and the production build. Inspect the real page in dark/light themes at 390, 768, and 1366 px, including manager/employee and cash-open/closed states. Do not use Gemini's sample amounts as application data.