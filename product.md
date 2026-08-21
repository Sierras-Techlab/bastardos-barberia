# Product: Bastardos Barberia Admin

Last updated: 2026-08-21

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
| Sales and cash | Implemented locally | Persistent sales feed a manager-only live daily cash view. Migration `018` automatically and idempotently closes active prior dates into immutable sale/payment snapshots; post-close voids become audited negative adjustments. Expenses remain separate. |
| Presentismo | Implemented locally | Employee-only persistent clock, responsive role-scoped history and manager correction UI are backed by migration `019`, authenticated API and a no-store browser client. Employee sales require an open session; manager-to-employee sales link an open session or record an outside-session audit flag. Manual Supabase installation of `019` remains pending. |
| Products | Implemented locally | Persistent role-aware catalog, manager CRUD/lifecycle operations, atomic audited inventory movements and dynamic category administration with permanent deletion restricted to categories that were never assigned to a product. Migrations `014` and incremental `017` remain pending manual installation; inactive items show `No disponible` regardless of retained stock. |
| Payment methods | Implemented locally | Audited dynamic catalog and allocations, manager create/rename/deactivate/reactivate UI, historical filters/dashboard totals and permanent deletion restricted to unused methods. Migration `016` must be rerun manually before using deletion against Supabase. |
| Services | Implemented | Persistent role-aware catalog, manager mutations, active-only employee reads and logical deletion preserving sales history. |
| Customers | Implemented locally | Persistent directory, optional weekly schedule, financial visit detail with immutable sale totals/prices/subtotals from active-sale snapshots, and audited attended/missed occurrences; migration 013 remains pending manual installation. |
| Reports | Planned | Derive revenue and operating reports from real transactional data. |

## Current product objective

The approved next roadmap is split into five deployable blocks: `019` employee work sessions and presentism; `020` manager price overrides, configurable owner commission and employee-safe financial projections; `021` professional-owned fixed customers with atomic monthly payments; `022` manual cash opening/counting with automatic pending-confirmation fallback; and `023` customer last visit derived from active normal sales. Block `019` is implemented locally across migration, domain, authenticated API and responsive UI, but `019_employee_work_sessions.sql` has not been applied to the configured Supabase project. Its persistent clock is employee-only and server-authoritative for actor/timestamps; employee sales require an open session, while managers do not and manager-to-employee sales either link that employee's open session or record `outsideWorkSession`. Manager corrections require a reason and retain immutable prior/new timestamps. Exact-session metrics exclude voids, with gross/net retained only for manager projections. The current `012` owner-zero and `018` automatic read-only Caja behavior remains authoritative until its matching block is installed.

The installed baseline through `018` keeps Caja read-only and automatic: it derives live totals from incomes, exposes dynamic payment totals and sale-level audit, skips empty dates and never asks a manager to open or close the day. The approved `022` block will evolve that same canonical model instead of introducing version-suffixed tables or RPCs.

The product catalog now loads through authenticated server persistence. Manager mutations are authorized at the API/service boundary, stock entries and exits are atomic and auditable, and employees receive active products only. Managers may permanently delete a category only while no product—active or inactive—references it; referenced categories remain recoverable through logical deactivation. The category dialog separates active and inactive records and requires destructive confirmation. Product physical deletion and purchase cost remain outside scope.

The payment-method catalog validates trimmed names, manager-only lifecycle operations and last-active protection. Authenticated Route Handlers expose active and inactive historical methods and safely return a 404 for unknown IDs. `PATCH` handles rename, deactivation and reactivation; `DELETE` permanently removes only unused methods. Referenced methods return a stable conflict and remain available for logical deactivation, preserving immutable sale history. The manager UI shows active methods by default and keeps inactive methods in a separate recoverable view. Sales submit one or more distinct UUID allocations, manager filters include historical methods and dashboard totals are dynamic. The latest migration `016` is required to enforce this contract.

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
