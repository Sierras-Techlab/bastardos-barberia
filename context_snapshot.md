# Context snapshot

Captured: 2026-08-14

## Repository state

- Active branch: `feat/backend-models` in the primary checkout. Commercial operations V2 and the dashboard agenda correction are integrated directly on this branch for the user's GitHub push and pull request.
- The former `.worktrees/commercial-operations-v2` worktree was removed after the integration. The local `codex/commercial-operations-v2` branch remains only as a historical pointer to commit `158680c`.
- Commercial operations V2 is implemented locally through migrations `010` and `011`; neither migration was applied to the configured Supabase project.
- User authorized autonomous in-scope implementation, local tests and commits. Remote SQL application, push and PR remain outside the authorization received.

## Delivered behavior

- User administration persists integer service/product commission rates from 0 through 100, initially zero.
- The responsive user directory exposes each employee's service and product commission percentages, and commission inputs can be cleared and replaced without retaining a leading zero while still rejecting empty or invalid values on submit.
- Authenticated sessions hydrate both commission rates, so an employee loading `/incomes/new` receives the same persisted commission configuration used by manager-selected employees.
- `/incomes/new` enforces role-aware responsible employees: employees are forced to themselves; owner/admin may choose any active user, loading every result page rather than truncating the selector at 100 users.
- A sale accepts one or two distinct positive cash/transfer allocations whose exact sum is validated against server-authoritative prices and total.
- PostgreSQL snapshots service/product commission bases, configured rates, independently rounded amounts, total commission, barbershop net and the optional manager-authorized 100% service exception.
- Income creation remains idempotent and atomic with catalog snapshots, stock, inventory movements, payments and customer visits. Semantic request conflicts are rejected, while an identical retry still succeeds after mutable responsible-user state changes. User, service, product and customer rows remain locked through each new sale so concurrent deactivation or demotion cannot invalidate its authority snapshot.
- `/incomes` scopes employees by responsible `employee_id`; owner/admin can view and filter all historical responsible users, including inactive and logically deleted accounts with retained sales. V2 metrics expose gross, commission, net, count, average and exact payment totals while excluding voids.
- Income detail shows responsible employee, registering actor for managers, split payments, commission bases/rates/amounts, net and 100% authorizer. The confirmation flow shows the complete estimated sale before submission.
- `/customers` persists one optional ISO-weekday/local-time habitual schedule in the same transaction as customer create/update.
- The customer directory can combine text search and ordering with a fixed-schedule filter for all customers, habitual customers or customers without a habitual schedule.
- Schedule creation/reactivation/reprogramming generates idempotent occurrences through eight weeks. Versioned effective dates prevent historical fabrication; same-day reprogramming preserves today's prior appointment; reactivation starts today unless a preserved occurrence already exists; per-customer advisory locks and optimistic versions prevent deadlocks and lost updates.
- The `X visita(s)` controls open a responsive paginated modal backed by active income item snapshots. The response intentionally excludes prices, totals, payments, commissions and user identities.
- Dashboard fixed customers now come from authorized persistence, not a fixture. Pending attendance may transition once to attended/missed; actor/time are audited, a concurrent second resolution conflicts, and attendance never creates a sale or visit.
- Inicio requests fixed-customer occurrences only from the current Buenos Aires date through the current week's Saturday. Sunday is intentionally empty, no occurrence query is made, and the window rotates to the new Monday-through-Saturday week when that Monday begins.
- The fixture `src/data/fixed-customers.mock.json` and the nonexistent `/customers/fixed` navigation were removed.

## SQL and deployment state

- `supabase/queries/010_income_commissions_and_split_payments.sql` contains user commission columns/RPC, income registrant/responsible separation, normalized bigint payments, overflow-safe immutable commission snapshots, locked catalog authorization and a manager-only historical-responsible projection.
- `supabase/queries/011_customer_visits_and_fixed_schedules.sql` contains effective-dated weekly schedules, per-customer serialized occurrence generation/resolution, optimistic schedule concurrency, transactional customer V2 functions and sanitized visit projection.
- `supabase/queries/README.md` documents ordered installation `001` through `011` and transaction-wrapped post-install acceptance checks.
- The configured Supabase project now exposes the commission columns and `update_user_profile_v2` behavior from `010`; the complete `010`/`011` acceptance checklist has not been rerun, so deployment verification remains pending.

## Verification

- Full suite: 119 test files / 415 tests passed.
- ESLint passed with no warnings.
- Next.js 16.3 production build passed, including all new API routes.
- TypeScript and `git diff --check` passed.
- Local runtime was Node 24.17/npm 11.13; repository target remains Node 24.18/npm 11.16.
- The workweek correction also has 15 focused passing tests covering calendar boundaries, server query scope and card behavior.
- Session commission hydration has a red/green regression test, and the focused session, income-page and commission-preview suite passes 10 tests.
- The focused user, customer and role-scoped dashboard verification passes 45 tests.

## Known boundaries

- SQL behavior is structurally covered by strict RPC adapter tests and documented executable SQL acceptance blocks, but migrations `010`/`011` still require manual PostgreSQL execution and verification.
- Physical deletion, sale editing, expenses, daily cash/register closure and reporting remain outside this milestone.
- A dedicated fixed-customer management route is not part of this increment; scheduling remains in the shared customer create/edit modal.

## Recommended next task

Review and manually execute migrations `010` and `011` in order, run every corresponding README verification query, then perform live owner/admin/employee smoke tests before integrating the branch.

## Context maintenance rule

Update this file after every completed task with the active branch, delivered behavior, unresolved external actions, known boundaries and the single best next task. Update `product.md` whenever scope, module status or objectives change; update `AGENTS.md` only when durable architecture or workflow changes.
