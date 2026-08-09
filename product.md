# Product: Bastardos Barberia Admin

Last updated: 2026-08-09

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
| Dashboard UI | Prototype | Responsive dashboard based on demonstration data, now protected by real authentication. |
| Income entry UI | Prototype | Multi-step sales form based on demonstration data, now protected by real authentication. |
| Income history UI | Prototype | Filterable responsive income list and detail views based on demonstration data, protected by the authenticated incomes layout. |
| User administration UI | Implemented | Manager-only responsive workspace for search, filters, pagination and the complete supported user lifecycle. |
| Sales and cash | Planned | Define persistent sales, line items, payment methods, expenses and register closures. |
| Services and products | Prototype | Authenticated read-only product catalog with mock prices, exact stock quantities, derived stock states, search, filters and responsive desktop/mobile views; persistence and inventory movements remain planned. |
| Customers | Planned | Define customer identity, contact and visit history. |
| Reports | Planned | Derive revenue and operating reports from real transactional data. |

## Current product objective

Define the persistent sales and cash domain before replacing dashboard demonstration data. Authentication and user administration are implemented, and migrations through `007` are installed and validated in the configured Supabase project.

The product catalog is now available as a frontend prototype. Product CRUD, persistent prices and stock, purchase costs and inventory movements still require domain and backend design.

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
