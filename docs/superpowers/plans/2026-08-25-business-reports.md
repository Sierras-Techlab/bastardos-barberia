# Business Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a manager-only `/reports` workspace that explains monthly business performance through comparable financial metrics, a daily trend, visual composition and concise rankings.

**Architecture:** PostgreSQL migration `039` exposes one manager-authorized JSON snapshot built from immutable active income, payment, item and expense data. A strict server-only reports domain validates that snapshot, a protected Server Component loads the initial month, and an uncached Route Handler supports client-side month changes. Focused React components render the narrative report; Recharts renders only the accessible daily comparison while semantic HTML/CSS renders all simpler bars.

**Tech Stack:** Next.js 16.3 App Router and Route Handlers, React 19, TypeScript strict mode, Supabase PostgreSQL RPCs, Zod, Recharts 3, Tailwind CSS, existing shadcn/base-ui components, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-25-business-reports-design.md`

## Global Constraints

- Execute from an up-to-date `dev` base in an isolated `codex/business-reports` worktree; the planning checkout is still on `feat/expenses` even though the user reports that branch was merged into `dev`.
- Read `AGENTS.md`, `context_snapshot.md`, `product.md`, this plan and the linked spec completely before implementation.
- Re-read the local Next.js 16 guides for pages, fetching and Route Handlers before touching framework files.
- Only `owner` and `admin` may access `/reports` or its API/RPC; employees receive no report projection.
- PostgreSQL is authoritative for all financial values, comparison windows, projection inputs, rankings and date rows.
- All calendar behavior uses `America/Argentina/Buenos_Aires`; future months are rejected.
- Monetary values remain integer ARS; margins use integer basis points or `null` when gross income is zero.
- Only active incomes and active expenses contribute. Caja snapshots, current catalog prices and current commission rates are never used to reconstruct historical economics.
- Browser code never imports the Supabase client and never supplies `actor_user_id`.
- Add no table or routine grants for `PUBLIC`, `anon` or `authenticated`; only the server secret role executes `get_business_report`.
- Use Recharts' current `responsive` and default accessibility-layer behavior documented by the official Recharts 3 API; do not introduce a second chart library.
- Implement through RED-GREEN TDD, run focused tests after each task, and commit each independently reviewable task.
- Do not apply migration `039` to production. Test-database installation and PostgreSQL acceptance require explicit in-scope authorization at execution time.

---

## File Map

**Create**

- `src/types/report.ts` — public TypeScript report contract.
- `src/lib/reports/schemas.ts` and `schemas.test.ts` — strict boundary schemas and fixtures.
- `src/lib/reports/date.ts` and `date.test.ts` — Buenos Aires month helpers used outside SQL.
- `src/lib/reports/insights.ts` and `insights.test.ts` — pure comparison, favorability and narrative rules.
- `src/lib/reports/contracts.ts` — repository dependency boundary.
- `src/lib/reports/repository.ts` and `repository.test.ts` — server-only RPC adapter.
- `src/lib/reports/service.ts` and `service.test.ts` — manager authorization and use case.
- `src/lib/reports/client.ts` and `client.test.ts` — browser API adapter.
- `src/app/api/reports/business/route.ts` and `route.test.ts` — authenticated uncached month endpoint.
- `src/app/(dashboard)/reports/page.tsx`, `page.test.tsx`, `loading.tsx` and `error.tsx` — protected route shell.
- `src/components/reports/report-hero.tsx` and `.test.tsx` — narrative result header.
- `src/components/reports/report-metric-grid.tsx` and `.test.tsx` — six comparable KPIs.
- `src/components/reports/report-trend-chart.tsx` and `.test.tsx` — accessible Recharts comparison.
- `src/components/reports/report-composition.tsx` and `.test.tsx` — semantic composition bars.
- `src/components/reports/report-rankings.tsx` and `.test.tsx` — ranked highlights and expansion.
- `src/components/reports/reports-workspace.tsx` and `.test.tsx` — month selection and request sequencing.
- `supabase/queries/039_business_reports.sql` — canonical report RPC and grants.
- `src/lib/reports/migration-039.test.ts` — structural SQL regression coverage.

**Modify**

- `package.json` and `package-lock.json` — add the current Recharts 3 dependency.
- `src/components/app-sidebar.tsx` and `.test.tsx` — activate manager-only `Reportes` navigation.
- `scripts/system-db-audit.ts` — fingerprint `get_business_report`.
- `scripts/system-db-acceptance.ts` — rollback-only report scenarios.
- `supabase/queries/README.md` — ordered `039` installation and validation.
- `AGENTS.md`, `product.md`, `context_snapshot.md` — durable architecture, delivered state and handoff.

---

### Task 1: Lock the report types, strict schemas and pure presentation rules

**Files:**
- Create: `src/types/report.ts`
- Create: `src/lib/reports/schemas.ts`
- Create: `src/lib/reports/schemas.test.ts`
- Create: `src/lib/reports/date.ts`
- Create: `src/lib/reports/date.test.ts`
- Create: `src/lib/reports/insights.ts`
- Create: `src/lib/reports/insights.test.ts`

**Interfaces:**
- Produces: `BusinessReport`, `ReportMetrics`, `DailyReportMetrics`, `ReportBreakdown`, `ReportNamedBreakdown`, `ReportRankedItem`, `ReportDayHighlight`.
- Produces: `reportMonthQuerySchema`, `businessReportSchema`.
- Produces: `getBuenosAiresReportMonth(now?: Date): string`.
- Produces: `compareMetric(current, previous, direction): MetricComparison` and deterministic insight helpers.

- [ ] **Step 1: Write strict schema tests with one canonical fixture**

Create a fixture containing a current August report with positive and negative monetary fields, nullable previous daily points, all six breakdown keys and stable UUIDs. Assert successful parsing, then assert failures for an extra top-level key, decimal ARS, unsafe integers, malformed month/date, future-shaped invalid enum keys and a non-null projection for a malformed value.

```ts
expect(businessReportSchema.parse(reportFixture)).toEqual(reportFixture);
expect(() => businessReportSchema.parse({ ...reportFixture, leakedEmployee: {} })).toThrow();
expect(() => businessReportSchema.parse({
  ...reportFixture,
  summary: { ...reportFixture.summary, operatingResult: 10.5 },
})).toThrow();
expect(reportMonthQuerySchema.parse({ month: "2026-08" })).toEqual({ month: "2026-08" });
```

- [ ] **Step 2: Run the schema tests and confirm RED**

Run: `npx vitest run src/lib/reports/schemas.test.ts --reporter=dot`  
Expected: FAIL because `schemas.ts` and report types do not exist.

- [ ] **Step 3: Implement exact types and strict Zod schemas**

Use `z.number().int().safe()` for signed money, `.nonnegative()` only for gross income, commission, expenses, quantities and breakdown amounts, and `z.number().int().safe().nullable()` for margin basis points. Large expenses can legitimately make operating margin lower than -100%, so do not impose an artificial percentage range. Keep every object `.strict()`.

```ts
export const reportMetricsSchema = z.object({
  grossIncome: money.nonnegative(),
  commission: money.nonnegative(),
  barbershopNet: money,
  expenses: money.nonnegative(),
  operatingResult: money,
  operatingMarginBps: z.number().int().safe().nullable(),
}).strict();

export const reportMonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
}).strict();
```

Infer the exported TypeScript types from schemas or assert bidirectional type equality so the runtime and compile-time contracts cannot drift.

- [ ] **Step 4: Write date and insight tests**

Cover a UTC timestamp that is still the prior day/month in Buenos Aires, positive/negative/no-base comparisons, expenses' inverted favorability, commission neutrality, zero denominator, negative result, percentage rounding and the three deterministic composition sentences.

```ts
expect(getBuenosAiresReportMonth(new Date("2026-09-01T01:00:00Z"))).toBe("2026-08");
expect(compareMetric(120, 100, "higher-is-better")).toMatchObject({ percent: 20, tone: "favorable" });
expect(compareMetric(80, 100, "lower-is-better")).toMatchObject({ percent: -20, tone: "favorable" });
expect(compareMetric(10, 0, "neutral")).toMatchObject({ percent: null, tone: "neutral" });
```

- [ ] **Step 5: Implement the pure helpers**

Return semantic data rather than JSX. `comparison.percent` is `round((current - previous) / abs(previous) * 100)` when previous is nonzero. Insight functions select the largest stable-key entry, calculate its share against the supplied total, and return Spanish copy; an empty or zero total returns the defined no-activity copy.

- [ ] **Step 6: Run focused tests and type-check**

Run: `npx vitest run src/lib/reports/schemas.test.ts src/lib/reports/date.test.ts src/lib/reports/insights.test.ts --reporter=dot`  
Run: `npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 7: Commit the domain contract**

```bash
git add src/types/report.ts src/lib/reports
git commit -m "feat(reports): define business report contracts"
```

---

### Task 2: Build the authoritative PostgreSQL report RPC

**Files:**
- Create: `supabase/queries/039_business_reports.sql`
- Create: `src/lib/reports/migration-039.test.ts`

**Interfaces:**
- Consumes: the canonical inline manager guard from migration `026`: one active, non-deleted `public.users` row with `role_id in (1, 2)` or `MANAGER_REQUIRED` (`42501`).
- Produces: `public.get_business_report(actor_user_id uuid, target_month text) returns jsonb`.
- Produces JSON matching `businessReportSchema` byte-for-byte in key casing and nullable behavior.

- [ ] **Step 1: Write structural migration tests**

Load the SQL file as text and assert one canonical signature, security invoker semantics consistent with existing RPCs, manager authorization, Buenos Aires current date, active-status filters, source-type handling, charged subtotals, immutable commission/net columns, expense accounting dates, payment snapshots, complete day generation, projection formula, deterministic ranking order, revocation and service-role grant.

```ts
expect(sql).toMatch(/create or replace function public\.get_business_report\(\s*actor_user_id uuid,\s*target_month text/si);
expect(sql).toMatch(/America\/Argentina\/Buenos_Aires/);
expect(sql).toMatch(/i\.status = 'active'/);
expect(sql).toMatch(/e\.status = 'active'/);
expect(sql).toMatch(/ii\.charged_subtotal/);
expect(sql).toMatch(/revoke all on function public\.get_business_report\(uuid, text\) from public, anon, authenticated/si);
```

- [ ] **Step 2: Run the structural test and confirm RED**

Run: `npx vitest run src/lib/reports/migration-039.test.ts --reporter=dot`  
Expected: FAIL because migration `039` does not exist.

- [ ] **Step 3: Implement the transaction and function boundary**

Begin the migration transaction, drop only conflicting report overloads, validate `target_month` by round-tripping `to_char(to_date(target_month || '-01', 'YYYY-MM-DD'), 'YYYY-MM')`, calculate `today_ba`, reject a future month with `REPORT_MONTH_FUTURE`, and derive these dates:

```sql
selected_start := to_date(target_month || '-01', 'YYYY-MM-DD');
selected_month_end := (selected_start + interval '1 month - 1 day')::date;
selected_end := least(selected_month_end, today_ba);
comparison_start := (selected_start - interval '1 month')::date;
comparison_month_end := (selected_start - interval '1 day')::date;
comparison_end := least(
  comparison_month_end,
  comparison_start + ((selected_end - selected_start) * interval '1 day')
)::date;
```

Before reading financial tables, assert that `public.users` contains `actor_user_id` with `role_id in (1, 2)`, `is_active` and `deleted_at is null`; otherwise raise SQLSTATE `42501` with `MANAGER_REQUIRED`.

- [ ] **Step 4: Implement one aggregate CTE pipeline**

Use CTEs for `bounds`, `income_base`, `expense_base`, `item_base`, `payment_base`, `calendar_days`, selected/previous summaries, daily selected/previous values, compositions and rankings. Never join income items and payments into the same pre-aggregate relation because that multiplies amounts.

Core identities must be selected directly from stored snapshots:

```sql
sum(i.total),
sum(i.commission_total),
sum(i.barbershop_net),
sum(e.amount),
sum(i.barbershop_net) - sum(e.amount)
```

For income composition, normal-sale service/product values come from `income_items.charged_subtotal`, discriminated by the canonical `income_items.item_type in ('service', 'product')`; subscriptions come from `incomes.total`. Group payments by immutable `payment_method_id` and `method_name_snapshot`. Generate every selected ordinal day with `generate_series` and left join zero-valued aggregates.

For payment and item rankings, group by catalog UUID plus historical name snapshot. Return the display `name` unchanged and form the row `id` as `catalog_uuid::text || ':' || encode(extensions.digest(name_snapshot, 'sha256'), 'hex')`; this prevents duplicate React keys when one catalog record has multiple historical names.

- [ ] **Step 5: Construct strict camelCase JSON and grants**

Build the final object with `jsonb_build_object`, `coalesce(jsonb_agg(... order by ...), '[]'::jsonb)`, integer casts and explicit `null` projection for closed months. Rank complete lists by `amount desc, name asc, id asc`; the UI decides whether to show five or expand.

```sql
revoke all on function public.get_business_report(uuid, text) from public, anon, authenticated;
grant execute on function public.get_business_report(uuid, text) to service_role;
select pg_catalog.pg_notify('pgrst', 'reload schema');
commit;
```

- [ ] **Step 6: Run structural tests and repository-wide migration tests**

Run: `npx vitest run src/lib/reports/migration-039.test.ts src/lib/expenses/migration-026.test.ts src/lib/cash/migration-022.test.ts --reporter=dot`  
Expected: PASS with no regression in existing financial migrations.

- [ ] **Step 7: Commit the migration**

```bash
git add supabase/queries/039_business_reports.sql src/lib/reports/migration-039.test.ts
git commit -m "feat(reports): add authoritative business report rpc"
```

---

### Task 3: Add the server repository and manager-only service

**Files:**
- Create: `src/lib/reports/contracts.ts`
- Create: `src/lib/reports/repository.ts`
- Create: `src/lib/reports/repository.test.ts`
- Create: `src/lib/reports/service.ts`
- Create: `src/lib/reports/service.test.ts`

**Interfaces:**
- Produces: `ReportRepository.get(actorId: string, month: string): Promise<BusinessReport>`.
- Produces: `getBusinessReport(actor: SafeUser, month: string, dependencies?): Promise<BusinessReport>`.

- [ ] **Step 1: Write repository RED tests**

Mock `getSupabaseAdmin().rpc`. Assert the exact call below, strict parsing of success, `REPORT_MONTH_FUTURE` mapping to a 400 `AppError`, `PGRST202` mapping to a sanitized 503 migration message, manager sentinel mapping to 403, and generic failures logging operation plus code without database text.

```ts
expect(rpc).toHaveBeenCalledWith("get_business_report", {
  actor_user_id: manager.id,
  target_month: "2026-08",
});
```

- [ ] **Step 2: Run repository tests and confirm RED**

Run: `npx vitest run src/lib/reports/repository.test.ts --reporter=dot`  
Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement the server-only adapter**

Follow the Expenses repository's `map`, `fail`, `parse` and RPC style. Import `server-only`, accept only actor ID and month, and parse the entire result with `businessReportSchema`.

- [ ] **Step 4: Write service authorization tests**

Assert owner/admin delegation and employee rejection before repository invocation.

```ts
await expect(getBusinessReport(employee, "2026-08", deps)).rejects.toMatchObject({ status: 403 });
expect(deps.reports.get).not.toHaveBeenCalled();
```

- [ ] **Step 5: Implement the service boundary**

Call `assertManager(actor)` synchronously, then delegate `actor.id` and the validated month to the repository. Do not calculate dates or report values here.

- [ ] **Step 6: Run focused tests and type-check**

Run: `npx vitest run src/lib/reports/repository.test.ts src/lib/reports/service.test.ts --reporter=dot`  
Run: `npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 7: Commit the server domain**

```bash
git add src/lib/reports
git commit -m "feat(reports): expose manager report service"
```

---

### Task 4: Expose the uncached API and strict browser client

**Files:**
- Create: `src/app/api/reports/business/route.ts`
- Create: `src/app/api/reports/business/route.test.ts`
- Create: `src/lib/reports/client.ts`
- Create: `src/lib/reports/client.test.ts`

**Interfaces:**
- Produces: `GET /api/reports/business?month=YYYY-MM`.
- Produces: `reportClient.get(month: string): Promise<BusinessReport>`.

- [ ] **Step 1: Write Route Handler tests**

Mock `requireManager` and `getBusinessReport`. Cover 401 anonymous, 403 employee/manager guard failure, 400 malformed month, 400 future month from service, and 200 manager success. Assert the browser query never controls actor identity.

- [ ] **Step 2: Run route tests and confirm RED**

Run: `npx vitest run src/app/api/reports/business/route.test.ts --reporter=dot`  
Expected: FAIL because the handler does not exist.

- [ ] **Step 3: Implement the Route Handler**

Use the established response helpers and the current Next.js 16 uncached GET behavior:

```ts
export async function GET(request: Request) {
  try {
    const { user } = await requireManager();
    const { month } = reportMonthQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return successResponse(await getBusinessReport(user, month));
  } catch (error) {
    return errorResponse(error);
  }
}
```

Do not add `force-static`, `use cache` or actor query parameters.

- [ ] **Step 4: Write client RED tests**

Assert encoded month URL, `{ cache: "no-store" }`, strict parsing, stable API error extraction and rejection of a successful response with extra keys.

- [ ] **Step 5: Implement `reportClient.get`**

Follow the Expenses client error envelope. Parse only successful payload data with `businessReportSchema` before returning it.

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run src/app/api/reports/business/route.test.ts src/lib/reports/client.test.ts --reporter=dot`  
Expected: PASS.

- [ ] **Step 7: Commit the HTTP boundary**

```bash
git add src/app/api/reports src/lib/reports/client.ts src/lib/reports/client.test.ts
git commit -m "feat(reports): add report api and browser client"
```

---

### Task 5: Build the narrative report components

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/reports/report-hero.tsx`
- Create: `src/components/reports/report-hero.test.tsx`
- Create: `src/components/reports/report-metric-grid.tsx`
- Create: `src/components/reports/report-metric-grid.test.tsx`
- Create: `src/components/reports/report-trend-chart.tsx`
- Create: `src/components/reports/report-trend-chart.test.tsx`
- Create: `src/components/reports/report-composition.tsx`
- Create: `src/components/reports/report-composition.test.tsx`
- Create: `src/components/reports/report-rankings.tsx`
- Create: `src/components/reports/report-rankings.test.tsx`

**Interfaces:**
- Consumes: `BusinessReport` and pure helpers from Task 1.
- Produces presentational components with no fetching or database knowledge.

- [ ] **Step 1: Install Recharts 3 and record the exact lockfile version**

Run: `npm install recharts@^3`  
Expected: `package.json` and `package-lock.json` contain one Recharts 3 dependency. Review npm audit output but do not perform unrelated automatic upgrades.

- [ ] **Step 2: Write hero and metric-grid RED tests**

Assert the cutoff, negative result, optional projection label, absence of projection for closed months, all six cards, metric-specific favorable directions, commission neutrality and `Sin base de comparación`.

- [ ] **Step 3: Implement hero and metric grid**

Use the existing `Card` primitives and ARS formatter. Keep the result hero dark, comparisons textually explicit and colors supplemental to words/icons.

- [ ] **Step 4: Write trend-chart RED tests**

Mock Recharts only where JSDOM lacks measurement. Assert the accessible chart name and textual summary, default `Resultado`, toggles to `Ingresos`/`Gastos`, both selected/previous data keys, tooltip ARS formatter, and a minimum mobile plotting width.

- [ ] **Step 5: Implement the trend chart with official Recharts 3 APIs**

Use `LineChart responsive accessibilityLayer` with CSS width/min-width and fixed height, two `Line` components, `CartesianGrid`, `XAxis`, `YAxis` and `Tooltip`. Disable or minimize animation when `prefers-reduced-motion` applies. The surrounding section owns the scroll container and an always-visible textual summary.

```tsx
<LineChart
  responsive
  accessibilityLayer
  data={chartData}
  style={{ width: "100%", minWidth: 680, height: 320 }}
>
  <Line dataKey="selected" name={selectedLabel} stroke="var(--report-current)" />
  <Line dataKey="previous" name={previousLabel} stroke="var(--report-previous)" strokeDasharray="5 5" />
</LineChart>
```

- [ ] **Step 6: Write and implement composition tests/components**

Assert services/products/subscriptions, fixed/variable/supplies and dynamic payment methods; proportional widths; exact amounts; zero-total local empty copy; stable insight sentence; and no pie-chart SVG. Implement semantic labeled bars with CSS custom-property widths capped from 0% to 100%.

- [ ] **Step 7: Write and implement ranking tests/components**

Assert only five initial services/products, deterministic order received from the server, quantity plus revenue, `Ver detalle` expansion, collapse, and best/worst day cards including negative amounts. Empty rankings get local explanatory copy.

- [ ] **Step 8: Run the complete component slice**

Run: `npx vitest run src/components/reports --reporter=dot`  
Run: `npx eslint src/components/reports src/lib/reports/insights.ts`  
Expected: PASS with zero warnings.

- [ ] **Step 9: Commit the visual components**

```bash
git add package.json package-lock.json src/components/reports
git commit -m "feat(reports): add visual business report sections"
```

---

### Task 6: Assemble interaction, protected page and navigation

**Files:**
- Create: `src/components/reports/reports-workspace.tsx`
- Create: `src/components/reports/reports-workspace.test.tsx`
- Create: `src/app/(dashboard)/reports/page.tsx`
- Create: `src/app/(dashboard)/reports/page.test.tsx`
- Create: `src/app/(dashboard)/reports/loading.tsx`
- Create: `src/app/(dashboard)/reports/error.tsx`
- Modify: `src/components/app-sidebar.tsx`
- Modify: `src/components/app-sidebar.test.tsx`

**Interfaces:**
- Consumes: `reportClient.get`, `getBusinessReport`, `getBuenosAiresReportMonth` and Task 5 components.
- Produces: the manager-only `/reports` route and active sidebar link.

- [ ] **Step 1: Write workspace RED tests**

Cover initial rendering, valid month selection, future-month max bound, loading skeleton/disabled selector, successful replacement, failure preserving old data and resetting the selector, retry, and two controlled promises proving that a stale first response cannot overwrite a newer second response.

```ts
expect(await screen.findByText("No se pudieron cargar los reportes.")).toBeVisible();
expect(screen.getByLabelText("Mes del reporte")).toHaveValue("2026-08");
expect(screen.getByText("$ 120.000")).toBeVisible(); // last successful snapshot remains
```

- [ ] **Step 2: Implement `ReportsWorkspace`**

Mirror the Expenses sequence/ref pattern. Store `loadedMonth` separately from `requestedMonth`; on failure reset the controlled input to `loadedMonth`. Derive `max` from the server-supplied current month prop rather than the browser timezone. Render a dedicated whole-report empty state only when gross, expenses and all rankings are zero.

- [ ] **Step 3: Write page and sidebar RED tests**

Assert `requireManagerPage`, current Buenos Aires month, initial service call, `Reportes` metadata/copy, manager-only `/reports` link and active nested-route behavior. Assert employee sidebar has no Reportes link.

- [ ] **Step 4: Implement the protected page and sidebar link**

The page directly awaits the service in its Server Component and passes the result plus current month to the workspace. Add `href: "/reports"` to the existing administration item. Use the existing sticky header and maximum-width shell.

- [ ] **Step 5: Implement loading and error files**

`loading.tsx` mirrors hero, KPI grid and chart geometry with accessible loading text. `error.tsx` is a client error boundary with `reset()` and generic copy; it must not print the underlying error.

- [ ] **Step 6: Run focused page/workspace/navigation tests**

Run: `npx vitest run src/components/reports/reports-workspace.test.tsx 'src/app/(dashboard)/reports/page.test.tsx' src/components/app-sidebar.test.tsx --reporter=dot`  
Run: `npx next typegen && npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 7: Commit the complete route**

```bash
git add src/components/reports/reports-workspace.tsx src/components/reports/reports-workspace.test.tsx 'src/app/(dashboard)/reports' src/components/app-sidebar.tsx src/components/app-sidebar.test.tsx
git commit -m "feat(reports): add manager business reports workspace"
```

---

### Task 7: Extend database audit and rollback-only acceptance

**Files:**
- Modify: `scripts/system-db-audit.ts`
- Modify: `scripts/system-db-acceptance.ts`
- Modify: `supabase/queries/README.md`

**Interfaces:**
- Consumes: installed `get_business_report(uuid, text)` and `businessReportSchema`.
- Produces: repeatable evidence without retained acceptance fixtures.

- [ ] **Step 1: Add `get_business_report` to the audit RED expectation**

Extend `requiredFunctions`, then assert that the installed fingerprint row for `get_business_report` has the exact identity arguments `actor_user_id uuid, target_month text`. Keep unsafe routine grants at zero.

- [ ] **Step 2: Add report fixtures to the existing acceptance transaction**

Reuse the acceptance manager/employee and create isolated current/comparison-month records with unique IDs. Include:

- active normal service/product sale with charged overrides;
- active fixed subscription;
- voided income excluded from all values;
- two payment snapshots;
- active fixed/variable/supplies expenses;
- voided expense excluded;
- a day with negative operating result;
- deterministic tied ranking names.

Call the RPC as manager and parse with `businessReportSchema`; call as employee and expect `MANAGER_REQUIRED`.

- [ ] **Step 3: Assert exact financial identities and period behavior**

Use `assert.equal` for gross, commission, net, expenses, result, margin, composition totals and ranking quantities. Assert `summary.grossIncome === incomeComposition sum === paymentComposition sum`, `summary.barbershopNet - summary.expenses === summary.operatingResult`, complete daily dates, comparable cutoff, current projection and `null` projection for a closed month.

- [ ] **Step 4: Confirm rollback cleanup marker**

Keep all fixtures inside the runner's transaction, add a `PASS` marker for reports, and retain the existing final rollback/global invariant audit. No trigger disabling is needed for this read-only RPC.

- [ ] **Step 5: Document ordered installation and verification**

Append `039_business_reports.sql` after `038`, describe its manager-only snapshot and list the exact commands:

```bash
npm run audit:db
npm run acceptance:db
```

- [ ] **Step 6: Apply only to the authorized disposable/test database and run evidence**

Execute the whole migration in the Supabase SQL Editor or approved PostgreSQL path. Stop on any error. Then run the audit and acceptance commands. Expected: the new RPC is installed with no unsafe grants, report scenarios pass, and all prior scenarios remain green. If database authorization is not present, stop this step and record `039` as the only external action rather than claiming installation.

- [ ] **Step 7: Commit acceptance and installation documentation**

```bash
git add scripts/system-db-audit.ts scripts/system-db-acceptance.ts supabase/queries/README.md
git commit -m "test(reports): verify report rpc against postgres"
```

---

### Task 8: Validate the real responsive experience

**Files:**
- Modify only report component/page files when a reproduced visual or accessibility defect requires correction.
- Add the closest matching report component regression test for every correction.

**Interfaces:**
- Consumes: running authenticated app and installed test migration `039`.
- Produces: desktop/mobile visual acceptance evidence.

- [ ] **Step 1: Start the app with the repository's Node 24.18/npm 11.16 runtime**

Run: `npm run dev`  
Expected: Next.js starts without route or hydration errors.

- [ ] **Step 2: Validate manager desktop behavior**

At a desktop viewport, verify manager-only navigation, current month, hero hierarchy, six readable KPIs, chart toggle/tooltips, composition bars, ranking expansion, prior-month selection and no console errors.

- [ ] **Step 3: Validate 390×844 behavior**

Verify no document-level horizontal overflow; only the plot region may scroll. Confirm cards stack, labels remain legible, bars do not clip, `Ver detalle` remains reachable and tooltips do not escape the viewport.

- [ ] **Step 4: Validate empty, negative and failure states**

Use controlled test data or component tests to verify the full empty state, no-comparison copy, negative operating result, absent projection for closed months and failed month reload preserving the prior report.

- [ ] **Step 5: Fix only reproduced defects with RED tests**

For each defect, first add a failing component test, implement the smallest correction, rerun the focused test and repeat the affected browser check.

- [ ] **Step 6: Run the report slice**

Run: `npx vitest run src/lib/reports src/components/reports src/app/api/reports 'src/app/(dashboard)/reports/page.test.tsx' src/components/app-sidebar.test.tsx --reporter=dot`  
Expected: PASS.

- [ ] **Step 7: Commit verified UI corrections if files changed**

```bash
git add src/components/reports 'src/app/(dashboard)/reports'
git commit -m "fix(reports): polish responsive report experience"
```

Skip this commit when validation requires no code change.

---

### Task 9: Complete documentation and full verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `product.md`
- Modify: `context_snapshot.md`

**Interfaces:**
- Consumes: actual implementation and test/database evidence from Tasks 1–8.
- Produces: truthful project state and final handoff.

- [ ] **Step 1: Update durable architecture and product state**

Add the reports domain/map and financial invariants to `AGENTS.md`. Change the Reports row in `product.md` from `Planned` to either `Implemented locally` or `Installed in test`, matching the actual database outcome. Record that employee performance, exports and advanced forecasting remain deferred.

- [ ] **Step 2: Update the operational snapshot**

Prepend a dated Reportes entry with the active branch, commit state, migration `039` status, focused/full counts, browser validation and any external deployment action. Remove or clearly supersede the old recommendation that Reportes is merely planned; do not erase historical provenance.

- [ ] **Step 3: Run formatting and focused verification**

Run: `git diff --check`  
Run: `npx vitest run src/lib/reports src/components/reports src/app/api/reports 'src/app/(dashboard)/reports/page.test.tsx' src/components/app-sidebar.test.tsx --reporter=dot`  
Expected: clean diff and passing report slice.

- [ ] **Step 4: Run the complete repository verification**

Run: `npm test -- --maxWorkers=2`  
Run: `npx next typegen && npx tsc --noEmit`  
Run: `npm run lint`  
Run: `git diff --check`  
Run: `npm run build`  
Expected: every command exits 0. Use two Vitest workers to avoid the known high-parallel product UI timeout.

- [ ] **Step 5: Rerun database evidence after the final code shape when authorized**

Run: `npm run audit:db`  
Run: `npm run acceptance:db`  
Expected: no unsafe grants or invariant violations and every scenario, including Reportes, passes. If migration installation was not authorized, document these two commands as pending instead of reporting success.

- [ ] **Step 6: Commit documentation and final verified state**

```bash
git add AGENTS.md product.md context_snapshot.md
git commit -m "docs(reports): record verified business reports delivery"
```

- [ ] **Step 7: Request final code review before integration**

Use `superpowers:requesting-code-review` against the complete branch diff. Resolve findings through `superpowers:receiving-code-review`, rerun the affected focused tests and the full verification commands, then use `superpowers:finishing-a-development-branch` to offer merge/PR/branch-retention choices.
