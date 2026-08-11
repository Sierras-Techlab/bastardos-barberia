# Product: Bastardos Barberia Admin

Last updated: 2026-08-11

## Vision

Provide Bastardos Barberia with a simple, reliable internal system that lets owners, administrators and employees operate the business without requiring technical knowledge. The interface should minimize choices, use explicit language and prevent dangerous mistakes at both the UI and server layers.

## Users and permissions

- Owner: full access. At least one active owner must always exist.
- Admin: full access for the current phase.
- Employee: authenticated operational access; granular restrictions will be defined with future modules.
- Accounts are created only by owner/admin. There is no self-registration or password recovery flow today.

## Product modules

| Module | State | Current result / objective |
| --- | --- | --- |
| Authentication | Implemented | Local username/password login, lockout, opaque DB sessions, logout and current user. |
| User administration API | Implemented | Create, list, inspect, update, activate/deactivate, reset passwords and logically delete; owner safety rules. |
| Dashboard UI | Prototype | Responsive authenticated dashboard with one Sonner-based action-notification system shared by Users, Products, Customers and Services. |
| Income entry UI | Prototype | Multi-step sales form based on demonstration data, now protected by real authentication. |
| Income history UI | Prototype | Filterable responsive income list and detail views based on demonstration data, protected by the authenticated incomes layout. |
| User administration UI | Implemented | Manager-only responsive workspace for search, filters, pagination and the complete supported user lifecycle. |
| Sales and cash | Planned | Define persistent sales, line items, payment methods, expenses and register closures. |
| Services and products | Prototype | Responsive mock catalogs with role-aware management. Products support stock and lifecycle actions; services use visual cards with price, search, sorting, activation and confirmed reload-scoped deletion. Persistent service deletion must be logical to preserve sales history. |
| Customers | Prototype | Responsive mock directory with required identity/contact fields, search, sorting and manager-only create/edit. Visits are read-only pending income integration. |
| Reports | Planned | Derive revenue and operating reports from real transactional data. |

## Current product objective

Implement the approved persistent commercial domain in two stages: Products and auditable inventory first, followed by Services, Customers and Incomes. Authentication and user administration are implemented, and migrations through `007` are installed and validated in the configured Supabase project.

The product catalog is now available as a frontend prototype. Product CRUD, persistent prices and stock, purchase costs and inventory movements still require domain and backend design.

The customer directory is also available as a frontend prototype. Persistence, customer history and the automatic visit increment produced by an associated income still require a shared frontend/backend contract.

The service catalog is available as a frontend prototype. Its reload-scoped changes are intentionally independent from the income form fixture until a persistent service contract replaces both mock sources.

The approved backend design makes customer phone the unique operational identity while allowing duplicate names and optional email. Every authenticated role may create and edit customers; only owner/admin may logically delete them.

The approved income design attributes a sale only to the authenticated user who registered it. Owner/admin may view all sales and employees only their own. Sales and manager-only voids will update inventory and customer visits atomically, preserve historical item snapshots, prevent duplicate submissions through idempotency, and store an indexed Buenos Aires business date for future daily cash calculations.

## Accepted authentication decisions

- Supabase is database-only; Supabase Auth is excluded.
- Login uses generated username plus administrator-assigned password.
- Username format is normalized `first.last`; collisions receive a numeric suffix and PostgreSQL is authoritative for Unicode transliteration.
- Passwords use Argon2id; sessions are opaque, hashed and revocable.
- Owner/admin authorization is enforced in server handlers and services, not trusted to middleware/proxy alone.
- Logical user deletion preserves audit identity, hides deleted accounts from normal reads and atomically revokes their sessions.
- The SQL installation stays manual and copy/paste friendly under `supabase/queries`.

## Definition of a safe product increment

A module is not complete only because its screen exists. It must validate input, enforce authorization at the server/data boundary, avoid secret leakage, cover critical behavior with tests, document integration requirements and update `context_snapshot.md`.
