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
- Deactivating a user or resetting a password revokes all of that user's sessions.
- A manager cannot deactivate their own account, and the last active owner cannot be deactivated or demoted.
- Database tables have RLS enabled with no browser policies. Only the server secret role can access them.
- SQL in `supabase/queries` is the source of truth and is designed for manual execution in the Supabase SQL Editor.

## Repository map

- `src/app/api/auth`: login, logout and current-session Route Handlers.
- `src/app/api/admin`: manager-only users and roles Route Handlers.
- `src/lib/auth`: schemas, hashing, session, authentication and authorization rules.
- `src/lib/users`, `src/lib/sessions`: persistence repositories and user lifecycle service.
- `src/lib/supabase`: server-only Supabase client and database row types.
- `src/lib/bootstrap`: first-owner bootstrap policy.
- `scripts/bootstrap-owner.ts`: one-time first-owner command.
- `supabase/queries`: ordered, copy/paste SQL scripts and their execution guide.
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
