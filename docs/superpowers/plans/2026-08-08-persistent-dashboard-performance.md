# Persistent Dashboard Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the dashboard shell across private navigation and reduce each ordinary session validation from repeated read/write round trips to one mandatory read plus an occasional throttled activity write.

**Architecture:** Move private routes into a URL-transparent `(dashboard)` route group with one authenticated shell. Memoize current-session resolution per React server request, throttle `last_seen_at` writes to five-minute intervals, derive sidebar state from the pathname, and keep loading feedback inside the persistent shell.

**Tech Stack:** Next.js 16 App Router, React Server Components, React request memoization, TypeScript, Vitest, Testing Library, Supabase PostgreSQL, shadcn/ui.

## Global Constraints

- Preserve `/`, `/incomes`, `/incomes/new`, `/users`, and `/login` URLs.
- Keep `/login` outside the authenticated shell.
- Perform a database read on every new protected server request so revocation and user changes remain immediate.
- Throttle only `last_seen_at`; do not extend absolute session expiration.
- Keep owner/admin authorization on `/users`.
- Do not commit or push; the user handles Git integration.

---

### Task 1: Throttle Session Activity Writes

**Files:**
- Modify: `src/lib/auth/types.ts`
- Modify: `src/lib/sessions/repository.ts`
- Modify: `src/lib/auth/session.ts`
- Test: `src/lib/auth/session.test.ts`
- Test: `src/lib/sessions/repository.test.ts`

**Interfaces:**
- `SessionWithUser.lastSeenAt: string`
- `getCurrentSession(token, dependencies, now)` touches only when `now - lastSeenAt >= 300000`.

- [ ] Add failing tests for recent and stale sessions and repository mapping.
- [ ] Run focused tests and confirm expected failures.
- [ ] Map `last_seen_at` and implement the five-minute threshold.
- [ ] Run focused tests and confirm they pass.

### Task 2: Memoize Authentication Within a Server Request

**Files:**
- Modify: `src/lib/auth/authorization.ts`
- Test: `src/lib/auth/authorization.test.ts`

**Interfaces:**
- `requireUser()` preserves its public async signature.
- Repeated calls during one React server request share session resolution.

- [ ] Add a failing test for the stable memoized resolver boundary.
- [ ] Run the test and confirm the missing memoization failure.
- [ ] Wrap current-session resolution with React request memoization without caching across requests.
- [ ] Run authorization tests and confirm they pass.

### Task 3: Create the Persistent Private Shell

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/layout.test.tsx`
- Move: `src/app/page.tsx` to `src/app/(dashboard)/page.tsx`
- Move: `src/app/incomes/**` to `src/app/(dashboard)/incomes/**`
- Move: `src/app/users/page.tsx` to `src/app/(dashboard)/users/page.tsx`
- Remove: route-specific `incomes/layout.tsx` and `users/layout.tsx`
- Update: moved page tests

**Interfaces:**
- The shared layout calls `requirePageUser()` and renders `AppSidebar` plus `SidebarInset` around `children`.
- Dashboard and income pages call `requirePageUser()` at the leaf boundary so every navigation rechecks the session; request memoization deduplicates initial layout-plus-page renders.
- Users page calls `requireManagerPage()` for its additional role check.

- [ ] Add the failing shared-layout test and update page expectations to reject duplicate authentication.
- [ ] Run focused tests and confirm failures against the old route tree.
- [ ] Move routes and implement the single shared shell.
- [ ] Remove duplicated shell code while retaining live-session checks at leaf pages.
- [ ] Run focused route tests and confirm they pass.

### Task 4: Derive Sidebar State From the URL

**Files:**
- Modify: `src/components/app-sidebar.tsx`
- Test: `src/components/app-sidebar.test.tsx`

**Interfaces:**
- `AppSidebar` derives active navigation from `usePathname()`.
- `/incomes` and `/incomes/new` both activate Ingresos; `/users` activates Usuarios; `/` activates Inicio.

- [ ] Add failing pathname-state tests.
- [ ] Run them and confirm current prop-based behavior fails.
- [ ] Implement longest-prefix pathname matching while retaining optional explicit override for isolated use.
- [ ] Run sidebar tests and confirm they pass.

### Task 5: Add In-Shell Navigation Feedback

**Files:**
- Create: `src/app/(dashboard)/loading.tsx`
- Create: `src/app/(dashboard)/loading.test.tsx`

**Interfaces:**
- Loading UI renders only inside `SidebarInset` and uses accessible status semantics.

- [ ] Write a failing loading-state test.
- [ ] Run it and confirm the component is missing.
- [ ] Implement a compact dashboard-content skeleton without a second sidebar.
- [ ] Run the focused test and confirm it passes.

### Task 6: Verify the Integrated Refactor

**Files:**
- Modify tests only if a moved import path requires mechanical correction; do not change behavior expectations.

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `git diff --check`.
- [ ] Run `npm run build` using the repository's configured build command.
- [ ] Start the app and verify `/`, `/incomes`, `/incomes/new`, and `/users` navigate with a persistent sidebar.
- [ ] Compare development request timings and report measured results without claiming production latency from development-only numbers.
