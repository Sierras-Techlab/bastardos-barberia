# Context snapshot

Captured: 2026-08-09

## Repository state

- Current branch: `feat/16-products-view` in the main worktree.
- Local branches: 6.
- Remote tracking references: 7, including the `origin/HEAD` alias.
- User administration is integrated into `dev`; its temporary worktree and local feature branch were removed after verification.

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
- A URL-transparent `(dashboard)` route group supplies one persistent authenticated sidebar to `/`, `/incomes`, `/incomes/new` and `/users`.
- Every private leaf page still revalidates its live database session; request-scoped React memoization deduplicates layout-plus-page checks, while `proxy.ts` remains only an early cookie check.
- Session activity writes are throttled to five-minute intervals, avoiding a blocking `last_seen_at` update on every navigation without caching authorization across requests.
- Income history and dashboard home provide matching centered loading states inside the persistent shell.
- `/products` is an authenticated, responsive read-only catalog backed by validated demonstration data, with summary metrics, search, category/availability filters, a desktop table and mobile cards.
- The login form calls the real API and the sidebar exposes logout.
- A one-time, empty-database-only owner bootstrap command is available.
- Tests cover schemas, username rules, hashing, authentication, sessions, authorization, repositories, lifecycle rules, API responses/routes, login UI, proxy, bootstrap policy and the complete user-management UI lifecycle, including pagination and keyboard access.

## Database integration state

The configured Supabase project has migrations `001` through `007` installed. The `deleted_at` and `deleted_by` columns were verified through the server connection and the application session flow is working. No authentication or user-schema action remains for this environment. Fresh installations must still run all seven ordered scripts documented in `supabase/queries/README.md`.

## Known boundaries

- Employee-specific permissions are intentionally deferred.
- Deleted-user restore and deleted-user audit screens are intentionally outside the current UI.
- Sales, products, services, customers, cash and reports still use mock data or have no persistence model.
- Product creation, editing, deletion, purchase cost, numeric stock, inventory movements and backend persistence are intentionally outside the current catalog prototype.
- Other environments still depend on manually applying the ordered SQL files through Supabase SQL Editor.

## Recommended next task

Define the persistent sales and cash domain (sales, line items, payments, expenses and register closures) before replacing the dashboard and income demonstration data.

## Context maintenance rule

Update this file after every completed task with the active branch, branch counts, delivered behavior, unresolved external actions, known boundaries and the single best next task. Update `product.md` whenever scope, module status or product objectives change; update `AGENTS.md` only when durable architecture or workflow changes.
