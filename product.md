# Product: Bastardos Barberia Admin

Last updated: 2026-08-25

## Vision

Provide Bastardos Barberia with a simple, reliable internal system that lets owners, administrators and employees operate the business without requiring technical knowledge. The interface should minimize choices, use explicit language and prevent dangerous mistakes at both the UI and server layers.

## Users and permissions

- Owner: full access. At least one active owner must always exist.
- Owner commission rates are manager-configurable; future owner-attributed sales snapshot the configured rate and separate the owner's earning from barbershop net.
- Admin: full access for the current phase.
- Employee: authenticated operational access; granular restrictions will be defined with future modules.
- Accounts are created only by owner/admin. There is no self-registration or password recovery flow today.

## Product modules

| Module | State | Current result / objective |
| --- | --- | --- |
| Authentication | Implemented | Local username/password login, lockout, opaque DB sessions, logout and current user. |
| User administration API | Implemented locally | Create, list, inspect, update, activate/deactivate, reset passwords and logically delete; migration `020` removes the former owner-zero invariant for future sales and incremental `029_user_commission_profile_rpc.sql` repairs upgraded databases. |
| Dashboard UI | Implemented locally | Real role-scoped income summary, quick actions and persisted fixed-customer occurrences with attendance limited to the remaining current Monday-through-Saturday week. |
| Comisiones y pagos combinados | Implemented locally | Role-aware responsible employee, exact split payments, independently rounded item snapshots, owner-safe previews, audited 100% service/product-line exceptions, manager-controlled charged-price overrides with reason, employee percentage payment entry, employee-sanitized projections; migrations 010 through 015 plus 020 remain pending manual installation. |
| Historial de ingresos por rol | Implemented locally | Responsible-employee scoping/filtering across all historical users, V2 metrics, payments, commissions, registrant audit and full detail. |
| Income entry UI | Implemented | Real authenticated sale submission with active catalogs, server-authoritative totals, idempotency and inline customer creation. |
| Income history UI | Implemented | Role-scoped server filtering, monthly pagination, filtered metrics, read-only detail and manager-only voiding. |
| User administration UI | Implemented | Manager-only responsive workspace for search, filters, pagination, visible service/product commission rates and the complete supported user lifecycle. |
| Sales and cash | Implemented locally | Persistent sales feed a manager-only Caja workspace. Migration `022` adds manual open/close/confirm with automatic first-income opening and automatic pending-confirmation closing; reconciliation never recomputes closed snapshots. Migration `018` historical snapshots remain immutable and the canonical `Efectivo` payment method is protected by `system_code='cash'`. Expenses remain separate. |
| Presentismo | Installed in test | Employee-only persistent clock, responsive role-scoped history and optimistic manager correction UI are backed by migration `019`, authenticated API and a no-store browser client with strict role-specific response parsing. Employee sales require an open session; manager-to-employee sales link an open session or record an outside-session audit flag. |
| Products | Implemented locally | Persistent role-aware catalog, manager CRUD/lifecycle operations, atomic audited inventory movements and dynamic category administration with permanent deletion restricted to categories that were never assigned to a product. Migrations `014` and incremental `017` remain pending manual installation; inactive items show `No disponible` regardless of retained stock. |
| Payment methods | Implemented locally | Audited dynamic catalog and allocations, manager create/rename/deactivate/reactivate UI, historical filters/dashboard totals and permanent deletion restricted to unused methods. Migration `016` must be rerun manually before using deletion against Supabase. |
| Services | Implemented | Persistent role-aware catalog, manager mutations, active-only employee reads and logical deletion preserving sales history. |
| Customers | Implemented locally | Persistent directory, optional weekly schedule with responsible professional and monthly price, financial visit detail with immutable sale totals/prices/subtotals from active-sale snapshots, audited attended/missed occurrences and a query-derived "Última visita" column derived from the latest active normal sale through migration `023`. Migration `025` repairs schedule creation/editing on databases upgraded through `021`. |
| Fixed-customer monthly payments | Installed in test | Manager-controlled monthly price and professional assignment, role-aware collection (manager amount / employee basis points), atomic subscription income with append-only attempts, employee-safe financial projections, void-reopens-month behaviour and dashboard/cash integration; incremental schedule repair `025` remains pending. |
| Expenses | Implemented locally | Manager-only monthly operating view with authoritative income/net/result summary, filtered expense ledger, audited create/edit/void flows, optional administrative payment method and recoverable category lifecycle. Expenses do not alter Caja in MVP; incremental migration `027` repairs the versioned void RPC on databases that installed the first `026` revision. |
| Reports | Installed in test | Manager-only visual business-performance report: equivalent monthly comparison, labeled projection, financial result, daily evolution, income/payment/expense composition and service/product highlights. Its period selector exposes the current month plus only historical months with active income or expense activity. Migration `039` and its manager/employee PostgreSQL acceptance are verified in test. |

## Current product objective

The active implementation branch is `codex/business-reports`. The test database is installed through `039_business_reports.sql`. Repeatable direct-PostgreSQL, authenticated-HTTP and multi-connection acceptance now verify RLS/grants, canonical RPCs, authentication/session lifecycle, administrative catalogs, inventory, customers/schedules, presentismo, role-aware incomes, overrides, commissions, fixed monthly payments, live and closed Caja projections, expenses, reports and critical stock/session/idempotency races. The runners remove or roll back every acceptance-owned fixture. Production remains gated on a separate clean-install environment and production deployment approval.

The first Reportes increment is implemented on `codex/business-reports` from merged `dev`, following `docs/superpowers/specs/2026-08-25-business-reports-design.md` and `docs/superpowers/plans/2026-08-25-business-reports.md`. It remains manager-only and explains business performance without duplicating Caja reconciliation or exposing employee/customer identities. Migration `039` and its rollback-only database acceptance are installed and verified in test; authenticated responsive visual acceptance remains pending.

The operational-control roadmap comprises `019` employee work sessions, `020` manager price overrides/configurable owner commission/employee-safe projections, `021` professional-owned fixed customers with atomic monthly payments, `022` manual Caja lifecycle and `023` derived customer last visit. These blocks are installed in the test database. Customer visit totals continue to count only active normal sales; subscription incomes affect Caja and dashboards without inflating visit history.

Caja supports manual open/close/confirm with automatic first-income opening and automatic pending-confirmation closing; reconciliation never recomputes closed snapshots. Incremental `028` repairs the live opened-register UUID projection for databases that already installed `022`.

When the current Buenos Aires Caja is closed, the income history, dashboard quick actions and Caja workspace no longer offer income creation, and direct navigation to `/incomes/new` redirects back to the ledger. The database still rejects any stale form submission that races with closure.

The payment-method catalog validates trimmed names, manager-only lifecycle operations and last-active protection. Authenticated Route Handlers expose active and inactive historical methods and safely return a 404 for unknown IDs. `PATCH` handles rename, deactivation and reactivation; `DELETE` permanently removes only unused methods. Referenced methods return a stable conflict and remain available for logical deactivation, preserving immutable sale history. The manager UI shows active methods by default and keeps inactive methods in a separate recoverable view. Sales submit one or more distinct UUID allocations, manager filters include historical methods and dashboard totals are dynamic. The latest migration `016` is required to enforce this contract.

The customer directory persists required normalized phones and optional emails. Exact names may repeat, all authenticated roles can create/edit, only managers can logically delete, and associated active sales increment visits atomically.

The service catalog and sale form now share persistent active services. Manager mutations are audited and deletion is logical, so historical sale snapshots and foreign-key references remain intact.

The approved backend design makes customer phone the unique operational identity while allowing duplicate names and optional email. Every authenticated role may create and edit customers; only owner/admin may logically delete them.

Each sale records both the authenticated registrant and responsible employee. Employees are forced to themselves; owner/admin may select an active user. Exact payment allocations and immutable per-item commission/net snapshots are calculated atomically with items, inventory and visits. Valid manager-to-other-non-owner exceptions may cover a service and multiple complete product quantities in the same sale. History and metrics scope employees to their responsible sales.

An owner may remain responsible for a sale. Future owner-attributed sales use the configured commission rates; a zero-rate sale keeps the full amount as barbershop net. The 100% commission exception remains valid only for a non-owner responsible user.

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
