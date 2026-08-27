# Operational Control and Employee Privacy Design

**Date:** 2026-08-21
**Status:** Approved

## Goal

Extend the current sales, fixed-customer and automatic-cash foundation with five independently deployable increments: employee work sessions, manager-controlled sale prices, configurable owner commissions, strict employee financial privacy, fixed-customer monthly payments, manual cash reconciliation and customer last-visit visibility.

The implementation must keep income, commission, stock, subscription and cash records financially consistent. Every financial mutation is authoritative in PostgreSQL, auditable and atomic.

## Delivery strategy

The work is split into five ordered increments. Each increment has its own SQL migration, application changes, tests, acceptance checks and commit history. A later increment may consume interfaces established by an earlier one, but each block must leave the application usable before the next begins.

1. `019_employee_work_sessions.sql`: employee clock-in/out, audited corrections and per-session production.
2. `020_income_pricing_owner_commissions_and_employee_privacy.sql`: configurable owner commission, line price overrides and employee-safe income contracts.
3. `021_fixed_customer_monthly_payments.sql`: professional-owned fixed customers and atomic monthly payments.
4. `022_manual_cash_lifecycle.sql`: opening balance, manual/automatic closing and counted-cash confirmation.
5. `023_customer_last_visit.sql`: active-sale-derived last visit in the customer directory.

Canonical tables and RPCs must not use `_v2` or other version suffixes. SQL remains ordered and copy/paste friendly under `supabase/queries`, with `supabase/queries/README.md` documenting installation and rollback-wrapped acceptance checks.

## Shared invariants

- The business timezone is `America/Argentina/Buenos_Aires`. Business dates, work-session dates, monthly periods and cash dates use that timezone.
- Monetary values are non-negative integer ARS amounts stored as `bigint`. Percentage rates remain integers from 0 through 100. Payment percentages use integer basis points from 0 through 10,000 to avoid floating-point drift.
- PostgreSQL calculates authoritative prices, payment amounts, commissions, stock changes and cash effects. React previews are informational and must reproduce the same rules.
- A historical snapshot is never rewritten because a catalog price, commission rate, responsible professional or customer configuration changes later.
- Mutations that can be retried use idempotency keys or unique business constraints. A semantically different retry with the same key returns a conflict.
- Authorization is enforced before input parsing in Route Handlers and again at the service/database boundary. UI visibility is not treated as security.
- All new tables enable RLS with no browser policies. Only the server secret role may execute the security-definer RPCs.
- Every sensitive change records the authenticated actor and timestamp. Price overrides and manual time corrections additionally require a trimmed, non-empty reason.

## Increment 019: employee work sessions

### Product behavior

- Only a user whose current role is `employee` starts and ends their own work session, from a persistent dashboard/header control after signing in. Owner/admin do not clock in and their own sales are not assigned to a work session.
- An employee must have an open session to register a sale. A rejected sale does not create income, payments, stock movements or cash effects.
- Owner/admin may register a sale for an employee without an open session. The income is explicitly audited as outside a work session rather than silently attached to another session.
- Owner/admin may correct clock-in or clock-out times. Every correction requires a reason and preserves the prior values in an audit event.
- Production is calculated per session, not by whole calendar day. An employee sees hours worked, sale count and their own commission generated. Managers additionally see gross sales and barbershop net.
- Only one open session may exist for a user. A user may have multiple completed sessions on one business date if they clock out and later clock in again.

### Persistence

`employee_work_sessions` stores the employee, local business date, `started_at`, optional `ended_at`, start/end actor and lifecycle timestamps. A partial unique index enforces one open session per employee.

`employee_work_session_corrections` is append-only and stores the session, correcting manager, reason, prior timestamps, corrected timestamps and correction time.

`incomes.work_session_id` is nullable. Employee-created sales require and reference the employee's open session. Manager-created sales reference the responsible user's open session when one exists; otherwise `work_session_id` remains null and `outside_work_session` is true.

Session metrics derive from active incomes linked to that exact session. Voided incomes do not contribute to financial totals or sale count.

### Interfaces

- `POST /api/work-sessions/start`
- `POST /api/work-sessions/end`
- `GET /api/work-sessions/current`
- `GET /api/work-sessions` for role-scoped history and metrics
- `PATCH /api/work-sessions/[id]` for manager-only audited correction

Stable conflicts cover an already-open session, no open session to end, invalid corrected ranges, employee sale without an open session and concurrent lifecycle changes.

## Increment 020: pricing, owner commission and employee privacy

### Configurable owner commission

Migration `020` removes the database rules introduced by `012` that force owner commission rates and owner-attributed sale snapshots to zero. It does not assign a new rate: existing owners remain at zero until owner/admin edits their service and product percentages through the existing user editor.

Owner commission is then calculated with the same service/product rules as every other responsible professional. It remains a commission snapshot separated from barbershop net.

The exceptional 100% service/product-line grant remains manager-only and retains its existing authorization rules. It is independent from the configured owner percentage.

### Manager-controlled final prices

- Only owner/admin may change the amount charged for a service or product line.
- A manager may discount, surcharge or set a line to zero. Employee submissions always use the authoritative catalog price.
- Commission is calculated from the actual charged line subtotal, never from the catalog subtotal.
- Each income item snapshots catalog unit price, charged unit price, quantity, catalog subtotal, charged subtotal, signed adjustment amount, commission base/rate/amount, override actor and override reason.
- Any difference from the catalog price requires a reason. Unchanged lines have no override actor or reason.
- A zero-total sale is valid for an exceptional gift. It stores the sale, item snapshots, customer relationship and product stock movement, has zero commission and no payment rows.
- Product stock continues to decrement by quantity even when a product line is free.

Example: a service catalogued at ARS 20,000 is charged at ARS 10,000 to a professional with a 50% service commission. The snapshots retain ARS 20,000 catalog value, ARS 10,000 charged value, ARS 10,000 discount, ARS 5,000 commission and ARS 5,000 barbershop net.

### Strict employee financial privacy

Managers keep the complete sale, catalog, payment, commission and barbershop-net projections.

Employees receive distinct server-side response schemas:

- Catalog choices contain identity, display name, availability/stock and the employee's estimated earning for the selected unit or service. They do not contain catalog price, charged amount or barbershop net.
- Sale confirmation and creation results contain concepts, quantities and only the responsible employee's commission total and per-line earning.
- Income list, detail, metrics and sales-book projections contain customer, concepts, quantities, dates, status, sale count and the employee's commission. They exclude gross total, catalog/charged prices, discount/surcharge, payment amounts and barbershop net.
- Dashboard cards and work-session metrics use the same sanitized projection. The employee never receives hidden manager-only values in page props or API JSON.

An employee still chooses one or more payment methods, but supplies percentages rather than money. Percentages are integer basis points that must sum to 10,000 for a positive sale. The server applies them to the hidden authoritative charged total and assigns any integer remainder deterministically to the last allocation. Managers continue entering exact payment amounts because they can see the total.

## Increment 021: fixed customers and monthly payments

### Professional ownership

- Every active fixed-customer schedule has exactly one responsible professional and one positive monthly price.
- Owner/admin selects any active responsible user and may reassign the customer later.
- An employee creating a fixed schedule is automatically selected as responsible and cannot reassign it.
- Employee agenda, fixed-customer list and monthly status queries return only customers currently assigned to that employee. Managers may view and filter all professionals.
- Reassignment affects future unpaid collections. Paid income and commission snapshots retain the professional and rates used at payment time.

Responsible professional and monthly price are stored on effective-dated fixed-schedule versions so schedule history remains coherent. Changing weekday, time, professional or monthly price creates the same audited version transition used by the existing schedule model.

### Monthly payment state

Each fixed customer has a status per calendar month:

- `pending`: no active payment exists for that customer and month;
- `paid`: one active subscription income exists.

Marking a month paid is not a standalone checkbox update. The flow collects payment method allocation, then one PostgreSQL transaction:

1. locks the current fixed schedule and monthly obligation;
2. snapshots customer, month, monthly price, responsible professional and current service commission rate;
3. creates an income with kind `fixed_subscription`;
4. creates normalized payments and the corresponding daily cash effect;
5. stores commission and barbershop net snapshots;
6. links the monthly payment attempt to the income and returns `paid`.

The existing configured service commission percentage is used; no subscription-specific commission setting is introduced. Employee payment-method entry follows the percentage contract from `020`; managers use exact amounts.

An employee collecting a monthly payment must have an open work session, and the subscription income is linked to it. A manager may collect for an employee without an open session under the same audited outside-session rule as a normal sale.

A subscription income counts as revenue, commission and cash on the business date it is paid. It does not create a barbering visit and does not update customer last visit.

Voiding the linked income invalidates that payment attempt and makes the month pending again. The voided attempt remains auditable, and a later repayment creates a new attempt rather than rewriting history. A unique active-attempt constraint and idempotency key prevent double payment.

## Increment 022: manual cash lifecycle

### Opening

The existing `daily_cash_registers` model is evolved incrementally; no parallel versioned cash table is introduced.

- Owner/admin may manually open the current business date with ARS 0 or a non-negative physical opening balance.
- The opening balance represents cash already present in the drawer, such as change. It is not revenue, a sale, an income, a payment or a commission.
- The opening UI may open only, or open and continue to `Cargar ingreso`. A previously completed sale must be entered as an income; it must never be disguised as opening balance.
- If no manager opened the date, the first committed normal or subscription income atomically creates the register with opening balance ARS 0 and source `first_income`.
- Repeated or concurrent open attempts return the existing open register only when semantically identical; conflicting opening balances are rejected.

### Expected physical cash

Only the protected system payment method `Efectivo` represents physical drawer cash. Renaming, deactivating or deleting that semantic method is forbidden. Transfer, QR and any future method do not affect physical expected cash.

Expected cash equals opening balance plus active cash payment receipts plus audited cash adjustments/refunds. Commission separation does not remove money from the drawer; commission payout and expenses remain separate future cash movements.

### Manual and automatic closing

- A manager may manually close the current open register by entering counted physical cash.
- Closing snapshots sales, commissions, barbershop net, dynamic payments and expected cash exactly once. It also records counted cash and `difference = counted - expected`.
- Closed financial membership and totals remain immutable.
- If no manager closes a date, the existing hourly recovery job closes it after the local date changes. The automatic close snapshots the finances and expected cash but has no counted amount, so its reconciliation state is `pending_confirmation`.
- Owner/admin later confirms an automatically closed register by entering counted cash. Confirmation adds the reconciliation actor/time/count/difference without recomputing or rewriting the financial snapshot.
- Manual closures are immediately `confirmed`. Confirmation is single-use; correcting a confirmed count is outside this increment.
- A manually opened day with no activity is still closed and retained. A day with neither an opening nor income remains absent.

The cash UI separates opening balance, sales/payment economics and reconciliation so opening cash is never presented as revenue. Employees cannot access cash APIs or screens.

## Increment 023: customer last visit

The customer directory adds `lastVisitBusinessDate` and presents both the local date and relative age, for example `15/08/2026 · hace 6 días`. Customers without a qualifying visit show `Sin visitas`.

The value is derived from the latest active normal income containing that customer. It includes service and/or product sales, excludes voided incomes and excludes `fixed_subscription` income. Because it is query-derived from indexed income data, a void immediately reveals the preceding qualifying visit without repairing a denormalized customer column.

The field follows existing role-safe customer reads and introduces no employee, payment, price or commission data.

## API, domain and UI boundaries

Each increment follows the current layered structure:

- Zod schemas define request, database-response and role-specific browser contracts.
- Repositories call canonical RPCs and translate database rows without recalculating authoritative money.
- Services enforce domain permissions and map stable database errors to safe application errors.
- Route Handlers authorize before path/query/body validation and never accept the authenticated actor from browser input.
- Browser API clients use strict response parsing and `cache: "no-store"` where data is operational.
- UI components consume already-sanitized role contracts; manager and employee differences are not implemented by CSS-only hiding.

Relevant Next.js 16 App Router and Route Handler documentation under `node_modules/next/dist/docs/` must be reread immediately before implementation.

## Error handling and concurrency

Stable domain errors cover:

- work session already open, missing, already closed or concurrently changed;
- employee sale without an open session;
- invalid payment percentages or exact allocations;
- unauthorized price override, zero/negative-invalid amount or missing override reason;
- stale fixed-schedule version, inactive professional, monthly payment already active or retry conflict;
- cash already open/closed, conflicting opening balance, invalid counted cash or already-confirmed reconciliation;
- inactive/deleted catalog, customer or payment-method rows and insufficient product stock.

Financial RPCs lock rows in a documented order and perform validation before the first write. Income creation, monthly payment and first-income cash opening share one transaction. Concurrent retries either return the same committed result or a safe conflict; they never double-decrement stock, double-create commission, double-pay a month or double-open cash.

## Testing and acceptance

Every block uses red-green-refactor TDD and includes:

- schema and pure calculation tests for money, basis points, rounding and role-specific projections;
- repository/service/Route Handler tests for authorization-before-validation, stable errors, idempotency and response sanitization;
- component tests for employee/manager visibility and form state transitions;
- structural migration tests for canonical objects, RLS, grants, constraints and removal of superseded owner-zero rules;
- rollback-wrapped SQL acceptance scenarios for real transactions, concurrency-sensitive uniqueness and snapshot reconciliation;
- focused tests, the complete Vitest suite, `npx tsc --noEmit`, `npm run lint`, `git diff --check` and the Next.js production build.

Mandatory acceptance examples include:

- employee clock-in, sale, clock-out and session-only commission totals;
- rejected employee sale without a session and audited manager outside-session sale;
- owner rate changed from 0 and reflected only on future sales;
- ARS 20,000 catalog service charged at ARS 10,000 with a 50% commission;
- free service/product line with stock and audit preserved but no payment rows when total is zero;
- employee responses containing no gross, price, payment amount or barbershop-net keys;
- percentage split with deterministic integer remainder;
- monthly payment creating exactly one income/cash effect, void returning the month to pending and retry safety;
- manual cash opening at ARS 10,000 without revenue, first-sale automatic opening at ARS 0, counted difference and automatic pending confirmation;
- last visit changing to the prior normal sale after void and remaining unchanged after subscription payment.

## Documentation and deployment

For each completed increment:

1. update `supabase/queries/README.md` with ordered execution and isolated acceptance checks;
2. update generated/manual database row types and all strict browser contracts;
3. update `context_snapshot.md`, `product.md` and durable `AGENTS.md` invariants only for behavior actually delivered;
4. apply that migration to Supabase before deploying its dependent application commit;
5. verify the installed database with the documented acceptance block.

Migration `020` intentionally changes the current owner-zero product rule. Migration `022` intentionally changes Caja from read-only automatic closure to an opening/reconciliation lifecycle. Until those migrations and matching application blocks are installed together, the current `012` and `018` behavior remains authoritative.

## Out of scope

- Expense CRUD or commission payout movements.
- Automatic recurring billing, reminders or external payment collection.
- Multiple responsible professionals for one fixed customer.
- Subscription-specific commission rates.
- Employee visibility of gross revenue, catalog prices, charged totals, payment amounts or barbershop net.
- Editing a completed sale; managers may void and recreate under the existing audit model.
- Correcting an already confirmed cash count.
- Payroll, shifts, breaks, overtime and labor-rule calculations beyond recorded work-session duration and production.
- Export, PDF and final profitability reports.
