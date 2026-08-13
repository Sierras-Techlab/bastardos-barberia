# Context snapshot

Captured: 2026-08-13

## Repository state

- Active isolated branch: `codex/commercial-operations-v2` in `.worktrees/commercial-operations-v2`, based on integrated `origin/dev` commit `05b479f`.
- The primary checkout remains untouched on `feat/backend-models`.
- Commercial operations V2 is implemented locally through migrations `010` and `011`; neither migration was applied to the configured Supabase project.
- User authorized autonomous in-scope implementation, local tests and commits. Remote SQL application, push and PR remain outside the authorization received.

## Delivered behavior

- User administration persists integer service/product commission rates from 0 through 100, initially zero.
- `/incomes/new` enforces role-aware responsible employees: employees are forced to themselves; owner/admin may choose any active user.
- A sale accepts one or two distinct positive cash/transfer allocations whose exact sum is validated against server-authoritative prices and total.
- PostgreSQL snapshots service/product commission bases, configured rates, independently rounded amounts, total commission, barbershop net and the optional manager-authorized 100% service exception.
- Income creation remains idempotent and atomic with catalog snapshots, stock, inventory movements, payments and customer visits. Semantic request conflicts are rejected.
- `/incomes` scopes employees by responsible `employee_id`; owner/admin can view and filter all responsible users. V2 metrics expose gross, commission, net, count, average and exact payment totals while excluding voids.
- Income detail shows responsible employee, registering actor for managers, split payments, commission bases/rates/amounts, net and 100% authorizer. The confirmation flow shows the complete estimated sale before submission.
- `/customers` persists one optional ISO-weekday/local-time habitual schedule in the same transaction as customer create/update.
- Schedule creation/reactivation/reprogramming generates idempotent occurrences through eight weeks. Changes preserve past/current and resolved history while removing only future pending rows from superseded schedules.
- The `X visita(s)` controls open a responsive paginated modal backed by active income item snapshots. The response intentionally excludes prices, totals, payments, commissions and user identities.
- Dashboard fixed customers now come from authorized persistence, not a fixture. Pending attendance may transition once to attended/missed; actor/time are audited, a concurrent second resolution conflicts, and attendance never creates a sale or visit.
- The fixture `src/data/fixed-customers.mock.json` and the nonexistent `/customers/fixed` navigation were removed.

## SQL and deployment state

- `supabase/queries/010_income_commissions_and_split_payments.sql` contains user commission columns/RPC, income registrant/responsible separation, normalized payments, immutable commission snapshots and V2 create/read/list functions.
- `supabase/queries/011_customer_visits_and_fixed_schedules.sql` contains weekly schedules, occurrence generation/resolution, transactional customer V2 functions and sanitized visit projection.
- `supabase/queries/README.md` documents ordered installation `001` through `011` and transaction-wrapped post-install acceptance checks.
- The configured Supabase project is known to have scripts `001` through `009`. Apply `010` then `011` manually and run the documented checks before considering these features live.

## Verification

- Full suite: 118 test files / 400 tests passed.
- ESLint passed with no warnings.
- Next.js 16.3 production build passed, including all new API routes.
- TypeScript and `git diff --check` passed.
- Local runtime was Node 24.17/npm 11.13; repository target remains Node 24.18/npm 11.16.

## Known boundaries

- SQL behavior is structurally covered by strict RPC adapter tests and documented executable SQL acceptance blocks, but migrations `010`/`011` still require manual PostgreSQL execution and verification.
- Physical deletion, sale editing, expenses, daily cash/register closure and reporting remain outside this milestone.
- A dedicated fixed-customer management route is not part of this increment; scheduling remains in the shared customer create/edit modal.

## Recommended next task

Review and manually execute migrations `010` and `011` in order, run every corresponding README verification query, then perform live owner/admin/employee smoke tests before integrating the branch.

## Context maintenance rule

Update this file after every completed task with the active branch, delivered behavior, unresolved external actions, known boundaries and the single best next task. Update `product.md` whenever scope, module status or objectives change; update `AGENTS.md` only when durable architecture or workflow changes.
