# Operational Control Roadmap Status and Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to execute one block at a time. Read the approved spec and the selected block plan completely before changing code.

**Goal:** Preserve one resumable source of truth for the operational-control roadmap, including the delivered baseline, completed block `019`, remaining blocks `020` through `023`, deployment prerequisites and verification gates.

**Architecture:** The roadmap evolves the existing canonical income, fixed-customer and Caja models through ordered migrations. Each block must remain independently reviewable and deployable, must preserve strict role-specific JSON contracts and must update the shared product/context documentation after verification.

**Tech Stack:** PostgreSQL/Supabase SQL, Next.js 16 App Router and Route Handlers, React 19, strict TypeScript, Zod, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-21-operational-control-and-employee-privacy-design.md`

**Status captured:** 2026-08-22 on `codex/019-employee-work-sessions`.

## Source-of-truth order

1. `AGENTS.md` contains durable architecture, authorization and data-safety invariants.
2. The approved operational-control spec defines product decisions for blocks `019` through `023`.
3. This document records execution order and current status.
4. Each linked block plan contains the TDD tasks, interfaces, files and verification commands.
5. `context_snapshot.md` records the active branch, external blockers and single recommended next action.
6. `product.md` records the user-visible module state and current product objective.

## Delivered foundation before this roadmap

The local application already contains authentication and user administration, product/service/customer persistence, fixed weekly schedules and attendance, historical customer visit prices, product categories, item-level commissions, dynamic split payment methods, role-scoped income history/detail, and automatic read-only Caja through ordered migrations `001`–`018`.

The exact installed revision of the shared Supabase project must still be checked before applying any later migration. Local implementation status does not imply remote installation. `product.md` contains the detailed module-by-module inventory.

## Roadmap status

| Order | Block | Status | Outcome / next gate |
| --- | --- | --- | --- |
| 1 | [`019` Employee work sessions](./2026-08-21-019-employee-work-sessions.md) | Implemented and reviewed locally | Apply after `018`, run object/RLS/grant/trigger checks and rollback acceptance, then authenticated desktop/mobile QA. |
| 2 | [`020` Pricing, owner commissions and employee privacy](./2026-08-21-020-income-pricing-owner-commissions-and-employee-privacy.md) | Planned; next implementation block | Preserve `019` linkage while replacing owner-zero rules, adding audited charged-price overrides and employee-safe financial projections. |
| 3 | [`021` Fixed-customer monthly payments](./2026-08-21-021-fixed-customer-monthly-payments.md) | Planned | Requires the payment modes, owner commission and privacy contracts from `020`. |
| 4 | [`022` Manual cash lifecycle](./2026-08-21-022-manual-cash-lifecycle.md) | Planned | Requires normal and subscription income flows through `021`; evolves canonical Caja rather than creating parallel tables. |
| 5 | [`023` Customer last visit](./2026-08-21-023-customer-last-visit.md) | Planned | Runs after `022`; derives the last qualifying visit from active normal sales without a mutable customer column. |

## Block 019 delivered locally

- Migration `019_employee_work_sessions.sql` creates canonical work sessions, immutable correction audit, income linkage and role-scoped RPCs without `_v2` objects.
- Employees alone mark their own entry/exit. Server and database time are authoritative, one session may be open at once, and multiple completed sessions may exist on the same local date.
- Employee-created sales require and derive the employee's open session. Manager-created employee sales link the open session when present or snapshot `outsideWorkSession: true`; managers never require a session for their own sales.
- Manager corrections require a reason and the visible `updatedAt` version. The RPC compares it after the row lock and before any write, so stale correction-versus-exit and correction-versus-correction attempts return `WORK_SESSION_CONFLICT`.
- Metrics are calculated from active incomes linked to the exact session. Employee responses contain only worked minutes, sale count and employee commission; manager responses additionally contain gross and barbershop net.
- Authenticated no-store APIs, strict browser Zod parsing, persistent employee clock UI, role-specific Presentismo history, manager filters and audited correction UI are implemented.
- Employee income entry is guarded before catalog/editor loading when no session is open. A database race still returns the stable `EMPLOYEE_WORK_SESSION_REQUIRED` conflict as HTTP 409.
- Final local verification passed: 164 test files / 634 tests, ESLint, Next.js route type generation, standalone TypeScript, Webpack production build and `git diff --check`.

## Block 019 pending external actions

- [ ] Confirm migration `018` is installed in the target Supabase project.
- [ ] Execute `supabase/queries/019_employee_work_sessions.sql` manually.
- [ ] Run the README object, RLS, seven-privilege table matrix, function-grant and trigger checks.
- [ ] Run the rollback-wrapped acceptance block, including employee/manager sale linkage, void-excluded metrics and stale correction conflicts.
- [ ] Perform authenticated desktop and 390×844 QA for entry/exit, history, correction and employee sale guard.
- [ ] Merge or otherwise integrate `codex/019-employee-work-sessions` into the selected shared feature branch; no push or merge has occurred yet.

## Remaining execution order

### Block 020 — next

Implement the detailed `020` plan task by task. Its migration removes only the rules that force owner commission to zero; existing owner values remain zero until edited. Manager price overrides snapshot catalog value, charged value, adjustment actor/reason and commission calculated on the charged subtotal. Employee entry/history/dashboard contracts must omit gross, prices, discounts, payment amounts and barbershop net at the serialization boundary.

### Block 021

After `020` is verified, extend effective-dated fixed schedules with one responsible professional and monthly price. Paying a month must atomically create a real subscription income, payment allocations, commission snapshot, Caja effect and work-session linkage; voiding that income reopens the month without deleting history.

### Block 022

After subscription incomes exist, evolve the canonical Caja model with manual opening balance, manual confirmed close, automatic first-income opening at zero, automatic pending-confirmation close and counted-versus-expected reconciliation. Opening balance represents only physical cash already in the drawer and is never revenue.

### Block 023

Finally, derive each customer's last qualifying visit from active normal sale `business_date`. Exclude voids and subscription income, expose no financial/employee data and avoid a denormalized mutable customer column.

## Completion gate for every remaining block

- Use TDD with observed RED and focused GREEN for every task.
- Run an independent task review and a final cross-layer review.
- Keep SQL canonical, ordered and copy/paste friendly; never create `_v2` tables or RPCs.
- Update database row/RPC types, README installation order and rollback acceptance whenever SQL changes.
- Run `npm test`, `npm run lint`, `npx next typegen`, `npx tsc --noEmit`, `npm run build -- --webpack` and `git diff --check` on the final HEAD.
- Do not claim remote migration or authenticated visual QA unless it was actually executed.
- Update `AGENTS.md` only for durable invariants, `product.md` for delivered product state and `context_snapshot.md` for current work and the next action.

## Known non-blocking boundary

The current Presentismo employee filter is built from current non-deleted users whose current role is `employee`. Historical sessions remain visible in unfiltered results, but an employee later promoted or logically deleted is not offered as a direct filter option. Expanding that historical identity catalog is outside block `019` and should be designed explicitly if requested.

## Resume point

First integrate the reviewed `019` branch into the intended shared feature branch. Then either apply and validate migration `019` when remote SQL is authorized or begin local implementation of block `020` while keeping remote installation status explicit.
