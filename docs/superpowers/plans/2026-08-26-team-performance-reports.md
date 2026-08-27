# Team Performance Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manager-only monthly team performance to `/reports`, combining active income snapshots with employee work-session time.

**Architecture:** Extend the existing canonical `get_business_report(uuid,text)` JSON snapshot instead of adding another request. PostgreSQL aggregates current and comparable performance per responsible user, the strict report schema validates the nested rows, and one focused React component presents desktop and mobile summaries.

**Tech Stack:** PostgreSQL, Next.js 16.3, React 19, strict TypeScript, Zod, Tailwind CSS, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-25-business-reports-design.md`

## Global Constraints

- Only owner/admin can receive the report; keep the existing authorization boundary unchanged.
- Use active income snapshots and exact work-session overlap with the selected/comparable Buenos Aires date windows.
- Include employees with sessions but no sales, and responsible owner/admin users with sales but nullable attendance metrics.
- Never expose customer identity, session timestamps or employee performance to employee callers.
- Monetary values and worked minutes are safe integers; ratios are nullable when their denominator is zero.
- Extend migration `039` in place and apply it only to the configured test database, never production.
- Implement RED-GREEN TDD and finish with focused tests, full suite, lint, build, database audit and rollback-only acceptance.

---

### Task 1: Extend the strict report contract

**Files:**
- Modify: `src/types/report.ts`
- Modify: `src/lib/reports/schemas.ts`
- Test: `src/lib/reports/schemas.test.ts`

**Interfaces:**
- Produces: `ReportTeamMetrics` with `saleCount`, `grossIncome`, `commission`, `barbershopNet`, `averageTicket`, `workedMinutes`, `grossPerHour`, `netPerHour`, `outsideSessionSaleCount`.
- Produces: `ReportTeamMember` with `id`, `name`, `role`, `current` and `previous`.
- Extends: `BusinessReport.teamPerformance: ReportTeamMember[]`.

- [ ] Write a failing schema test with an employee row and an owner row whose attendance ratios are null; reject decimal money, negative counts, unknown roles and leaked timestamps.
- [ ] Run `npm test -- src/lib/reports/schemas.test.ts --reporter=dot` and confirm RED because `teamPerformance` is unrecognized.
- [ ] Add strict Zod schemas. Use nonnegative safe integers for counts/money/minutes, nullable nonnegative safe integers for average and hourly values, and `owner | admin | employee` for role.
- [ ] Update every complete `BusinessReport` fixture with `teamPerformance: []` and run the report contract/client/repository tests until green.
- [ ] Commit with `feat(reports): define team performance contract`.

### Task 2: Aggregate authoritative team performance in PostgreSQL

**Files:**
- Modify: `supabase/queries/039_business_reports.sql`
- Modify: `src/lib/reports/migration-039.test.ts`
- Modify: `scripts/system-db-acceptance.ts`

**Interfaces:**
- Produces: `teamPerformance` in `get_business_report`, matching Task 1 exactly.
- Current/comparable metrics use the already-derived selected and comparison date boundaries.

- [ ] Add a failing structural test requiring `teamPerformance`, active income filtering, `employee_work_sessions`, `outside_work_session` and deterministic ordering.
- [ ] Run `npm test -- src/lib/reports/migration-039.test.ts --reporter=dot` and confirm RED.
- [ ] Add current and previous income aggregates grouped by `employee_id`; count all active income records and sum stored `total`, `commission_total`, and `barbershop_net`.
- [ ] Add session aggregates grouped by `employee_id`. Compute worked minutes from `greatest(started_at, period_start)` through `least(coalesce(ended_at, clock_timestamp()), period_end + 1 day)`, keeping only positive overlap.
- [ ] Build the member set from both period aggregates, join retained `users` and `roles`, calculate integer average/hourly values with `round`, return nullable attendance for non-employees/zero minutes, and order by current gross descending then name and UUID.
- [ ] Extend rollback acceptance to assert financial identities, nullable owner attendance, employee session inclusion and manager-only authorization.
- [ ] Apply revised `039` to test, then run `npm run audit:db` and `npm run acceptance:db`.
- [ ] Commit with `feat(reports): aggregate team performance`.

### Task 3: Present team performance responsively

**Files:**
- Create: `src/components/reports/report-team-performance.tsx`
- Create: `src/components/reports/report-team-performance.test.tsx`
- Modify: `src/components/reports/reports-workspace.tsx`
- Modify: `context_snapshot.md`
- Modify: `product.md`

**Interfaces:**
- Consumes: `ReportTeamMember[]` from `BusinessReport.teamPerformance`.
- Produces: `<ReportTeamPerformance members={report.teamPerformance} />`.

- [ ] Write failing component tests that verify gross/net/commission/ticket, formatted worked time and per-hour values, `No aplica` for an owner, outside-session warning, previous comparison text, empty state and five-row expansion.
- [ ] Run `npm test -- src/components/reports/report-team-performance.test.tsx --reporter=dot` and confirm RED because the component does not exist.
- [ ] Implement semantic article cards using existing report typography and `Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })`; show `Sin base de comparación` when previous gross is zero.
- [ ] Insert the section after `ReportComposition` and before `ReportRankings`; keep report loading/error/month behavior unchanged.
- [ ] Run focused report tests, `npm test -- --maxWorkers=1`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Update product/context status and commit with `feat(reports): show team performance`.

