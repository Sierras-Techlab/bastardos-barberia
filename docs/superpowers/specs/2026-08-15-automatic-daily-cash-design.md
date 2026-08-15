# Automatic Daily Cash Design

**Date:** 2026-08-15  
**Status:** Approved

## Goal

Add a manager-only cash module that derives the current day from sales in real time and persists immutable, auditable daily closures automatically at local midnight. There is no manual opening, closing or cash CRUD.

## Approved product behavior

- Only `owner` and `admin` can access `/cash` or its API.
- The business timezone is `America/Argentina/Buenos_Aires`, matching income `business_date`.
- Today's cash is live from local `00:00` through `23:59:59.999...` and is never persisted as closed early.
- Supabase Cron invokes an idempotent recovery function hourly. At `00:00` local it closes the prior day; later executions recover any missed closure.
- Days without a sale or an audited adjustment do not create a closure row.
- Closed days are immutable snapshots. They are never silently recomputed.
- A sale voided before its day closes remains visible in that day's audit but contributes zero to totals.
- A sale voided after its original day closes does not mutate that closure. It creates an atomic negative adjustment dated on the void's local business date and linked to the original closure and income.
- Every day exposes gross sales, commissions, barbershop net, service and product totals, sale counts, adjustments and dynamic payment-method totals.
- The cash detail lists every included sale. Selecting one reuses the existing read-only income detail. Voiding remains in Incomes.
- A prominent `Cargar ingreso` action links to `/incomes/new`.

## Persistence model

### `daily_cash_registers`

One immutable row per closed active business date:

- `id uuid primary key`
- `business_date date unique not null`
- sales snapshots: `sales_gross_total`, `sales_commission_total`, `sales_barbershop_net`, `service_sales_total`, `product_sales_total`
- adjustment snapshots: `adjustment_gross_total`, `adjustment_commission_total`, `adjustment_barbershop_net`, `service_adjustment_total`, `product_adjustment_total`
- counts: `sale_count`, `active_sale_count`, `voided_sale_count`, `adjustment_count`
- `closed_at timestamptz not null`

Final displayed totals equal their sales and adjustment components. Amounts use `bigint`; adjustment amounts are zero or negative.

### `daily_cash_sales`

Immutable membership and close-time economics for every income created on the closed date:

- `daily_cash_id`, `income_id` with unique income membership
- `status_at_close`
- `gross_total`, `commission_total`, `barbershop_net`
- `service_total`, `product_total`
- `created_at_snapshot`

Voided-at-close rows retain their audit amounts but do not contribute to register totals.

### `daily_cash_payment_totals`

One row per closure and payment method used by sales or adjustments:

- stable `payment_method_id` plus immutable `method_name_snapshot`
- `sales_amount`, `adjustment_amount`, `net_amount`

This remains dynamic when managers add future payment methods.

### `daily_cash_adjustments` and `daily_cash_adjustment_payments`

An insert-only post-close void event:

- unique `source_income_id`
- `original_daily_cash_id`
- local `business_date` of the void
- `created_by` and `created_at`
- negative gross, commission, net, service and product deltas
- normalized negative payment allocations with name snapshots

A database trigger on `incomes` records the event only on `active -> voided` when an original closure exists. It runs in the same transaction as `void_income`.

All new tables enable RLS with no browser policies. Only `service_role` can execute the security-definer RPCs.

## Database operations

Migration `018_automatic_daily_cash.sql` will:

1. Create the snapshot and adjustment tables, checks, indexes and RLS.
2. Install the post-close void trigger.
3. Install `close_pending_daily_cash()` with a transaction advisory lock and conflict-safe inserts.
4. Install manager-authorized `get_daily_cash(uuid,date)` and `list_daily_cash(uuid,date,date,integer,integer)` RPCs.
5. Enable `pg_cron` and schedule the idempotent closer hourly.
6. Revoke execution from browser roles and grant only `service_role`.

The closer uses the database clock and local timezone. It closes every missing active date strictly before today, so retries and deployments after downtime are safe.

## API and application boundaries

- `GET /api/cash?date=YYYY-MM-DD` returns one live or closed day.
- `GET /api/cash/history?page=&pageSize=&dateFrom=&dateTo=` returns closed-day summaries.
- Route Handlers call `requireManager()` before parsing query input.
- Zod validates every database JSON response; repositories translate rows but never calculate authoritative money.
- Browser clients use `cache: "no-store"`.
- Employees receive `403` and the dashboard navigation keeps Caja manager-only.

## UI

`/cash` follows the existing rounded Bastardos dashboard language without copying Incomes exactly:

- compact heading, local date and live/closed state badge;
- primary `Cargar ingreso` action;
- gross, commission and barbershop-net summary cards;
- service/product split and dynamic payment-method cards;
- explicit adjustment summary when nonzero;
- responsive sale audit table/list with status and employee;
- historical closure table with date filters and pagination;
- selecting a sale opens the existing income detail sheet in read-only cash context.

The page uses server loading/error boundaries and remains usable at 390px width.

## Error and concurrency rules

- Closing the same date repeatedly returns the existing snapshot.
- Concurrent cron attempts serialize through one advisory lock.
- A void and closure serialize on the income row. The winning state determines whether the void is captured at close or as a later adjustment; it cannot disappear or count twice.
- Invalid dates, unauthorized actors and missing closures return stable application errors.
- A closed snapshot cannot be updated or deleted through any public function.

## Testing and deployment

- Structural migration tests cover tables, RLS, trigger, cron, grants, authorization and idempotency markers.
- Repository/service/route/client tests cover manager authorization, live versus closed responses, history and errors.
- UI tests cover totals, dynamic payments, adjustments, audit selection, navigation and responsive semantics.
- SQL acceptance checks run inside a rollback and cover active sales, same-day voids, post-close void adjustments, split payments, empty-day omission and repeat closure.
- Apply migrations through `018` in order using the Supabase SQL Editor. Cron creation is part of `018`.

## Out of scope

- Manual opening or closing.
- Cash counting or expected-versus-counted differences.
- Expense CRUD.
- Editing or voiding directly from Caja.
- Export, PDF and final profitability reports.
