# Context snapshot

Captured: 2026-08-11

## Repository state

- Current branch: `feat/backend-models` in the main worktree.
- Local branches: 9.
- Remote tracking references: 10, including the `origin/HEAD` alias.
- User administration is integrated into `dev`; its temporary worktree and local feature branch were removed after verification.

## Current implementation

- Supabase SQL installation source is in `supabase/queries/001` through `009`.
- Tables defined by the ordered scripts: `roles`, `users`, `sessions`, `products`, `inventory_movements`, `services`, `customers`, `incomes`, `income_items`.
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
- Dashboard recent activity reads the latest persisted income and customer on the server. Income visibility remains global for owner/admin and self-only for employees; expense activity stays demonstrative until that domain exists.
- `/products` is an authenticated, responsive persistent catalog with exact stock quantities, derived stock states, summary metrics, search, filters, stock/price sorting, a desktop table and mobile cards.
- Owner/admin product creation, profile edits, activation changes and stock entries/exits pass through manager-only Route Handlers and server services. Employees receive active products only from the server boundary and have no management controls.
- Product stock changes use database row locking, reject negative results and append an actor-linked inventory movement in the same transaction. Product creation stores creator/updater audit IDs and an optional initial-stock movement.
- The authenticated dashboard layout mounts one Sonner toaster. Successful actions in Users, Products, Customers, Services and income voiding use the same accessible, dismissible three-second notification; field validation and blocking errors remain contextual.
- Product filters use one, two, three or full-row columns according to viewport width so management filters stay compact when the browser shares the screen with development tools.
- Inactive products retain their exact stock for inventory work but show `No disponible` in manager desktop and mobile catalogs; quantity-only stock filters and metrics remain unchanged.
- `/customers` is persistent and responsive. Phone is the required normalized unique identity, exact names may repeat, email is optional/unique when supplied, all authenticated roles can create/edit, and owner/admin alone can logically delete. Missing email produces no `mailto:` action.
- The reusable async customer editor is also available from `/incomes/new`; a newly created customer is appended and selected without leaving the sale draft.
- `/services` is a persistent role-aware visual catalog. Owner/admin create, edit, activate/deactivate and logically delete; employees receive active services only. All writes carry authenticated audit users.
- `/incomes/new` loads real active products/services and customers after session authorization, fixes the registering user to the authenticated account, sends no actor/total/date overrides, and uses stable UUID request IDs for idempotent retries.
- Income creation is one PostgreSQL transaction: authoritative catalog snapshots and totals, deterministic product locks, stock deductions, sale-linked inventory movements and customer visit increments either all commit or all roll back.
- `/incomes` uses server-side role scoping, Buenos Aires monthly date defaults, filters, metrics and pagination. Owner/admin can inspect all registering users and confirm a void; employees can only receive their own sales and have no void control.
- Voiding is idempotent and manager-only. It marks rather than edits/deletes the sale, restores product stock, records reversal movements and decrements the associated customer visit exactly once.
- `incomes.created_at` comes from the database clock and `business_date` is derived/indexed in `America/Argentina/Buenos_Aires` for the next daily-cash increment.
- Income response validation accepts PostgreSQL `timestamptz` values with explicit UTC offsets. A runtime failure exposed this boundary after the transaction committed; the persisted sale remained intact and a regression test now covers the database's exact timestamp representation.
- The login form calls the real API and the sidebar exposes logout.
- A one-time, empty-database-only owner bootstrap command is available.
- Tests cover schemas, authentication/session/user lifecycle, server authorization, persistent commercial repositories/services/APIs, async catalog/customer UI, idempotent sale submission, role-scoped history and manager voiding.
- The approved staged migration from product, service, customer and income mocks to persistent server-authorized domains is implemented on `feat/backend-models` and installed in the configured Supabase project.
- The approved sales design attributes each sale only to the authenticated registering user, gives owner/admin global visibility, scopes employees to their own sales, supports phone-identified inline customer creation, and records both exact timestamps and Buenos Aires business dates for future daily cash work.
- Detailed TDD implementation plans are available at `docs/superpowers/plans/2026-08-11-products-inventory-backend.md` and `docs/superpowers/plans/2026-08-11-sales-domain-backend.md`. The user authorized autonomous in-scope execution, local verification and scoped commits, while remote SQL and credentials remain out of scope.
- The complete commercial milestone passes 97 test files / 307 tests, ESLint without warnings, the Next.js production build and `git diff --check`. Dashboard activity and product-availability verification ran on local Node 24.17/npm 11.13 although the repository target remains Node 24.18/npm 11.16.

## Database integration state

The configured Supabase project has scripts `001` through `009` installed. Runtime use confirmed product, service and customer creation, while a read-only database check confirmed the persisted income and the `get_income_detail` response from `009_sales_domain.sql`. SQL installation remains manual for other environments, which must run all nine ordered scripts documented in `supabase/queries/README.md`.

## Known boundaries

- Deleted-user restore and deleted-user audit screens are intentionally outside the current UI.
- Product deletion and purchase cost remain outside the persistent catalog.
- Other environments still depend on manually applying the ordered SQL files through Supabase SQL Editor.
- Physical deletion, sale editing, customer-history screens, expenses, daily cash/register closure and reporting remain outside this milestone.

## Recommended next task

Design the daily cash view from the deployed `created_at`, `business_date`, payment method and active/voided sales data.

## Context maintenance rule

Update this file after every completed task with the active branch, branch counts, delivered behavior, unresolved external actions, known boundaries and the single best next task. Update `product.md` whenever scope, module status or product objectives change; update `AGENTS.md` only when durable architecture or workflow changes.
