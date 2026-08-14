# Context snapshot

Captured: 2026-08-14

## Repository state

- Active branch: `feat/backend-models` in the primary checkout. Commercial operations V2 and the dashboard agenda correction are integrated directly on this branch for the user's GitHub push and pull request.
- The former `.worktrees/commercial-operations-v2` worktree was removed after the integration. The local `codex/commercial-operations-v2` branch remains only as a historical pointer to commit `158680c`.
- Commercial operations V2 is implemented locally through migrations `010` through `013`; none has been applied to the configured Supabase project.
- User authorized autonomous in-scope implementation, local tests and commits. Remote SQL application, push and PR remain outside the authorization received.
- Product-category domain, authenticated API client, product UUID contracts, manager UI and migration `014` are implemented locally. The migration remains pending manual Supabase installation after `010` through `013`.
- Item-level product commissions (plan `015`, Tasks 1–4) and migration `015` are implemented locally. The canonical item-snapshot response and product exception behavior remain pending manual database installation.
- Dynamic payment methods plan `016`, Task 1 is implemented locally: a server-only catalog domain, strict schemas, conflict mappings and a browser-only API client. Route Handlers, income-contract migration, UI and SQL `016` remain separate pending tasks.

## Delivered behavior

- User administration persists integer service/product commission rates from 0 through 100, initially zero.
- `/incomes/new` enforces role-aware responsible employees: employees are forced to themselves; owner/admin may choose any active user, loading every result page rather than truncating the selector at 100 users.
- A sale accepts one or two distinct positive cash/transfer allocations whose exact sum is validated against server-authoritative prices and total.
- PostgreSQL snapshots service/product commission bases, configured rates, independently rounded amounts, total commission, barbershop net and the optional manager-authorized 100% service exception.
- Income creation remains idempotent and atomic with catalog snapshots, stock, inventory movements, payments and customer visits. Semantic request conflicts are rejected, while an identical retry still succeeds after mutable responsible-user state changes. User, service, product and customer rows remain locked through each new sale so concurrent deactivation or demotion cannot invalidate its authority snapshot.
- `/incomes` scopes employees by responsible `employee_id`; owner/admin can view and filter all historical responsible users, including inactive and logically deleted accounts with retained sales. V2 metrics expose gross, commission, net, count, average and exact payment totals while excluding voids.
- Income detail shows responsible employee, registering actor for managers, split payments, commission bases/rates/amounts, net and 100% authorizer. The confirmation flow shows the complete estimated sale before submission.
- `/customers` persists one optional ISO-weekday/local-time habitual schedule in the same transaction as customer create/update.
- Schedule creation/reactivation/reprogramming generates idempotent occurrences through eight weeks. Versioned effective dates prevent historical fabrication; same-day reprogramming preserves today's prior appointment; reactivation starts today unless a preserved occurrence already exists; per-customer advisory locks and optimistic versions prevent deadlocks and lost updates.
- The `X visita(s)` controls open a responsive paginated modal backed by active income item snapshots. Its strict financial contract includes immutable visit total plus historical item unit price and subtotal; the dialog shows those ARS values while excluding user identities, payments, commissions and authorizations.
- Dashboard fixed customers now come from authorized persistence, not a fixture. Pending attendance may transition once to attended/missed; actor/time are audited, a concurrent second resolution conflicts, and attendance never creates a sale or visit.
- Product categories now have a server-only domain boundary with audited create/update records, atomic logical deactivation, normalized-name/in-use conflict mappings and active-only employee reads. Products carry complete category objects, use category UUIDs for mutations and filters, and managers have a dynamic category administration dialog.
- Migration `014_product_categories.sql` creates the secured canonical category catalog, seeds/backfills the four legacy categories, replaces `products.category` with `category_id`, and promotes category-locked product/category lifecycle RPCs with rollback-wrapped SQL acceptance checks.
- Category UI state keeps catalog product snapshots synchronized after category rename/reactivation/deactivation, editors never submit an inactive hidden category ID, and an in-use deactivation conflict disables that category's action until the manager closes the dialog and refreshes its state.
- Inicio requests fixed-customer occurrences only from the current Buenos Aires date through the current week's Saturday. Sunday is intentionally empty, no occurrence query is made, and the window rotates to the new Monday-through-Saturday week when that Monday begins.
- The fixture `src/data/fixed-customers.mock.json` and the nonexistent `/customers/fixed` navigation were removed.
- Owner commission handling is application-safe: owner creation, promotion and updates normalize both configured rates to zero; owner editor controls are fixed at zero; previews derive the responsible employee role and neutralize owner rates plus the 100% service preview override. User profile persistence now calls the canonical `update_user_profile` RPC.
- Income drafts now carry a strict boolean product exception per selected line. Only a manager attributing the sale to a different non-owner may see exception controls; switching to self or an owner clears service and every product flag, while employees receive no controls. Full product exceptions cover the complete selected quantity and may coexist across products and with a full-service exception.
- Changing or removing the selected service also clears its full-commission exception, so an invisible stale flag can never reach confirmation or submission. Product exception copy states explicitly that 100% covers the value of the complete line quantity.
- Commission previews calculate service and product lines independently. Persisted-income contracts require immutable commission snapshots inside the service and every product item, while the aggregate exposes exact commission total and barbershop net; confirmation and detail views render the itemized amounts without positional coupling.
- The persisted income and metrics types now mirror the strict response schemas: payments, registering actor, aggregate commission, gross total, commission total and barbershop net are mandatory. Income UI and dashboard consumers no longer fabricate legacy payment data or show pending-backend fallbacks.
- Migration `015_product_item_commissions.sql` backfills immutable service/product item snapshots with exact parent reconciliation, calculates new product lines independently, fingerprints strict product exception flags and promotes the sole canonical `create_income` RPC. It preserves category-first product locks, stock/payments/customer visits, scoped history and idempotent retries while removing `create_income_v2`.
- Canonical income idempotency dual-compares the exact pre-015 product fingerprint only when every newly required product exception flag is false. It preserves the historical audit hash, accepts a semantically identical cross-migration retry and still conflicts when any flag changes to true.
- Payment methods now have strict trimmed 1–80-character names, manager-only create/update/deactivate operations, canonical lifecycle RPC adapters and stable duplicate/last-active conflicts. Authenticated catalog reads include inactive methods so historical payment filters can keep their labels.

## SQL and deployment state

- `supabase/queries/010_income_commissions_and_split_payments.sql` contains user commission columns/RPC, income registrant/responsible separation, normalized bigint payments, overflow-safe immutable commission snapshots, locked catalog authorization and a manager-only historical-responsible projection.
- `supabase/queries/011_customer_visits_and_fixed_schedules.sql` contains effective-dated weekly schedules, per-customer serialized occurrence generation/resolution, optimistic schedule concurrency, transactional customer V2 functions and sanitized visit projection.
- `supabase/queries/012_owner_commission_rules.sql` enforces owner-zero commission rates and snapshots, and promotes `update_user_profile` to its canonical RPC.
- `supabase/queries/013_customer_visit_financials.sql` promotes the schedule-aware customer RPCs to canonical `create_customer`/`update_customer` names and exposes only active-sale totals plus immutable item prices/subtotals in paginated visit history.
- `supabase/queries/014_product_categories.sql` provides the canonical audited category catalog, UUID product foreign key, safe manager-only deactivation and category-first product mutation locks.
- `supabase/queries/015_product_item_commissions.sql` provides immutable item-level subtotal/rate/amount/exception snapshots, proportional legacy backfill, canonical sale creation and itemized income JSON.
- `supabase/queries/README.md` documents ordered installation `001` through `015`, structural reconciliation/grant checks and rollback-wrapped normal/full/unauthorized/idempotency acceptance scenarios.
- The configured Supabase project is known to have scripts `001` through `009`. Apply `010` through `015` manually and run the documented checks before considering these features live.

## Verification

- Last full suite before Fix Round 1: 127 test files / 468 tests passed.
- Fix Round 1 focused coverage: 15 test files / 60 tests passed, including service exception reset on deselect/change, singular/plural whole-line product copy and a manager-to-other-employee submission combining full service plus two full product lines.
- The Tasks 1–3 focused groups passed with 22 domain/contract tests, 18 repository/service/client tests and 29 UI tests. Task 4 now has five migration/type contract checks; Fix Round 1 passed the focused income slice with 13 files / 66 tests.
- ESLint passed with no warnings.
- Next.js 16.3 production build passed, including all new API routes.
- TypeScript and `git diff --check` passed.
- Local runtime was Node 24.17/npm 11.13; repository target remains Node 24.18/npm 11.16.
- The workweek correction also has 15 focused passing tests covering calendar boundaries, server query scope and card behavior.
- Payment-method Task 1 passed 4 focused files / 12 tests, TypeScript and `git diff --check`; the full suite passed 131 files / 481 tests.

## Known boundaries

- SQL behavior is structurally covered by strict RPC/migration adapter tests and documented executable SQL acceptance blocks, but migrations `010` through `015` still require manual PostgreSQL execution and verification.
- Migrations `012` and `013` now provide the owner-safe and customer-visit RPC contracts required by the application, but they remain unapplied remotely; deploy `010` through `013` as one ordered manual SQL installation.
- Physical deletion, sale editing, expenses, daily cash/register closure and reporting remain outside this milestone.
- The application and migration now share canonical `create_income` with per-product exception flags; migration `015` must be installed after `014` before this application slice can be deployed safely.
- A dedicated fixed-customer management route is not part of this increment; scheduling remains in the shared customer create/edit modal.
- Payment methods are not connected to Route Handlers, incomes, UI or database SQL yet; the RPC names and argument contracts are covered locally for the upcoming migration `016`.

## Recommended next task

Implement plan `016`, Task 2: authenticated payment-method Route Handlers over the completed domain.

## Context maintenance rule

Update this file after every completed task with the active branch, delivered behavior, unresolved external actions, known boundaries and the single best next task. Update `product.md` whenever scope, module status or objectives change; update `AGENTS.md` only when durable architecture or workflow changes.
