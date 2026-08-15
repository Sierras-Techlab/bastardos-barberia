# Product: Bastardos Barberia Admin

Last updated: 2026-08-14

## Vision

Provide Bastardos Barberia with a simple, reliable internal system that lets owners, administrators and employees operate the business without requiring technical knowledge. The interface should minimize choices, use explicit language and prevent dangerous mistakes at both the UI and server layers.

## Users and permissions

- Owner: full access. At least one active owner must always exist.
- Owner sales belong entirely to the barbershop and never generate owner commission; future owner compensation must be modeled as a cash/expense movement.
- Admin: full access for the current phase.
- Employee: authenticated operational access; granular restrictions will be defined with future modules.
- Accounts are created only by owner/admin. There is no self-registration or password recovery flow today.

## Product modules

| Module | State | Current result / objective |
| --- | --- | --- |
| Authentication | Implemented | Local username/password login, lockout, opaque DB sessions, logout and current user. |
| User administration API | Implemented locally | Create, list, inspect, update, activate/deactivate, reset passwords and logically delete; owner rates are authoritatively normalized to 0 by migration 012, pending manual installation. |
| Dashboard UI | Implemented locally | Real role-scoped income summary, quick actions and persisted fixed-customer occurrences with attendance limited to the remaining current Monday-through-Saturday week. |
| Comisiones y pagos combinados | Implemented locally | Role-aware responsible employee, exact split payments, independently rounded item snapshots, owner-safe previews and audited 100% service/product-line exceptions; migrations 010 through 015 remain pending manual installation. |
| Historial de ingresos por rol | Implemented locally | Responsible-employee scoping/filtering across all historical users, V2 metrics, payments, commissions, registrant audit and full detail. |
| Income entry UI | Implemented | Real authenticated sale submission with active catalogs, server-authoritative totals, idempotency and inline customer creation. |
| Income history UI | Implemented | Role-scoped server filtering, monthly pagination, filtered metrics, read-only detail and manager-only voiding. |
| User administration UI | Implemented | Manager-only responsive workspace for search, filters, pagination, visible service/product commission rates and the complete supported user lifecycle. |
| Sales and cash | Sales implemented; cash planned | Persistent sales and item snapshots are ready; daily cash, expenses and register closures remain future work. |
| Products | Implemented locally | Persistent role-aware catalog, manager CRUD/lifecycle operations, atomic audited inventory movements and dynamic manager category administration. Migration `014` is implemented locally and pending manual installation; inactive items show `No disponible` regardless of retained stock. |
| Payment methods | In progress locally | The audited catalog/API, dynamic sale allocations, manager UI, historical filters and dashboard totals are implemented. The next increment adds permanent deletion for unused methods while referenced methods remain deactivatable and historically visible. |
| Services | Implemented | Persistent role-aware catalog, manager mutations, active-only employee reads and logical deletion preserving sales history. |
| Customers | Implemented locally | Persistent directory, optional weekly schedule, financial visit detail with immutable sale totals/prices/subtotals from active-sale snapshots, and audited attended/missed occurrences; migration 013 remains pending manual installation. |
| Reports | Planned | Derive revenue and operating reports from real transactional data. |

## Current product objective

Complete migration `016`, then manually install migrations `010` through `016` and run their SQL Editor acceptance checks before designing daily cash. The application behavior through Task 5 is verified locally; the configured project remains on scripts `001` through `009` until deployment is separately authorized.

The product catalog now loads through authenticated server persistence. Manager mutations are authorized at the API/service boundary, stock entries and exits are atomic and auditable, and employees receive active products only. Physical deletion and purchase cost remain outside scope.

The payment-method catalog validates trimmed names, manager-only lifecycle operations and last-active protection. Authenticated Route Handlers expose active and inactive historical methods, safely return a 404 for unknown IDs, authorize manager mutations before parsing and accept only rename/reactivation through `PATCH`; `DELETE` deactivates. Sales now submit one or more distinct UUID allocations, history retains immutable method names, manager filters include inactive methods and dashboard totals are dynamic. Migration `016` is still required to enforce and persist this application contract.

The approved deletion increment will make `DELETE` permanently remove only unused payment methods. Deactivation will move to `PATCH`, inactive methods will be hidden from the default administration list but remain recoverable, and referenced methods will retain restrictive foreign-key protection plus their immutable sale history.

The customer directory persists required normalized phones and optional emails. Exact names may repeat, all authenticated roles can create/edit, only managers can logically delete, and associated active sales increment visits atomically.

The service catalog and sale form now share persistent active services. Manager mutations are audited and deletion is logical, so historical sale snapshots and foreign-key references remain intact.

The approved backend design makes customer phone the unique operational identity while allowing duplicate names and optional email. Every authenticated role may create and edit customers; only owner/admin may logically delete them.

Each sale records both the authenticated registrant and responsible employee. Employees are forced to themselves; owner/admin may select an active user. Exact payment allocations and immutable per-item commission/net snapshots are calculated atomically with items, inventory and visits. Valid manager-to-other-non-owner exceptions may cover a service and multiple complete product quantities in the same sale. History and metrics scope employees to their responsible sales.

An owner may remain the responsible person for a sale, but that sale records zero service/product commission and its full amount as barbershop net. The 100% commission exception is valid only for a non-owner responsible user.

Income responses accept the explicit UTC offsets returned by PostgreSQL `timestamptz`, preventing a committed sale from being reported as failed during response validation.

Dashboard home now loads live fixed-customer occurrences only from the current Buenos Aires date through Saturday. It does not expose next week's recurring appointments early: Sunday is empty and the agenda rotates when the next Monday begins. Fixed schedules use one ISO weekday plus local time; attended/missed resolution is audited, concurrency-safe and independent from sales. Customer visit detail exposes dates, immutable item prices/subtotals and active-sale totals without employee, registrant, payment, commission or authorization data.

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
