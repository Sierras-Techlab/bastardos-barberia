# Business Reports View Plan

## Goal

Add a manager-only `/reports` workspace with general statistics and metrics for the whole barbershop. Reports must derive from authoritative transactional snapshots and keep commercial performance, physical Caja reconciliation and operating expenses semantically separate.

## Product Shape

- Manager-only navigation under Administration > Reports.
- One shared Buenos Aires business-date range with presets for current month, previous month and last 30 days.
- Optional previous-period comparison normalized to an explicit equal-length range.
- Secondary filters for responsible employee, income source and payment method where those dimensions apply.
- Explicit Apply and Clear actions to avoid expensive aggregate requests on each keystroke.
- Responsive desktop tables and mobile cards, preserving exact integer ARS amounts.

## Overview Metrics

- Gross income.
- Commission.
- Barbershop net.
- Active operating expenses.
- Operating result: barbershop net minus expenses.
- Active income count and average ticket.
- Normal-sale, subscription, service-line and product-line breakdowns.
- Expense breakdown by fixed, variable and supplies.
- Dynamic payment-method allocation totals.

## Visual Sections

1. Headline KPI cards, with operating result as the dark emphasis card.
2. Financial evolution series with gross, net, expenses and operating result.
3. Horizontal breakdown bars for income type and payment methods.
4. Team performance table with responsible employee, sales, gross, commission, net and average ticket.
5. Daily summary table with date, gross, commission, net, expenses, result and income count.
6. Drill-through links to existing Incomes, Expenses, Caja and Presentismo workspaces.

## Semantics And Invariants

- Use active `incomes` and immutable charged-price snapshots for commercial performance.
- Use `income_items.charged_subtotal`, never current catalog prices or historical commission bases.
- Keep fixed subscriptions explicit. They contribute to income and operating result but never visits or performed-service counts.
- Use active authoritative expense records and category snapshots.
- Keep Caja separate: Caja reports closure and physical reconciliation chronology, including post-close adjustments. It is not the general revenue source.
- Expense payment methods remain administrative and do not alter Caja.
- Use exact `work_session_id` for session productivity; outside-session incomes remain an explicit bucket.
- Group historical items by stable catalog ID and display a deterministic recent snapshot label.
- Every ARS value and percentage remains an integer; comparison percentages use basis points and return null when the denominator is zero.

## Backend Architecture

Use a hybrid model:

- One canonical manager-only `get_business_report` RPC for overview totals, breakdowns, bounded series and optional comparison.
- One strict `GET /api/reports/business` Route Handler, service, repository and no-store client.
- Existing paginated domain endpoints remain the source for drill-down.
- Add dedicated ranking/export RPCs only when full ranked views or exports are required.

Suggested RPC inputs:

- `actor_user_id uuid`
- `date_from date`
- `date_to date`
- optional comparison dates
- optional responsible employee UUID
- `bucket day | week | month`
- bounded `top_limit`

The RPC must be `SECURITY DEFINER`, use an empty search path, authorize an active owner/admin from the database and be executable only by `service_role`.

## Strict Contract

The Zod response must verify:

- commission plus barbershop net equals gross.
- normal sales plus subscriptions equals gross income.
- fixed plus variable plus supplies equals expenses.
- barbershop net minus expenses equals operating result.
- payment totals reconcile with qualifying gross.
- generated series reconciles with headline totals.
- comparison absolute deltas match current minus comparison.
- percentage deltas are null exactly when the comparison denominator is zero.

## Date Rules

- Fixed timezone: `America/Argentina/Buenos_Aires`.
- Inclusive ISO business/accounting dates.
- Maximum interactive range: 366 days.
- No future range in the first version.
- Missing periods are returned as explicit zero buckets.
- Week buckets start Monday; month buckets use the first day.

## Planned Files

- `supabase/queries/039_business_reports.sql`.
- `src/types/report.ts`.
- `src/lib/reports/{schemas,repository,service,client,date-range}.ts`.
- `src/app/api/reports/business/route.ts`.
- `src/app/(dashboard)/reports/{page,loading,error}.tsx`.
- `src/components/reports/reports-workspace.tsx` and focused chart/table/filter components.
- Sidebar, product, context and architecture documentation updates.

## Delivery Stages

1. Financial overview, breakdowns, daily/monthly series and comparison.
2. Top services, products, employees and customers with deterministic rankings.
3. Separate Caja reconciliation reporting.
4. Performance tuning, measured indexes and bounded CSV export.

## Acceptance Priorities

- Owner/admin allowed; employee and anonymous requests rejected at HTTP and SQL boundaries.
- Charged overrides, zero sales, owner commissions, full commissions and subscriptions reconcile.
- Voided incomes and expenses are excluded from operating metrics.
- Historical payment and category labels remain stable after catalog changes.
- Comparisons handle zero denominators and leap/calendar boundaries deterministically.
- 31-day and 366-day query plans are measured with realistic cardinalities.
- Strict response parsing rejects unknown keys and unreconciled totals.
