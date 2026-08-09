# Persistent Incomes Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the navigation sidebar mounted while navigating between `/incomes` and `/incomes/new`.

**Architecture:** Add a nested `src/app/incomes/layout.tsx` that owns `TooltipProvider`, `SidebarProvider`, `AppSidebar`, and `SidebarInset`. Both page files become leaf content and keep only their route-specific header and main UI. Next.js will cache and preserve the nested layout during navigation inside the `incomes` segment.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- Preserve `/incomes` and `/incomes/new` URLs.
- Keep login and root dashboard structure unchanged.
- Do not commit or push automatically.
- Use npm and arrow functions.

---

### Task 1: Add the persistent incomes shell

**Files:**
- Create: `src/app/incomes/layout.tsx`
- Create: `src/app/incomes/layout.test.tsx`

**Interfaces:**
- Consumes: `children: React.ReactNode` and the current demo user.
- Produces: `IncomesLayout`, a persistent wrapper for all routes below `/incomes`.

- [ ] Write a failing layout test that renders child content and verifies the sidebar, active Ingresos link, and shared inset.
- [ ] Run the focused test and confirm it fails because `layout.tsx` does not exist.
- [ ] Implement the minimal nested layout with providers, sidebar, and inset.
- [ ] Run the focused test and confirm it passes.

### Task 2: Remove duplicated shells from leaf pages

**Files:**
- Modify: `src/app/incomes/page.tsx`
- Modify: `src/app/incomes/new/page.tsx`
- Modify: `src/app/incomes/page.test.tsx`
- Modify: `src/app/incomes/new/page.test.tsx`

**Interfaces:**
- Consumes: the persistent layout from Task 1.
- Produces: leaf pages that render only route-specific header and main content.

- [ ] Update route tests to compose each page with `IncomesLayout`.
- [ ] Remove `TooltipProvider`, `SidebarProvider`, `AppSidebar`, and `SidebarInset` from both pages.
- [ ] Preserve headers, links, metadata, and page content unchanged.
- [ ] Run both route tests and confirm they pass.

### Task 3: Verify persistence-safe composition

**Files:**
- Verify all modified and created files.

**Interfaces:**
- Consumes: completed nested layout and leaf pages.
- Produces: verified, production-safe route composition.

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `git diff --check`.
- [ ] Run `npx next build --webpack`.
- [ ] Navigate between `/incomes` and `/incomes/new` in the browser and confirm the shared sidebar stays mounted without visual flashing.
