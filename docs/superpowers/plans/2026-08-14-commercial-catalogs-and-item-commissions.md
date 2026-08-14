# Commercial Catalogs and Item Commissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver owner-safe commissions, financial customer visits, administrable product categories, item-level 100% product commissions, dynamic payment methods and verified role-scoped metrics.

**Architecture:** Execute five independently reviewable domain plans in SQL dependency order, then run one remote Supabase rollout plan. Each domain leaves canonical application contracts and the final database removes all `_v2` RPCs without creating version-suffixed tables.

**Tech Stack:** Next.js 16.3 App Router and Route Handlers, React 19, strict TypeScript, Zod, Supabase PostgreSQL, Vitest, Testing Library, Tailwind CSS, shadcn/base-ui and Sonner.

## Global Constraints

- Work on `feat/backend-models`; do not create a separate feature branch unless the user changes this requirement.
- Before changing App Router pages or Route Handlers, read the relevant guides under `node_modules/next/dist/docs/`.
- Follow test-driven development: observe every new behavior test fail for the intended reason before production changes.
- Browser code never imports the Supabase server client or receives server secrets.
- All new tables have RLS enabled with no browser policies; only `service_role` receives access.
- SQL source of truth remains ordered, copy/paste-safe files in `supabase/queries`.
- Use canonical table/RPC names only in the final state; remove `_v2` RPCs and do not create version-suffixed tables.
- Preserve immutable sale history except the approved one-time development correction of owner commissions.
- Do not push, create a PR or mutate Supabase until the corresponding local implementation and complete verification are green.

---

### Task 1: Execute the ordered domain plans

**Files:**

- Follow: `docs/superpowers/plans/2026-08-14-012-owner-commission-rules.md`
- Follow: `docs/superpowers/plans/2026-08-14-013-customer-visit-financials.md`
- Follow: `docs/superpowers/plans/2026-08-14-014-product-categories.md`
- Follow: `docs/superpowers/plans/2026-08-14-015-product-item-commissions.md`
- Follow: `docs/superpowers/plans/2026-08-14-016-dynamic-payment-methods.md`

**Interfaces:**

- Consumes: approved design `docs/superpowers/specs/2026-08-14-commercial-catalogs-and-item-commissions-design.md`.
- Produces: locally verified application code plus SQL scripts `012` through `016` with canonical contracts.

- [ ] **Step 1: Complete plan 012 and its focused verification**
- [ ] **Step 2: Complete plan 013 and its focused verification**
- [ ] **Step 3: Complete plan 014 and its focused verification**
- [ ] **Step 4: Complete plan 015 and its focused verification**
- [ ] **Step 5: Complete plan 016 and its focused verification**

### Task 2: Execute the rollout plan

**Files:**

- Follow: `docs/superpowers/plans/2026-08-14-commercial-supabase-rollout.md`

**Interfaces:**

- Consumes: green local tree and migrations `010` through `016`.
- Produces: verified remote Supabase state, updated durable documentation and final evidence.

- [ ] **Step 1: Complete every rollout and verification checkpoint**
- [ ] **Step 2: Reconcile all acceptance criteria against the approved design**

