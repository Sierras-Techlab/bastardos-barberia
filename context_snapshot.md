# Context snapshot

Captured: 2026-08-08

## Repository state

- Current branch: `feat/user-administration` in the isolated `.worktrees/user-administration` worktree.
- Local branches: 3 (`dev`, `feat/user-administration`, `main`).
- Remote branches: 3 real branches (`origin/dev`, `origin/feat/dashboard-ui`, `origin/main`) plus the `origin/HEAD` alias
- The feature branch starts from local `dev` after the authentication integration and adds the complete user administration module.
- The feature will be merged back into `dev` only after complete verification and review.

## Current implementation

- Supabase SQL installation is in `supabase/queries/001` through `007`.
- Tables: `roles`, `users`, `sessions`.
- Fixed roles: owner, admin, employee.
- Database trigger generates normalized, collision-safe usernames.
- RLS and grants block browser roles and permit the server secret role.
- Local auth uses Argon2id, generic credential errors, five-attempt lockout and 12-hour opaque sessions.
- Failed-login counters and the final-active-owner rule are atomic database operations, so concurrent requests cannot bypass them.
- Auth endpoints and manager-only user/role endpoints are implemented.
- Logical user deletion stores `deleted_at`/`deleted_by`, excludes deleted accounts from normal reads and atomically revokes their sessions.
- `/users` is a responsive owner/admin-only workspace with search, role/status filters, pagination, create, profile edit, password replacement, activate/deactivate and delete flows.
- The sidebar exposes an active Usuarios link only to owner/admin users.
- Both the `/users` layout and leaf page independently require a live manager session.
- Dashboard and income page require a live database session; `proxy.ts` adds an early cookie check.
- The `/incomes` layout supplies the authenticated user to one persistent sidebar, while both list and new-income leaf pages independently revalidate the live session during client navigation.
- The login form calls the real API and the sidebar exposes logout.
- A one-time, empty-database-only owner bootstrap command is available.
- Tests cover schemas, username rules, hashing, authentication, sessions, authorization, repositories, lifecycle rules, API responses/routes, login UI, proxy and bootstrap policy.

## External action still required

The repository cannot apply schema changes automatically by design. Existing installations that already ran `001` through `006` must run `007_user_soft_deletion.sql` in Supabase SQL Editor before using delete or the updated user queries. Fresh installations must run all seven ordered scripts documented in `supabase/queries/README.md`.

## Known boundaries

- Employee-specific permissions are intentionally deferred.
- Deleted-user restore and deleted-user audit screens are intentionally outside the current UI.
- Sales, products, services, customers, cash and reports still use mock data or have no persistence model.
- End-to-end database verification depends on the manual SQL installation in the target Supabase project.

## Recommended next task

Define the persistent sales and cash domain (sales, line items, payments, expenses and register closures) before replacing the dashboard and income demonstration data.

## Context maintenance rule

Update this file after every completed task with the active branch, branch counts, delivered behavior, unresolved external actions, known boundaries and the single best next task. Update `product.md` whenever scope, module status or product objectives change; update `AGENTS.md` only when durable architecture or workflow changes.
