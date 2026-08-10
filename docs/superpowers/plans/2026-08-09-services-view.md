# Services View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authenticated responsive `/services` mock catalog with visual cards and manager-only lifecycle controls.

**Architecture:** A server page validates a dedicated fixture and derives the presentation capability from the authenticated role. Pure catalog helpers own validation, filtering, sorting and metrics; a focused client workspace owns reload-scoped mutations and composes cards, filters and dialogs.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Zod 4, Tailwind CSS, existing shadcn/base-ui primitives, Lucide icons, Vitest and Testing Library.

## Global Constraints

- Do not modify backend, API, Supabase or SQL code.
- Initial service IDs, names and prices must match the current income form fixture.
- Service fields are `id`, `name`, `price` and `isActive`; duration is excluded.
- Owner/admin may create, edit, change status and delete; employees see active services only.
- Mutations are in memory and reset on reload.
- Use visual cards at every breakpoint; do not add a service table.
- Use arrow functions for application components and helpers.

---

### Task 1: Validated service catalog domain

**Files:**
- Create: `src/types/service-catalog.ts`
- Create: `src/data/services.mock.json`
- Create: `src/lib/services/service-catalog.ts`
- Test: `src/lib/services/service-catalog.test.ts`

**Interfaces:**
- Produces: `ServiceCatalogItem`, `ServiceCatalogData`, `ServiceCatalogFilters`, `ServiceCatalogSort`, `ServiceEditorInput`, `ServiceCatalogMetrics`.
- Produces: `authorizeServiceCatalogData(input: unknown)`, `filterServices(services, filters)`, `sortServices(services, sort)`, `calculateServiceMetrics(services)`, `serviceEditorSchema`, `validateUniqueServiceName(input, services, ignoredId?)`.

- [x] Write tests proving strict fixture validation, normalized name search, active-state filtering, name/price sorting, metrics, positive prices and duplicate-name rejection.
- [x] Run `npm test -- src/lib/services/service-catalog.test.ts` and verify failures are caused by the missing domain.
- [x] Implement the types, three-service fixture and pure helpers. Normalize names with trimmed locale-lowercase comparison and calculate rounded average price plus min/max prices.
- [x] Run `npm test -- src/lib/services/service-catalog.test.ts` and verify it passes.

### Task 2: Authenticated route, loading and navigation

**Files:**
- Create: `src/app/(dashboard)/services/page.tsx`
- Create: `src/app/(dashboard)/services/page.test.tsx`
- Create: `src/app/(dashboard)/services/loading.tsx`
- Create: `src/app/(dashboard)/services/loading.test.tsx`
- Modify: `src/components/app-sidebar.tsx`
- Modify: `src/components/app-sidebar.test.tsx`

**Interfaces:**
- Consumes: `authorizeServiceCatalogData` and `ServicesView`.
- Page calls `requirePageUser()` and passes `canManage={role === "owner" || role === "admin"}`.

- [x] Write route tests asserting metadata title `Servicios`, live authentication, manager controls, employee access and the `/services` sidebar link; write a centered loading-state test.
- [x] Run the route, loading and sidebar tests and verify they fail because the route/link do not exist.
- [x] Implement the server page using the existing Products/Customers header pattern, a `ServicesLoading` fallback and an active sidebar link for every authenticated role.
- [x] Run the focused tests and verify they pass.

### Task 3: Visual catalog, metrics and filters

**Files:**
- Create: `src/components/services/service-metrics.tsx`
- Create: `src/components/services/service-filters.tsx`
- Create: `src/components/services/service-card-grid.tsx`
- Create: `src/components/services/services-view.tsx`
- Test: `src/components/services/services-view.test.tsx`

**Interfaces:**
- `ServicesView({ data, canManage }: { data: ServiceCatalogData; canManage: boolean })` owns catalog, filter and sorting state.
- `ServiceCardGrid` receives visible services and optional manager callbacks; it always renders responsive cards rather than a table.

- [x] Write failing tests for three summary metrics, all initial cards, search, status filtering, price sorting, filter reset, empty results and employee-only active cards.
- [x] Run `npm test -- src/components/services/services-view.test.tsx` and verify the missing components cause the expected failure.
- [x] Implement compact metric cards and a toolbar with query, status, sort and clear controls. Implement a one-to-three-column card grid with formatted ARS prices, state badges, rounded geometry and `hover:-translate-y-0.5` elevation.
- [x] Run the focused view test and verify it passes without accessibility warnings.

### Task 4: Create and edit workflows

**Files:**
- Create: `src/components/services/service-editor-dialog.tsx`
- Create: `src/components/services/service-editor-dialog.test.tsx`
- Modify: `src/components/services/services-view.tsx`
- Modify: `src/components/services/services-view.test.tsx`
- Reuse: `src/components/products/product-action-feedback.tsx`

**Interfaces:**
- Editor submits `ServiceEditorInput` containing normalized `name` and integer `price`.
- New mock services receive a stable local ID and `isActive: true`; edits preserve ID and status.

- [x] Write failing tests for required name, positive integer price, duplicate normalized name, successful creation, successful edit, preserved status and absent controls for employees.
- [x] Run the editor and view tests and verify RED.
- [x] Implement the accessible create/edit dialog, manager action entry points and three-second dismissible success feedback.
- [x] Run the editor and view tests and verify GREEN.

### Task 5: Status confirmation workflow

**Files:**
- Create: `src/components/services/service-status-dialog.tsx`
- Create: `src/components/services/service-status-dialog.test.tsx`
- Modify: `src/components/services/service-card-grid.tsx`
- Modify: `src/components/services/services-view.tsx`
- Modify: `src/components/services/services-view.test.tsx`

**Interfaces:**
- `ServiceStatusDialog({ service, onClose, onConfirm })` names the affected service and explains activation or deactivation.
- Confirming toggles only `isActive` and produces accessible feedback.

- [x] Write failing tests proving status does not change on cancel, changes only after confirmation and updates card state plus feedback.
- [x] Run the status tests and verify RED.
- [x] Implement the confirmation dialog and connect card management actions to the local catalog state.
- [x] Run the status and view tests and verify GREEN.

### Task 6: Product documentation and complete verification

**Files:**
- Modify: `context_snapshot.md`
- Modify: `product.md`
- Modify: `docs/superpowers/plans/2026-08-09-services-view.md`

- [x] Document `/services` as a frontend prototype, the manager/employee behavior and the unsynchronized mock boundary with Ingresos.
- [x] Run `npm test` and require zero failures.
- [x] Run `npm run lint` and require zero errors.
- [x] Run `npm run build -- --webpack` and require a successful `/services` route build.
- [x] Run `git diff --check`, inspect `git status --short` and review the final diff against every requirement in the approved specification.

### Task 7: Confirmed service deletion

**Files:**
- Create: `src/components/services/service-delete-dialog.tsx`
- Create: `src/components/services/service-delete-dialog.test.tsx`
- Modify: `src/components/services/service-actions.tsx`
- Modify: `src/components/services/service-card-grid.tsx`
- Modify: `src/components/services/services-view.tsx`
- Modify: `src/components/services/services-view.test.tsx`
- Modify: `context_snapshot.md`
- Modify: `product.md`

**Interfaces:**
- `ServiceActions` receives an `onDelete: () => void` callback and exposes an `Eliminar` destructive menu item.
- `ServiceDeleteDialog({ service, onClose, onConfirm })` names the affected service and does not mutate catalog state itself.
- Confirming removes the matching `service.id` from the reload-scoped catalog and announces `Servicio eliminado correctamente.`.

- [x] Write a dialog test proving cancel does not call `onConfirm` and confirm calls it once; extend the view test to prove the card remains before confirmation and disappears only after confirmation.
- [x] Run `npm test -- src/components/services/service-delete-dialog.test.tsx src/components/services/services-view.test.tsx` and verify RED because deletion is not implemented.
- [x] Add the red destructive menu item, confirmation dialog and local catalog removal with accessible feedback.
- [x] Run the focused tests and verify GREEN.
- [x] Update product documentation to distinguish reload-scoped mock deletion from future logical deletion at the backend boundary.
- [x] Run `npm test`, `npm run lint`, `npm run build -- --webpack` and `git diff --check`; require every command to succeed.
