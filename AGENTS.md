<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Bastardos Barberia - project brain

This file is the durable entry point for every coding agent. Read it completely before changing the repository, then read `context_snapshot.md` and `product.md`.

## Product

Bastardos Barberia is an internal administrative dashboard for a barbershop. The product will centralize sales, services, products, customers, employees, cash movements and reporting. The current production foundation is local username/password authentication backed by Supabase PostgreSQL. Supabase Auth is deliberately not used.

## Current stack

- Next.js 16 App Router and Route Handlers
- React 19 and TypeScript in strict mode
- Supabase PostgreSQL, accessed only from server code with `SUPABASE_SECRET_KEY`
- Argon2id password hashing via `@node-rs/argon2`
- Opaque, hashed database sessions in an HttpOnly cookie
- Zod for boundary validation
- Vitest and Testing Library
- Tailwind CSS and the existing shadcn/base-ui component layer
- Sonner for globally consistent dashboard action notifications

## Architecture and invariants

- Browser code never imports the Supabase server client and never receives the secret key.
- Passwords are never stored or logged in plain text. Only Argon2id hashes are persisted.
- Session tokens are random opaque values. Only their SHA-256 hashes are persisted.
- `proxy.ts` is only an optimistic cookie-presence check. Every private page and API operation must authorize again at the server/data boundary.
- Roles are fixed database records: `owner` (1), `admin` (2), `employee` (3).
- Owner and admin are managers. Both currently have full administrative access.
- Owner commission rates are configurable by managers. Existing owners remain at zero until edited; once changed, future owner-attributed sales use the configured rate. Owner-attributed sales with a zero rate keep the full total as barbershop net; non-zero rates produce normal commission snapshots. Owner withdrawals or compensation still belong to future cash/expense flows, not sales commissions.
- Manager-controlled charged-price overrides snapshot catalog value, charged value, signed adjustment, override actor and required reason. Commission is calculated on the charged subtotal. A zero-total manager sale is allowed only with no payment rows. Employee submissions always use the authoritative catalog price.
- Income payments are role-aware: managers enter integer ARS amounts that exactly match the charged total, while employees enter integer basis points (0-10000) summing to 10000. The server distributes the deterministic remainder to the last allocation.
- Income projections are role-aware: managers receive the full charged-price snapshot (`catalogUnitPrice`, `chargedUnitPrice`, `catalogSubtotal`, `chargedSubtotal`, `adjustmentAmount`, payments, totals, barbershop net, registrant). Employees receive a sanitized projection with `concepts` (type/name/quantity/earning) and `employeeCommission` only — no catalog/charged prices, no payment amounts, no totals, no barbershop net, no registrant identity. The sanitized shape is built in PostgreSQL and validated by a separate Zod schema; the application never strips keys after parsing.
- Accounts are created only by a manager. There is no public registration endpoint.
- Usernames are database-generated from normalized `first_name.last_name`; collisions add `2`, `3`, and so on.
- Login accepts username and password only. Inactive, locked, unknown and incorrect-password cases return the same public credential error.
- Five failed attempts lock an account for 15 minutes. Sessions last 12 hours.
- Deactivating, deleting or resetting a user password revokes all of that user's sessions.
- User deletion is logical: `deleted_at` and `deleted_by` preserve audit history, normal reads exclude deleted accounts, and deletion plus session revocation is one database transaction.
- A manager cannot deactivate or delete their own account, and the last active owner cannot be deactivated, deleted or demoted.
- Every active fixed schedule has one responsible professional and a positive integer monthly price. Employee schedules are forced to use the actor as the responsible professional; only manager mutations may reassign another professional.
- Employee fixed-customer agendas and attendance mutations are scoped in PostgreSQL to active schedules currently assigned to that employee; managers retain the complete agenda.
- Monthly subscription payments are recorded as immutable `fixed_subscription` incomes with their own per-period row in `fixed_customer_monthly_payment_attempts`. A new attempt reuses the same `(customer, period)` key only after a manager voids the previous active attempt, reopening the month without losing history. The same physical month cannot be paid twice while the previous attempt is active.
- Customer visit history, dashboard totals and Caja snapshots continue to come from active normal sales; `fixed_subscription` rows contribute to the daily cash close but are excluded from "visits" counters and customer-visit financial projections. Each customer's last qualifying visit date is derived from the latest active normal sale through a canonical partial index and never stored as a mutable customer column.
- The canonical payment method named `Efectivo` is the only one that affects physical cash reconciliation. Renaming, deactivating or deleting that record is rejected by the payment-method RPCs and the database enforces a unique `system_code = 'cash'` index.
- Database tables have RLS enabled with no browser policies. Only the server secret role can access them.
- SQL in `supabase/queries` is the source of truth and is designed for manual execution in the Supabase SQL Editor.
- Products retain creator/updater audit users, are deactivated rather than deleted, and expose inactive records only to owner/admin.
- Product stock changes are atomic, cannot produce negative stock and append an actor-linked inventory movement.
- Services are logically deleted, preserve sales-history references and may be mutated only by owner/admin; employees receive active services only.
- Customer names may duplicate. Normalized phone is required and unique, email is optional and unique when present, every authenticated role may create/edit, and only owner/admin may logically delete.
- A customer may have one active ISO-weekday/local-time schedule. Schedule versions have effective dates, mutations and generation serialize per customer, and audited occurrences are generated idempotently for bounded windows; attendance is independent from sales. Visit history is a sanitized projection of active sale item snapshots.
- User service/product commission rates are manager-configurable integers from 0 through 100 and default to zero.
- Incomes distinguish the authenticated `registered_by` actor from the responsible `employee_id`. Employees are always responsible for themselves; owner/admin may select an active user and may exceptionally grant 100% of a service or individual product lines to a different non-owner employee.
- Income payments are normalized allocations keyed by stable payment-method UUIDs; their distinct positive amounts exactly equal the authoritative sale total, while immutable method-name snapshots preserve history. Commission bases, per-item rates/amounts/exception authorizers, total and barbershop net are immutable sale snapshots.
- Income history is scoped by responsible employee: owner/admin can read/filter every historical responsible user, including inactive or logically deleted accounts with retained sales, and employees can read only their own. Browser payloads never choose the actor, prices, total, commission amounts, timestamp or business date.
- Income creation and manager-only voiding are idempotent and atomic across line-item snapshots, split payments, product stock, inventory movements and customer visits. New-sale authorization/catalog rows remain locked through commit so concurrent role or lifecycle changes cannot invalidate the snapshot. The database stores `created_at` plus an indexed `business_date` in `America/Argentina/Buenos_Aires`.
- Dashboard fixed-customer agenda dates use `America/Argentina/Buenos_Aires` and include only the current local date through Saturday; Sunday is empty and the range rotates on Monday.
- Caja is manager-only and has a manual open/close/confirm lifecycle. The current Buenos Aires business date is calculated live from incomes; the first committed income opens the register at zero. Manual opening sets a non-negative physical-cash opening balance, manual closing requires a counted cash input and confirms immediately on a zero difference, automatic closing keeps the register `pending_confirmation` until a manager confirms the count. Closed financial snapshots remain immutable; reconciliation confirmation never recomputes them. A same-day void is excluded at close, while a void after closure creates one audited negative adjustment on the void date without rewriting the original closure. Dates without sales or adjustments are not persisted.
- A closed current-day Caja disables every income-entry navigation surface and server-redirects direct `/incomes/new` access; the database remains authoritative and rejects races that close Caja after a form was already loaded.
- Expenses are manager-only operating records with dynamic fixed/variable/supplies categories, integer ARS amounts, Buenos Aires accounting dates, idempotent creation, optimistic audited edits and reasoned voiding. Active expenses affect operating-profit metrics but never mutate incomes, commissions or Caja in the MVP; optional payment methods are administrative snapshots only.
- Only current-role employees clock themselves in or out, with at most one open work session per employee and multiple completed sessions allowed per local business date. Clock actors and timestamps are server-authoritative. Employee-created sales require and derive their own open session at the database trigger; managers do not require a session, and manager-created employee sales link that employee's open session when present or retain an explicit outside-session audit flag. Manager corrections require a reason, compare the visible session `updatedAt` under the row lock and append prior/new timestamps before changing the session; a stale correction conflicts without reopening or overwriting newer state. Metrics are derived from active incomes linked to the exact session, so voids are excluded; employee work-session JSON never includes gross or barbershop-net metrics.

## Repository map

- `src/app/api/auth`: login, logout and current-session Route Handlers.
- `src/app/api/admin`: manager-only users and roles Route Handlers.
- `src/app/users`, `src/components/users`: manager-only user administration route and interactive lifecycle workspace.
- `src/lib/auth`: schemas, hashing, session, authentication and authorization rules.
- `src/lib/users`, `src/lib/sessions`: persistence repositories and user lifecycle service.
- `src/app/api/products`, `src/lib/products`: authenticated product endpoints, validation, persistence, inventory services and browser API client.
- `src/app/api/services`, `src/lib/services`: persistent role-aware service catalog and logical lifecycle.
- `src/app/api/customers`, `src/lib/customers`: authenticated customer persistence with manager-only logical deletion.
- `src/app/api/fixed-customer-occurrences`, `src/lib/fixed-customers`: weekly occurrence reads and audited attendance transitions.
- `src/app/api/fixed-customer-months`, `src/lib/fixed-customer-payments`: role-scoped monthly-payment domain, atomic pay RPC and the manager/employee-safe projection RPCs.
- `src/app/api/incomes`, `src/lib/incomes`: transactional sale creation, scoped history/detail, voiding and browser API client.
- `src/app/api/cash`, `src/lib/cash`, `src/components/cash`: manager-controlled manual cash lifecycle (open/close/confirm), automatic first-income opening, automatic pending-confirmation closing and the read-only `/cash` workspace; migration `022` owns the lifecycle schema and the protected `Efectivo` payment method.
- `src/app/api/expenses`, `src/app/api/expense-categories`, `src/lib/expenses`, `src/components/expenses`, `src/app/(dashboard)/expenses`: manager-only operating expenses, monthly profitability summary, audited lifecycle and dynamic category administration; migration `026` owns the domain and deliberately leaves Caja unchanged.
- `src/app/api/work-sessions`, `src/lib/work-sessions`, `src/components/work-sessions`, `src/app/(dashboard)/work-sessions`: role-scoped work-session API, persistence, persistent employee clock control and Presentismo workspace; migration `019` owns clock lifecycle, audited corrections and server-derived income linkage.
- `src/lib/supabase`: server-only Supabase client and database row types.
- `src/lib/bootstrap`: first-owner bootstrap policy.
- `scripts/bootstrap-owner.ts`: one-time first-owner command.
- `scripts/system-db-audit.ts`, `scripts/system-db-acceptance.ts`, `scripts/system-clean-install-acceptance.ts`: read-only schema audit, rollback-only behavioral acceptance and isolated empty-database migration acceptance using `SUPABASE_DB_URL`.
- `supabase/queries`: ordered, copy/paste SQL scripts `001` through `040` and their execution guide; `039` belongs to Reports and `040` to production hardening.
- `docs/superpowers/specs`: approved architecture decisions.
- `docs/superpowers/plans`: implementation plans and task history.
- `product.md`: full product vision, scope and module status.
- `context_snapshot.md`: short-lived operational state, branches, current work and next actions.

## Required workflow

1. Read this file, `context_snapshot.md` and `product.md` before planning work.
2. Inspect relevant local Next.js 16 guides under `node_modules/next/dist/docs/` before using framework APIs.
3. Preserve the approved auth invariants unless the user explicitly changes them.
4. Add or update tests for behavior changes, then run focused tests and the complete verification suite.
5. After every completed task, update `context_snapshot.md`. Update `product.md` when product scope, state or objectives change. Update this file when architecture, invariants, tooling or workflow changes.
6. Never add real credentials to tracked files. Keep `.env` local and update `.env.example` with empty placeholders only.
7. Do not run the first-owner bootstrap until all SQL scripts have been executed and the required bootstrap values were intentionally supplied.

## Commands

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
npm run bootstrap:owner
npm run audit:db
npm run acceptance:db
npx tsx --env-file=.env scripts/system-clean-install-acceptance.ts --confirm-disposable
```

The repository expects Node 24.18.x and npm 11.16.x. The bootstrap command reads `.env`; remove its three temporary `BOOTSTRAP_OWNER_*` values after a successful run.
