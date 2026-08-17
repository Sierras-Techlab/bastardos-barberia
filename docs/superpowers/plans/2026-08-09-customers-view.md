# Customers View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authenticated responsive `/customers` frontend prototype with validated mocks, filtering, sorting and manager-only create/edit workflows.

**Architecture:** A Server Component validates the mock fixture and derives a presentation capability from the authenticated user. `CustomersView` owns temporary client state, while pure helpers define validation, normalization, filtering, sorting and metrics. Focused components render metrics, filters, responsive collections, the editor dialog and action feedback.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Zod 4, Tailwind CSS, existing shadcn/base-ui primitives, Lucide icons, Vitest and Testing Library.

## Global Constraints

- Do not add or modify APIs, Supabase clients, database types or SQL.
- First name, last name, email and phone are required.
- Email and normalized phone must be unique.
- Visits are read-only and new customers start with zero visits.
- Owner/admin may create and edit; employees are read-only.
- Mock changes reset on reload or remount.
- Use arrow functions for application components and helpers.

---

### Task 1: Customer domain and validated fixture

**Files:**
- Create: `src/types/customer.ts`
- Create: `src/data/customers.mock.json`
- Create: `src/lib/customers/customer-catalog.ts`
- Test: `src/lib/customers/customer-catalog.test.ts`

**Interfaces:**
- Produce `authorizeCustomerCatalogData(input: unknown): CustomerCatalogData`.
- Produce `filterCustomers`, `sortCustomers`, `calculateCustomerMetrics`, `customerEditorSchema` and `validateUniqueCustomerContact`.

- [x] Write failing tests for strict fixture validation, search, sorting, metrics, required fields and normalized duplicate contact data.
- [x] Run the domain test and verify RED.
- [x] Implement the types, fixture and pure helpers.
- [x] Run the domain test and verify GREEN.

### Task 2: Authenticated route and navigation

**Files:**
- Create: `src/app/(dashboard)/customers/page.tsx`
- Create: `src/app/(dashboard)/customers/page.test.tsx`
- Create: `src/app/(dashboard)/customers/loading.tsx`
- Modify: the existing dashboard sidebar navigation component located during implementation.

**Interfaces:**
- Page calls `requirePageUser()`, validates the fixture and passes `canManage` to `CustomersView`.
- Sidebar links to `/customers` for every authenticated role.

- [x] Write failing route/navigation tests.
- [x] Run the tests and verify RED.
- [x] Implement the page, loading state and sidebar link using current Next.js 16 patterns.
- [x] Run the tests and verify GREEN.

### Task 3: Responsive customer catalog

**Files:**
- Create: `src/components/customers/customers-view.tsx`
- Create: `src/components/customers/customers-view.test.tsx`
- Create focused presentation components under `src/components/customers/` for metrics, filters, desktop table and mobile cards.

**Interfaces:**
- `CustomersView({ data, canManage }: { data: CustomerCatalogData; canManage: boolean })` owns the mock collection and display state.

- [x] Write failing tests for metrics, search, sorting, empty results and desktop/mobile representations.
- [x] Run view tests and verify RED.
- [x] Implement the responsive catalog and native phone/email links.
- [x] Run view tests and verify GREEN.

### Task 4: Create and edit workflows

**Files:**
- Create: `src/components/customers/customer-editor-dialog.tsx`
- Test: `src/components/customers/customer-editor-dialog.test.tsx`
- Create: `src/components/customers/customer-actions.tsx`
- Reuse: `src/components/products/product-action-feedback.tsx`
- Modify: `src/components/customers/customers-view.tsx`
- Modify: `src/components/customers/customers-view.test.tsx`

**Interfaces:**
- Editor submits `{ firstName, lastName, email, phone }` and never exposes visits.
- New customers receive `visits: 0`, a local ID and the current local timestamp.

- [x] Write failing create/edit, duplicate contact, permission and reset tests.
- [x] Run tests and verify RED.
- [x] Implement the editor, actions and feedback lifecycle.
- [x] Run tests and verify GREEN.

### Task 5: Documentation and complete verification

**Files:**
- Modify: `context_snapshot.md`
- Modify: `product.md`

- [x] Update module state and backend boundaries.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build -- --webpack`.
- [x] Run `git diff --check` and review the final diff.
