# Business Reports Design

**Date:** 2026-08-25  
**Status:** Approved design with team-performance extension  
**Scope:** Manager-only first version of `/reports`

## Objective

Give owners and administrators a simple, visual explanation of how the barbershop is performing. The report must answer how the selected month is going, how it compares with the preceding equivalent period, and which revenue and expense drivers explain the result. It must not become a table-first accounting screen.

## Product boundaries

- Only `owner` and `admin` may access report pages or data.
- The financial overview reports the whole business. The approved team-performance extension exposes responsible-professional identity and attendance-derived productivity only to managers.
- It excludes inventory valuation and customer identity.
- Caja remains the authoritative physical-cash reconciliation workspace. Reports use active income economics and accounting expenses; they do not reinterpret Caja snapshots.
- The first version supports a month selector, not arbitrary date ranges.
- Export, printing and scheduled delivery are outside this increment.
- Detail tables are secondary, collapsed behind `Ver detalle`; charts, metric cards and short explanations are the primary presentation.

## User experience

The navigation item `Reportes` links to `/reports` for managers. The page follows the existing dashboard shell and presents five sections in narrative order.

### 1. How the month is going

The hero contains:

- selected month;
- the effective cutoff, such as `Datos hasta el 25 de agosto`;
- operating result as the primary amount;
- comparison with the equivalent preceding period;
- projected month-end operating result when viewing the current month.

Projection is explicitly labeled `Estimación de cierre`; it must never look like a booked result.

### 2. Financial summary

Cards show:

- collected gross income;
- accrued commissions;
- barbershop net;
- active accounting expenses;
- operating result;
- operating margin.

Each card shows its comparable-period value and change state. A positive or negative percentage is shown only when the comparison base is nonzero. Otherwise the card says `Sin base de comparación`.

Color communicates change sparingly: green for favorable movement, red for unfavorable movement and neutral styling when unchanged or not comparable. Favorability depends on the metric: lower expenses are favorable, while higher income, net, result and margin are favorable. Commission movement is neutral because it is compensation rather than an intrinsic gain or loss.

### 3. Daily evolution

One responsive daily chart compares the selected period with its comparable period. A segmented control switches between:

- `Resultado`;
- `Ingresos`;
- `Gastos`.

The selected period is the visually dominant series and the comparable period is subdued. Pointer and keyboard interaction expose exact day and ARS amount. A textual summary beneath the graphic conveys the same main conclusion without requiring visual interpretation.

### 4. What drives the result

Three visual groups explain composition:

- income by `Servicios`, `Productos` and `Mensualidades`;
- income by historical payment-method snapshot;
- expenses by `Fijos`, `Variables` and `Insumos`.

Horizontal and stacked bars are preferred over small pie charts. Each group includes a deterministic sentence such as `Los servicios representan el 68% de los ingresos`. These sentences come from pure application rules, not generative AI.

### 5. Highlights

Compact ranked bars show:

- top five services by charged revenue;
- top five products by charged revenue;
- best and worst operating-result day.

`Ver detalle` reveals the full ranked list in-place when useful. There is no separate detail route in the first version.

## Responsive and accessible behavior

- Metric cards form a compact grid on desktop and stack on small screens.
- Ranked bars remain horizontal at all sizes.
- The daily graphic uses a horizontally scrollable plotting area on narrow screens rather than compressing labels until unreadable.
- Charts have accessible names and text summaries. Exact values available in tooltips must also be keyboard reachable.
- Currency uses integer ARS formatting consistent with the rest of the application.
- Negative operating results and projections remain visibly negative; presentation must not clamp them to zero.
- Loading skeletons retain the final geometry to minimize layout shifts.

Recharts is the preferred chart renderer for the comparative daily series because it supplies responsive scales and tooltip primitives. Simple composition bars and rankings remain semantic HTML/CSS. The implementation must confirm the currently supported Recharts API from its official documentation before adding the dependency.

## Period and comparison rules

All dates use the `America/Argentina/Buenos_Aires` business calendar.

For the current month:

- the selected period is day 1 through the current Buenos Aires day;
- the comparable period is day 1 through the same ordinal day of the immediately preceding month, capped at that month's final day;
- the selected-period projection is calculated separately for each additive monetary metric as `round(accumulated value / elapsed days * days in selected month)`;
- operating margin projection is derived from projected operating result divided by projected gross income, not by projecting the percentage directly.

For a closed month:

- the selected period is the complete selected month;
- the comparable period is the complete immediately preceding month;
- projection fields are `null` and projection UI is absent.

Future months are invalid. February, leap years and months with different lengths follow the PostgreSQL calendar. Daily comparison aligns by ordinal day, not weekday.

## Financial definitions

Only active records contribute.

- **Gross income:** sum of authoritative active `incomes.total` snapshots in the selected period, including normal sales and fixed subscriptions.
- **Commission:** sum of active `incomes.commission_total` snapshots.
- **Barbershop net:** sum of active `incomes.barbershop_net` snapshots. This stored snapshot is authoritative; the report does not reconstruct it from current commission settings.
- **Expenses:** sum of active `expenses.amount` by `accounting_date`.
- **Operating result:** barbershop net minus expenses.
- **Operating margin:** operating result divided by gross income, expressed in basis points in the server contract. It is `null` when gross income is zero.
- **Service revenue:** charged subtotals of service items from active normal sales.
- **Product revenue:** charged subtotals of product items from active normal sales.
- **Subscription revenue:** total of active `fixed_subscription` incomes.
- **Payment-method revenue:** positive active income payment amounts grouped by immutable method ID/name snapshots.
- **Expense composition:** active expense amounts grouped by fixed, variable and supplies category type snapshots/projections.
- **Rankings:** charged revenue grouped by immutable service/product item identity and name snapshots; rank by revenue descending, then name and stable ID for deterministic ties.
- **Daily result:** active daily barbershop net minus active daily expenses.

Zero-total sales count as operational records but add zero to monetary values and rankings. Voided records are excluded immediately. Price overrides are represented through charged snapshots, never current catalog prices. Historical renames do not rewrite payment or item names already snapshotted on transactions.

## Data contract and architecture

PostgreSQL owns one manager-authorized RPC:

```sql
public.get_business_report(
  actor_user_id uuid,
  target_month text
) returns jsonb
```

The RPC takes the manager advisory/authorization path already used by Expenses, validates canonical `YYYY-MM`, rejects future months and returns one internally consistent JSON snapshot. It uses aggregate SQL over active income, item, payment and expense rows; no browser request may submit actor identity.

The strict response contains:

```ts
type BusinessReport = {
  month: string;
  generatedAt: string;
  period: {
    from: string;
    to: string;
    elapsedDays: number;
    daysInMonth: number;
    isCurrentMonth: boolean;
  };
  comparison: {
    month: string;
    from: string;
    to: string;
  };
  summary: ReportMetrics;
  previousSummary: ReportMetrics;
  projection: ReportMetrics | null;
  daily: Array<{
    day: number;
    selected: DailyReportMetrics;
    previous: DailyReportMetrics | null;
  }>;
  incomeComposition: Array<ReportBreakdown>;
  paymentComposition: Array<ReportNamedBreakdown>;
  expenseComposition: Array<ReportBreakdown>;
  serviceRanking: Array<ReportRankedItem>;
  productRanking: Array<ReportRankedItem>;
  highlights: {
    bestDay: ReportDayHighlight | null;
    worstDay: ReportDayHighlight | null;
  };
};

type ReportMetrics = {
  grossIncome: number;
  commission: number;
  barbershopNet: number;
  expenses: number;
  operatingResult: number;
  operatingMarginBps: number | null;
};

type DailyReportMetrics = {
  grossIncome: number;
  expenses: number;
  operatingResult: number;
};

type ReportBreakdown = {
  key: "services" | "products" | "subscriptions" | "fixed" | "variable" | "supplies";
  amount: number;
};

type ReportNamedBreakdown = {
  id: string;
  name: string;
  amount: number;
};

type ReportRankedItem = ReportNamedBreakdown & { quantity: number };
type ReportDayHighlight = { date: string; amount: number };
```

All monetary values are safe integers in ARS. Objects are strict and arrays use deterministic ordering. A named breakdown/ranking `id` is a stable row key derived from the immutable catalog UUID plus its historical name snapshot; this keeps separately snapshotted names distinct after a catalog rename. Daily rows cover every ordinal day in the selected period, including zero-activity days, so the browser does not synthesize dates.

The server application adds a focused `src/lib/reports` domain with schemas, contracts, repository, service and date/presentation helpers. The repository is server-only and parses the complete RPC response with Zod before returning it.

`/reports` is a protected Server Component and loads the initial current-month snapshot directly through the service. `GET /api/reports/business?month=YYYY-MM` reauthorizes the session, validates the query and returns uncached JSON for interactive month changes. This follows Next.js 16's current uncached Route Handler behavior and keeps Supabase access out of browser code.

## Component boundaries

## Approved extension: team performance

The monthly report adds a manager-only `Rendimiento del equipo` section after the financial composition and before catalog rankings. It uses the same selected and comparable periods as the rest of the report and requires no extra filter or request.

Every responsible professional with an active income in either period appears. Every employee with a work session in either period also appears even when they recorded no income. Owner/admin rows may appear when responsible for income, but attendance metrics are `null` because those roles do not clock work sessions.

For each professional PostgreSQL returns current and comparable values for sale count, gross income, commission, barbershop net, average ticket, worked minutes, gross per worked hour, net per worked hour and outside-session sale count. Only active incomes contribute. Hours are the overlap of each employee session with the selected Buenos Aires date window; an open session is capped at report generation time. Productivity-per-hour is `null` when worked minutes are zero or attendance does not apply. Average ticket is `null` when sale count is zero.

`outsideSessionSaleCount` counts active employee-responsible incomes whose immutable `outside_work_session` flag is true. Owner/admin rows always return zero for this field. Ordering is deterministic: current gross descending, then display name and user ID. Historical/deleted professionals remain identifiable through the retained `users` audit row and are labeled with their current retained name; no customer, payment or session timestamps are exposed.

The UI uses a compact desktop comparison grid and stacked mobile cards. The first five rows are shown initially, with an in-place detail expansion for larger teams. It highlights current gross, net, commission and ticket, then shows worked time/productivity when applicable and a warning only when outside-session sales are nonzero. Percentage comparison follows the existing no-base rule. Employees and anonymous callers remain blocked at page, API and PostgreSQL boundaries.

- `ReportsWorkspace`: owns selected month, latest successful report, loading/error state and request sequencing.
- `ReportHero`: displays result, cutoff, comparison and optional projection.
- `ReportMetricGrid`: renders the six financial indicators with metric-aware change semantics.
- `ReportTrendChart`: contains only chart selection and chart rendering.
- `ReportComposition`: renders the three composition groups and their rule-based insights.
- `ReportRankings`: renders top-five bars and local expanded detail.
- `report-insights.ts`: pure functions for variation labels, favorability and deterministic narrative copy.
- `report-client.ts`: no-store browser fetch plus strict success parsing.

Month requests use a monotonically increasing sequence, matching the established Expenses workspace pattern, so a slower stale response cannot overwrite a newer selection. On failure, the last successful report stays visible, the selector returns to the successfully loaded month, and an actionable retry alert appears.

## Empty and exceptional states

- No income and no expense activity: show a purpose-built empty state with manager links to `Ingresos` and `Gastos`; omit empty charts.
- Activity only in one side: show valid zero values for the absent side and retain the report.
- No preceding-period activity: show current values with `Sin base de comparación`.
- No ranked items or payment rows: show a local empty explanation rather than an empty axis.
- Invalid/future month: HTTP 400 with stable application copy.
- Employee access: page redirect/forbidden behavior consistent with manager pages, and API HTTP 403.
- Missing/outdated RPC: sanitized HTTP 503 instructing that the Reportes database migration is pending.
- Unexpected database or response-contract failure: log only operation and error code; return generic report failure copy.

## Database migration and security

The next ordered SQL file is `039_business_reports.sql`. It installs the canonical RPC without browser grants. Existing RLS invariants remain unchanged: public tables stay RLS-enabled and `PUBLIC`, `anon` and `authenticated` receive no table or routine privileges. Only the server secret role may execute the report RPC.

The migration includes rollback-wrapped acceptance covering manager authorization, employee rejection, period boundaries, active/voided rows, subscriptions, price overrides, commission snapshots, expenses, payment snapshots, rankings, zero months, negative results and deterministic output ordering. The system database audit fingerprints the new RPC signature and grants.

## Testing and verification

Implementation follows TDD and adds:

- schema tests for strict parsing, safe integers, nullable margins/projections and deterministic arrays;
- service tests for manager authorization and repository delegation;
- repository tests for exact RPC arguments, response parsing and sanitized database failures;
- Route Handler tests for anonymous, employee, manager, invalid month and success paths;
- SQL structural tests for formulas, filters, timezone, grants and canonical signature;
- pure insight tests for favorable/unfavorable direction, zero comparison bases, rounding and negative results;
- component tests for hero, metric cards, chart mode, composition, rankings, empty state, loading, retry and stale-response protection;
- page and sidebar tests for manager-only navigation and initial loading;
- responsive authenticated browser validation at desktop and 390×844;
- PostgreSQL acceptance plus `audit:db`, focused Vitest, full Vitest, TypeScript, ESLint, `git diff --check` and Next.js production build.

## Documentation impact

After verified implementation:

- add Reportes to the delivered architecture in `AGENTS.md`;
- update `product.md` from `Planned` to the actual installed/verified state;
- update `context_snapshot.md` with branch, migration `039`, verification evidence, remaining deployment action and the single recommended next task;
- extend `supabase/queries/README.md` with installation and acceptance instructions for `039`.

## Explicitly deferred

- employee performance and attendance correlations;
- customer cohorts or retention;
- inventory cost and gross-margin accounting;
- arbitrary date ranges;
- CSV/PDF export and printing;
- saved report configurations;
- emailed or scheduled reports;
- forecasting more sophisticated than the labeled linear current-month estimate.
