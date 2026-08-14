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
- Accounts are created only by a manager. There is no public registration endpoint.
- Usernames are database-generated from normalized `first_name.last_name`; collisions add `2`, `3`, and so on.
- Login accepts username and password only. Inactive, locked, unknown and incorrect-password cases return the same public credential error.
- Five failed attempts lock an account for 15 minutes. Sessions last 12 hours.
- Deactivating, deleting or resetting a user password revokes all of that user's sessions.
- User deletion is logical: `deleted_at` and `deleted_by` preserve audit history, normal reads exclude deleted accounts, and deletion plus session revocation is one database transaction.
- A manager cannot deactivate or delete their own account, and the last active owner cannot be deactivated, deleted or demoted.
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
- `src/app/api/incomes`, `src/lib/incomes`: transactional sale creation, scoped history/detail, voiding and browser API client.
- `src/lib/supabase`: server-only Supabase client and database row types.
- `src/lib/bootstrap`: first-owner bootstrap policy.
- `scripts/bootstrap-owner.ts`: one-time first-owner command.
- `supabase/queries`: ordered, copy/paste SQL scripts `001` through `015` and their execution guide.
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
```

The repository expects Node 24.18.x and npm 11.16.x. The bootstrap command reads `.env`; remove its three temporary `BOOTSTRAP_OWNER_*` values after a successful run.
