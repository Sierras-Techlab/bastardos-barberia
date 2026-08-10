# Dashboard Toasts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inconsistent dashboard success feedback with one globally mounted, Bastardos-styled Sonner notification system.

**Architecture:** Keep the authenticated layout as a Server Component and mount a small client `DashboardToaster` beside its children. Feature client components call Sonner after successful actions; contextual validation and blocking errors remain inline.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Sonner, Tailwind CSS, Vitest and Testing Library.

## Global Constraints

- Do not modify backend, API, Supabase or SQL behavior.
- Use one toaster inside the authenticated dashboard layout.
- Successful action notifications close automatically after 3000 milliseconds and include a manual close control.
- Field validation stays inside forms and dialogs; view-blocking errors stay inside their view.
- Preserve existing Spanish notification messages and accessibility semantics.
- Use arrow functions for application components and helpers.

---

### Task 1: Sonner dependency and shared dashboard toaster

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/ui/dashboard-toaster.tsx`
- Create: `src/components/ui/dashboard-toaster.test.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(dashboard)/layout.test.tsx`

**Interfaces:**
- `DashboardToaster()` renders Sonner's `Toaster` with `duration={3000}`, `closeButton`, rich semantic colors and responsive bottom placement.
- The authenticated layout mounts exactly one `DashboardToaster` without becoming a Client Component.

- [x] Install `sonner` with npm so both manifests remain synchronized.
- [x] Write failing tests that render the real toaster, dispatch a success toast, verify its accessible message/close control and assert the dashboard layout contains the toaster region.
- [x] Run `npm test -- src/components/ui/dashboard-toaster.test.tsx 'src/app/(dashboard)/layout.test.tsx'` and verify RED.
- [x] Implement the styled client toaster and mount it once in the authenticated server layout.
- [x] Run the focused tests and verify GREEN.

### Task 2: Migrate mock catalog success notifications

**Files:**
- Modify: `src/components/products/products-view.tsx`
- Modify: `src/components/products/products-view.test.tsx`
- Modify: `src/components/customers/customers-view.tsx`
- Modify: `src/components/customers/customers-view.test.tsx`
- Modify: `src/components/services/services-view.tsx`
- Modify: `src/components/services/services-view.test.tsx`
- Delete: `src/components/products/product-action-feedback.tsx`
- Delete: `src/components/products/product-action-feedback.test.tsx`

**Interfaces:**
- Each successful create, edit, stock, status or delete workflow calls `toast.success(message)`.
- Feature views no longer own `feedback` state or dismissal timers.

- [x] Update feature tests to render the real shared toaster and prove each existing success workflow produces the unified notification.
- [x] Run the Products, Customers and Services view tests and verify RED against the old local feedback components.
- [x] Replace local feedback state/effects with Sonner success calls and remove the product-specific component.
- [x] Run the focused feature tests and verify GREEN.

### Task 3: Migrate user-management success notifications

**Files:**
- Modify: `src/components/users/users-view.tsx`
- Modify: `src/components/users/users-view.test.tsx`

**Interfaces:**
- Successful user update, password reset and lifecycle mutations call `toast.success(message)`.
- Roles/list errors and dialog validation remain inline and unchanged.

- [x] Update the Users view tests to render the shared toaster and expect unified success notifications without an inline success banner.
- [x] Run `npm test -- src/components/users/users-view.test.tsx` and verify RED.
- [x] Remove `successNotice` state and replace successful lifecycle notices with Sonner calls.
- [x] Run the focused Users test and verify GREEN.

### Task 4: Documentation and complete verification

**Files:**
- Modify: `context_snapshot.md`
- Modify: `product.md`
- Modify: `docs/superpowers/plans/2026-08-09-dashboard-toasts.md`

**Interfaces:**
- Documentation records Sonner as the single dashboard action-notification boundary.

- [x] Update durable project documentation and mark completed plan steps.
- [x] Run `npm test` and require zero failures.
- [x] Run `npm run lint` and require zero errors.
- [x] Run `npm run build -- --webpack` and require a successful production build.
- [x] Run `git diff --check`, inspect `git status --short` and confirm the deleted feature-specific feedback component has no remaining imports.
