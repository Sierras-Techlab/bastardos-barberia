# Context snapshot

Captured: 2026-08-07

## Repository state

- Current branch: `feat/database`
- Local branches: 3 (`dev`, `feat/database`, `main`)
- Remote branches: 3 real branches (`origin/dev`, `origin/feat/dashboard-ui`, `origin/main`) plus the `origin/HEAD` alias
- Authentication work is committed incrementally on `feat/database`.
- Working tree should be clean after this documentation update and final verification.

## Current implementation

- Supabase SQL installation is in `supabase/queries/001` through `006`.
- Tables: `roles`, `users`, `sessions`.
- Fixed roles: owner, admin, employee.
- Database trigger generates normalized, collision-safe usernames.
- RLS and grants block browser roles and permit the server secret role.
- Local auth uses Argon2id, generic credential errors, five-attempt lockout and 12-hour opaque sessions.
- Failed-login counters and the final-active-owner rule are atomic database operations, so concurrent requests cannot bypass them.
- Auth endpoints and manager-only user/role endpoints are implemented.
- Dashboard and income page require a live database session; `proxy.ts` adds an early cookie check.
- The login form calls the real API and the sidebar exposes logout.
- A one-time, empty-database-only owner bootstrap command is available.
- Tests cover schemas, username rules, hashing, authentication, sessions, authorization, repositories, lifecycle rules, API responses/routes, login UI, proxy and bootstrap policy.

## External action still required

The repository cannot apply schema changes automatically by design. In Supabase SQL Editor, run the six ordered scripts documented in `supabase/queries/README.md`. Then add the temporary owner values to local `.env`, run `npm run bootstrap:owner`, and remove those temporary values.

## Known boundaries

- Employee-specific permissions are intentionally deferred.
- The admin user-management frontend is not built yet; its API is ready.
- Sales, products, services, customers, cash and reports still use mock data or have no persistence model.
- End-to-end database verification depends on the manual SQL installation in the target Supabase project.

## Recommended next task

Build the employee administration page against `/api/admin/users` and `/api/admin/roles`, including create, edit, deactivate/reactivate and password-reset flows. Preserve all server-side lifecycle rules and keep employee permissions deferred until the business rules are defined.

## Context maintenance rule

Update this file after every completed task with the active branch, branch counts, delivered behavior, unresolved external actions, known boundaries and the single best next task. Update `product.md` whenever scope, module status or product objectives change; update `AGENTS.md` only when durable architecture or workflow changes.
