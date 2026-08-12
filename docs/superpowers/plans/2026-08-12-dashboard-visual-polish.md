# Dashboard Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore clear card boundaries and reliable spacing across the simplified dashboard at mobile, tablet and desktop widths.

**Architecture:** Keep the existing dashboard components and data flow. Replace fragile arbitrary radii with standard Tailwind radii, use a twelve-column desktop composition with explicit spans, and add semantic surface borders/shadows so light and dark cards remain distinguishable.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Tailwind CSS 4, Vitest and Testing Library.

## Global Constraints

- Do not change dashboard content, role scoping, routes or backend behavior.
- Use standard Tailwind layout/radius utilities for the repaired structure.
- Preserve two-column tablet and stacked mobile behavior.
- Keep the Bastardos white, charcoal and red visual identity.
- Use arrow functions for components and helpers.

---

### Task 1: Stable dashboard surfaces and layout

**Files:**
- Modify: `src/app/(dashboard)/(home)/page.tsx`
- Modify: `src/app/(dashboard)/(home)/page.test.tsx`
- Modify: `src/components/dashboard/income-summary-card.tsx`
- Modify: `src/components/dashboard/income-summary-card.test.tsx`
- Modify: `src/components/dashboard/quick-actions-card.tsx`
- Modify: `src/components/dashboard/quick-actions-card.test.tsx`
- Modify: `src/components/dashboard/fixed-customers-card.tsx`
- Modify: `src/components/dashboard/fixed-customers-card.test.tsx`

**Interfaces:**
- The home composition exposes `data-testid="dashboard-grid"` only as a stable visual-regression hook.
- Existing component props, navigation and interactions remain unchanged.

- [x] **Step 1: Write failing visual-regression tests**

Assert that the dashboard grid uses `gap-5` and `xl:grid-cols-12`, the income wrapper uses `xl:col-span-8`, the lateral uses `xl:col-span-4`, and all three primary surfaces use `rounded-3xl` plus explicit borders. Assert the quick-action grid uses `gap-3` and its action tiles have translucent borders.

- [x] **Step 2: Run focused tests and verify RED**

Run: `npm test -- 'src/app/(dashboard)/(home)/page.test.tsx' src/components/dashboard/income-summary-card.test.tsx src/components/dashboard/quick-actions-card.test.tsx src/components/dashboard/fixed-customers-card.test.tsx`

Expected: FAIL because the current surfaces use arbitrary radii, lack explicit borders and the page does not use the twelve-column layout.

- [x] **Step 3: Implement the minimal visual correction**

Use `rounded-3xl border shadow-sm` on primary surfaces, a twelve-column outer grid, explicit eight/four spans, `min-w-0` wrappers, `gap-5` between primary blocks and `gap-3` with translucent borders inside quick actions. Give light metric cards an explicit `border-black/5` and keep dark/red contrast with `border-white/10`.

- [x] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2 and require zero failures.

- [x] **Step 5: Run complete verification**

Run `npm test`, `npm run lint`, `npm run build -- --webpack` and `git diff --check`. Update `context_snapshot.md` with the verified dashboard visual correction.
