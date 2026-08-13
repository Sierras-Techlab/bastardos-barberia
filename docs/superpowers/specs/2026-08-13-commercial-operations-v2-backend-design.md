# Commercial Operations V2 Backend Design

**Status:** Approved 2026-08-13  
**Base branch:** `origin/dev` at `05b479f`  
**Timezone:** `America/Argentina/Buenos_Aires`

## Objective

Complete the persistent backend and database contracts already prepared by the frontend for responsible-employee attribution, split payments, accrued commissions and weekly fixed customers. Add a customer visit-history dialog backed by active sales, and replace the dashboard's fixed-customer fixture with authorized persistent occurrences.

The work is divided into two independently testable increments:

1. Income attribution, user commission rates, split payments and immutable commission snapshots.
2. Customer visit history, one weekly fixed schedule per customer, occurrence attendance and live dashboard integration.

## Existing foundation

`origin/dev` already contains:

- Persistent users, products, services, customers, incomes and income items through ordered SQL scripts `001` to `009`.
- Transactional, idempotent income creation and manager-only voiding.
- The frontend V2 income form, responsible-employee selector, split-payment editor, commission preview and complete confirmation dialog.
- Role-aware income list and detail presentations with legacy fallbacks.
- User commission fields in the manager editor, currently rejected by strict backend schemas.
- Optional fixed schedule controls in the customer editor and a dashboard occurrence card backed by a fixture.

This design completes those contracts. It does not redesign the existing prepared UI.

## Global constraints

- Use Next.js 16.3 App Router and Route Handlers, React 19.2, strict TypeScript, Zod 4, Vitest and the existing Supabase server client.
- Browser code never imports the Supabase server client and never receives `SUPABASE_SECRET_KEY`.
- Every private page and API operation reauthorizes at the server or data boundary; `proxy.ts` remains only an optimistic cookie-presence check.
- PostgreSQL is authoritative for actors, eligibility, catalog prices, totals, commission rates, commission amounts, timestamps and business dates.
- Monetary values remain integer Argentine pesos. Percentage components use `round(base * rate / 100)` independently before summing.
- SQL files under `supabase/queries` remain the installation source of truth and are applied manually in numeric order.
- The implementation creates SQL files and tests but does not apply them to the shared Supabase project without separate explicit authorization.
- Existing sales, inventory, visit counters and audit identities must survive both migrations.
- No commission settlement, advances, partial payout, expenses, cash closure or reporting module is added.

## Increment 1: income attribution, payments and commissions

### User commission configuration

Add these non-null user fields with zero defaults and `0..100` checks:

- `service_commission_rate smallint`
- `product_commission_rate smallint`

Safe user responses, manager list/detail responses and manager create/update inputs expose `serviceCommissionRate` and `productCommissionRate`. Credential queries may select the fields because `SafeUser` includes them, but responses never expose password hashes, login counters, session tokens or deleted-user metadata.

User creation persists both rates atomically with the account. Profile and commission changes use one database function so a manager edit cannot partially apply. Rate changes affect future sales only; stored income snapshots never change.

### Registering user and responsible employee

An income stores two identities:

- `registered_by`: the authenticated account that submitted the request.
- `employee_id`: the active, non-deleted account responsible for the sale and its commission.

Historical `incomes.user_id` data is migrated to both identities. The final schema uses `registered_by` as the unambiguous name; it does not retain two writable columns for the same concept.

Authorization rules:

- An employee is always assigned to their own user ID, regardless of any `employeeId` supplied by the browser.
- An owner or admin may assign any active, non-deleted owner, admin or employee, including themselves.
- The backend rejects an unknown, inactive or deleted responsible account with `EMPLOYEE_NOT_ELIGIBLE`.
- Income history is scoped and filtered by `employee_id`, not by `registered_by`. Consequently, an employee sees a sale that a manager registered on their behalf.
- `registered_by` always comes from the authenticated session and is never accepted from JSON.

### Normalized payments

Create `income_payments` with:

- `id uuid primary key`
- `income_id uuid not null references incomes(id)`
- `method text not null check (method in ('cash', 'transfer'))`
- `amount bigint not null check (amount > 0)`
- `created_at timestamptz not null default now()`
- Unique `(income_id, method)` so a sale has at most one row per method.

The browser sends one or two payment rows. A combined payment is represented by one cash row and one transfer row; `combined` is never stored as a method. PostgreSQL rejects empty arrays, duplicates, unknown methods, non-integers, non-positive amounts and allocations whose sum differs from the authoritative sale total.

Historical rows are backfilled from `incomes.payment_method` and `incomes.total`. The legacy `payment_method` column becomes nullable and is retained only for migration compatibility: simple V2 sales may store their single method, combined V2 sales store `null`, and all new reads use `income_payments`.

List payment filters use `exists` against `income_payments`. A combined sale appears in both cash and transfer filters. Cash and transfer metrics sum payment rows, so a split sale contributes only its allocated amount to each method.

### Immutable commission snapshot

Each income stores:

- `service_commission_base`
- `product_commission_base`
- `service_commission_rate`
- `product_commission_rate`
- `service_commission_amount`
- `product_commission_amount`
- `commission_total`
- `barbershop_net`
- `full_service_commission`
- `full_service_commission_authorized_by`

All monetary fields are non-negative integer pesos. `barbershop_net + commission_total = total`. The service and product bases sum to the income total. Historical sales are backfilled with their service/product bases, zero rates, zero commission and net equal to total.

Normal calculation snapshots the responsible employee's current rates. The exceptional service benefit is valid only when:

- The authenticated actor is owner or admin.
- The responsible employee differs from the actor.
- The income contains a service.

When valid, the service rate snapshot becomes `100`; the product rate remains the user's configured rate. Invalid requests fail with `INVALID_COMMISSION_OVERRIDE`. The authorizer is stored only when the exception is active.

### Atomic create and void behavior

The V2 create request is strict:

```ts
type CreateIncomeInput = {
  requestId: string;
  employeeId: string;
  customerId: string | null;
  serviceId: string | null;
  products: Array<{ productId: string; quantity: number }>;
  payments: Array<{ method: "cash" | "transfer"; amount: number }>;
  grantFullServiceCommission: boolean;
};
```

It rejects extra authority fields such as `registeredBy`, prices, totals, dates, rates, commission amounts and authorizer IDs.

The database transaction performs this sequence under the existing per-registering-user request ID idempotency key:

1. Lock or return the existing request result.
2. Validate the actor and responsible employee.
3. Validate the optional customer and active service.
4. Lock products deterministically and calculate authoritative item snapshots and total.
5. Snapshot and calculate commission components.
6. Validate the payment allocation against the authoritative total.
7. Insert the income, items and payments.
8. Deduct stock and append inventory movements.
9. Increment the customer visit counter once.

Retries and concurrent duplicate requests return the same income without duplicating payments, commission, stock changes, movements or visits. A reused `requestId` with a different semantic request fails with `INCOME_REQUEST_CONFLICT`.

Voiding retains payments and all commission snapshots, restores stock, appends reversal movements and decrements the customer visit once. Voided rows contribute zero to active gross, commission, net and payment metrics.

### Income response and role-aware list

Income detail and list items expose safe snapshots:

```ts
type IncomeCommissionSnapshot = {
  serviceBase: number;
  productBase: number;
  serviceRate: number;
  productRate: number;
  serviceAmount: number;
  productAmount: number;
  total: number;
  barbershopNet: number;
  fullServiceCommission: boolean;
  authorizedBy: Employee | null;
};
```

Each item includes `employee`, `registeredBy`, `payments` and `commission`. List metrics include `grossTotal`, `commissionTotal`, `barbershopNet`, `count`, `average`, `cashTotal` and `transferTotal`.

Employees receive only their responsible sales, cannot pass an effective `userId` filter, see their gross/commission/count/average metrics and do not see barbershop net in the UI. Managers receive global results or results filtered by responsible employee, including gross/commission/net/count metrics and existing void controls.

## Increment 2: customer visits and fixed schedules

### Customer visit history

The visit counter continues to represent active incomes associated with a customer. Attendance occurrences do not increment it.

Add an authenticated, paginated endpoint:

```text
GET /api/customers/:id/visits?page=1&pageSize=20
```

The response is intentionally operational and identical for all authenticated roles:

```ts
type CustomerVisit = {
  id: string;
  occurredAt: string;
  businessDate: string;
  items: Array<{
    type: "service" | "product";
    name: string;
    quantity: number;
  }>;
};

type PaginatedCustomerVisits = {
  items: CustomerVisit[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
```

The query reads active incomes and immutable item names, sorted newest first. It exposes no prices, totals, payment allocations, commissions, responsible employees or registering users. This preserves employee income privacy while still showing the complete purchase history requested from the customer directory. Voided incomes are excluded, so the result total matches `customers.visits`.

In `/customers`, the desktop and mobile `X visitas` label becomes a button. It opens a responsive dialog with loading, error, empty and paginated states and lists the date plus service/product quantities. Closing and reopening a customer starts at page one and does not mutate the customer catalog.

### Weekly fixed schedule

Create `customer_fixed_schedules` with one row per customer:

- `customer_id uuid primary key references customers(id)`
- `weekday smallint not null check (weekday between 1 and 7)`
- `local_time time not null`
- `is_active boolean not null default true`
- `version integer not null default 1 check (version > 0)`
- `created_by`, `updated_by` references to users
- `created_at`, `updated_at` database timestamps

A customer has zero or one active weekly schedule. `fixedSchedule: null` means no active schedule. Day uses ISO 8601 (`1` Monday through `7` Sunday), and time is a local `HH:mm` value in `America/Argentina/Buenos_Aires`.

Customer creation and update use database functions that persist the customer and schedule atomically. All currently authenticated roles may create or edit customers and their schedules; manager-only deletion remains unchanged.

The shared create/edit dialog presents the question `¿Es cliente habitual?`. Selecting yes requires one weekday and one local time and shows a readable weekly summary; selecting no sends `fixedSchedule: null`.

### Concrete occurrences and attendance

Create `fixed_customer_occurrences` with:

- Schedule customer ID and schedule version.
- Explicit customer ID for audit and efficient reads.
- Local occurrence date and scheduled time snapshots.
- Status `pending`, `attended` or `missed`.
- Status actor and timestamp.
- Unique `(schedule_customer_id, schedule_version, occurrence_date)`.

Creation, reactivation and reprogramming generate occurrences from the Buenos Aires business date through eight weeks ahead. The authorized occurrence-list function also idempotently extends the requested window, removing the need for a separate cron in this increment. `insert ... on conflict do nothing` prevents duplicates under retries and concurrency.

Reprogramming increments the schedule version, preserves past and current-day occurrences, deletes only future `pending` occurrences from the old version and generates future rows for the new version. Disabling a schedule preserves history and deletes only future pending rows. Attended and missed rows are never rewritten by schedule changes.

### Occurrence APIs and dashboard

Add:

```text
GET /api/fixed-customer-occurrences?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&status=pending
PATCH /api/fixed-customer-occurrences/:id/status
```

The status body is strict:

```ts
{ status: "attended" | "missed"; expectedStatus: "pending" }
```

The server obtains the actor from the session. Only `pending` may transition, and a concurrent second resolution returns `FIXED_OCCURRENCE_ALREADY_RESOLVED` without overwriting the first actor or timestamp.

The dashboard server page loads live occurrences for today through eight weeks ahead after session authorization. The client card persists status changes, disables both actions while saving, keeps the previous state on failure and shows a Sonner error. The demonstration fixture, badge and fallback builder are removed. `/customers/fixed` remains outside this increment; the card's `Ver todos` action links to `/customers` until that dedicated view exists.

## Public errors

The repository maps database sentinels to these public application errors:

- `EMPLOYEE_NOT_ELIGIBLE`
- `PAYMENT_ALLOCATION_MISMATCH`
- `INVALID_COMMISSION_OVERRIDE`
- `COMMISSION_RATE_OUT_OF_RANGE`
- `INCOME_REQUEST_CONFLICT`
- `FIXED_SCHEDULE_INVALID`
- `FIXED_SCHEDULE_CONFLICT`
- `FIXED_OCCURRENCE_NOT_FOUND`
- `FIXED_OCCURRENCE_ALREADY_RESOLVED`
- `CUSTOMER_NOT_FOUND`

Internal SQL, constraint and Supabase details are logged only through the existing sanitized database failure path.

## SQL installation and compatibility

Add and document exactly these forward migrations:

1. `010_income_commissions_and_split_payments.sql`
2. `011_customer_visits_and_fixed_schedules.sql`

Both scripts enable RLS on new tables, add no browser policies, revoke public/anon/authenticated access and grant only the server secret role the required table and function access. `supabase/queries/README.md` documents order, post-install verification and the fact that changing Git branches does not revert an applied migration.

Application code and SQL are committed together, but installation is a separate manual deployment action. Until `010` and `011` are installed, the corresponding V2 operations are expected to fail; the implementation must not silently fall back to fabricated commission or schedule data.

## Testing and completion

Increment 1 tests cover:

- Commission rate schema, create/update persistence and safe user responses.
- Employee self-attribution and manager assignment eligibility.
- Simple and exact split payments plus missing, excess, zero, negative and duplicate allocations.
- Service/product bases, independent rounding, zero rates, product-only sales and 100% service authorization branches.
- Immutable historical snapshots after rate changes.
- Idempotent retries and request conflicts.
- Role-scoped lists, filters, metrics, detail and voided exclusions.
- Route Handler rejection of extra authority fields.

Increment 2 tests cover:

- Paginated active visit history and sanitized responses.
- Visit dialog desktop/mobile behavior and states.
- Schedule validation, atomic customer create/update and `null` removal.
- Idempotent occurrence generation across week, month and year boundaries in Buenos Aires.
- Reprogram/disable preservation rules.
- Audited pending-to-attended/missed transitions and concurrent resolution conflicts.
- Live dashboard loading, persistent status updates, error rollback and fixture removal.

Each increment must pass focused tests followed by `npm test`, `npm run lint`, `npm run build` and `git diff --check`. Final verification uses the repository target Node 24.18.x and npm 11.16.x. After each completed increment, update `context_snapshot.md`; update `product.md` and `AGENTS.md` for the new durable product state and income ownership invariants.
