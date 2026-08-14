# Commercial Catalogs and Item Commissions Design

**Status:** Approved in conversation on 2026-08-14  
**Branch:** `feat/backend-models`  
**Database:** Supabase PostgreSQL, server-secret access only  
**Business timezone:** `America/Argentina/Buenos_Aires`

## Objective

Extend the commercial workflow with canonical product-category and payment-method catalogs, item-level commission snapshots, richer customer visit history, owner commission enforcement and live role-scoped metric verification.

This project has not reached production. The final schema and RPC names must therefore be canonical: no duplicate `_v2` tables, no compatibility tables and no retained `_v2` RPCs after the application has moved to the final contracts.

## Approved decisions

- A sale whose responsible `employee_id` has the `owner` role earns zero commission, regardless of the registering actor.
- An owner may still be the responsible barber and have sales attributed to them.
- A manager registering a sale for a non-owner employee uses that employee's configured commissions.
- Owner sales reject both service and product 100% exceptions.
- Combined payments may use any positive number of distinct active payment methods, provided their exact sum equals the authoritative sale total.
- Product categories and payment methods use logical deactivation and reactivation. Historical references are never physically deleted.
- A product category cannot be deactivated while active products reference it.
- The last active payment method cannot be deactivated.
- A 100% product exception applies to the complete selected line and therefore to every unit in that line.
- Service and multiple product-line exceptions may coexist in one sale.
- A manager cannot grant a 100% exception to themselves.

## Migration architecture

Numbered files are ordered database change scripts, not schema-version suffixes. They modify canonical objects in place.

1. `012_owner_commission_rules.sql`
   - enforce zero owner commission;
   - reject owner commission exceptions;
   - snapshot the responsible role;
   - correct existing development owner sales to zero commission;
   - introduce canonical `update_user_profile` and begin removing `_v2` RPC naming.
2. `013_customer_visit_financials.sql`
   - expand `list_customer_visits` with historical prices and totals;
   - introduce canonical `create_customer` and `update_customer`;
   - remove `create_customer_v2` and `update_customer_v2` after callers move.
3. `014_product_categories.sql`
   - create and secure `product_categories`;
   - seed and map the four current category values;
   - replace `products.category` with `products.category_id`;
   - add category lifecycle functions and acceptance checks.
4. `015_product_item_commissions.sql`
   - add item-level commission snapshots;
   - support 100% product lines;
   - introduce canonical `create_income` and remove `create_income_v2` after callers move.
5. `016_payment_methods.sql`
   - create and secure `payment_methods`;
   - migrate cash and transfer allocations;
   - replace text payment methods with catalog foreign keys and name snapshots;
   - generalize `create_income`, `list_incomes`, filters and payment totals.

Every script runs as one transaction, is ordered after its predecessor and contains non-destructive structural checks plus rollback-wrapped behavioral acceptance examples in `supabase/queries/README.md`.

## Canonical RPC cleanup

The application and database will finish with these canonical names:

- `update_user_profile`
- `create_customer`
- `update_customer`
- `create_income`
- `list_customer_visits`
- `list_incomes`

The existing `update_user_profile_v2`, `create_customer_v2`, `update_customer_v2` and `create_income_v2` functions are removed after their TypeScript repositories use the canonical functions. No compatibility aliases remain in the final development schema.

## Owner commission policy

`create_income` locks and re-reads the authenticated actor and responsible employee before pricing or commission calculation. It snapshots the responsible role on `incomes.responsible_role_snapshot`.

For new sales:

- `owner`: effective service and product rates are zero; all item commission amounts and aggregate commission totals are zero; `barbershop_net` equals the sale total.
- `admin` or `employee`: configured service and product rates apply unless a valid manager exception changes a selected item to 100%.

Any service or product exception is invalid when:

- the actor is not owner/admin;
- the responsible employee is the actor;
- the responsible employee is an owner;
- the referenced service/product line is absent from the sale.

Migration `012` first backfills `responsible_role_snapshot` from the currently referenced user's role. It then performs a one-time development correction for existing sales attributed to a current owner: rates and amounts become zero and barbershop net becomes the historical total. This is acceptable because the project has not reached production. After that correction, snapshots remain immutable even if user roles or configured percentages change.

## Item-level commission snapshots

Each `income_items` row gains immutable fields:

- `line_subtotal`: `unit_price * quantity` at sale time;
- `commission_rate`: effective integer percentage from 0 through 100;
- `commission_amount`: independently calculated integer amount;
- `full_commission`: whether this line received a manager exception;
- `full_commission_authorized_by`: nullable manager foreign key.

Constraints enforce non-negative amounts, a rate in range, valid full-commission authorization and `commission_amount <= line_subtotal`. Owner sales additionally rely on the transactional RPC rule; browser inputs never determine stored amounts or rates.

The product payload includes `grantFullCommission` on each requested product line. The normalized request fingerprint includes this flag as well as every selected payment-method ID and amount. Identical retries remain idempotent; changing any line exception or payment allocation with the same request ID returns a conflict.

The service line uses the same item-level fields. Aggregate columns on `incomes` remain optimized snapshots:

- service/product bases are sums of line subtotals by type;
- service/product commission amounts are sums of line amounts by type;
- `commission_total` is their sum;
- `barbershop_net + commission_total = total`.

`product_commission_rate` continues to snapshot the employee's configured base rate. Mixed effective rates are represented accurately by item rows rather than pretending one aggregate effective rate covers every product.

Existing item rows are backfilled from their parent income. If proportional allocation produces a rounding remainder across multiple legacy product rows, the final deterministic row absorbs the remainder so the item sum exactly matches the stored aggregate commission.

## Customer visit financial history

`list_customer_visits` continues returning active sales only, paginated newest first. Each visit returns:

- `id`;
- `occurredAt`;
- `businessDate`;
- `totalSpent`, sourced from the immutable income total;
- item `type`, historical `name`, `quantity`, `unitPrice` and `subtotal`.

The projection deliberately excludes responsible/registrant identities, payment allocations, commission percentages, commission amounts and exception authorizers. Customer access rules and not-found behavior remain unchanged.

## Product category catalog

`product_categories` contains:

- UUID primary key;
- display name and unique normalized name;
- `is_active`;
- `created_by`, `updated_by`, `created_at`, `updated_at`.

The four existing values are mapped to seeded canonical rows:

- `hair-care` → `Cuidado capilar`;
- `styling` → `Peinado y styling`;
- `beard-care` → `Cuidado de barba`;
- `fragrance` → `Fragancias`.

Every product receives a non-null `category_id` foreign key with `ON DELETE RESTRICT`. After validation, the old text column and enum-like check constraint are dropped. Product reads return a category object rather than a hardcoded TypeScript union.

Owner/admin may create, rename, deactivate and reactivate categories. Every authenticated role may list active categories; managers may include inactive categories for administration. A duplicate normalized name returns conflict. Deactivation returns conflict while active products reference the category.

HTTP endpoints:

- `GET`, `POST /api/product-categories`
- `GET`, `PATCH`, `DELETE /api/product-categories/[id]`

`DELETE` means logical deactivation.

## Payment method catalog

`payment_methods` contains the same identity, normalization, lifecycle and audit fields as product categories. Fixed seeded UUIDs represent `Efectivo` and `Transferencia` so existing rows can be migrated deterministically.

`income_payments` replaces its text method with:

- non-null `payment_method_id` using `ON DELETE RESTRICT`;
- immutable `method_name_snapshot`;
- positive `amount`.

The legacy `incomes.payment_method` and `income_payments.method` text columns are removed after backfill and validation. Historical responses render the snapshot name, so later catalog renames do not rewrite old receipts.

Owner/admin may create, rename, deactivate and reactivate methods. Every authenticated user can list active methods for sale creation and list inactive historical methods for income filtering. Inactive methods cannot be submitted for new sales, but they remain filterable and visible in old sale details. The final active method cannot be deactivated.

HTTP endpoints:

- `GET`, `POST /api/payment-methods`
- `GET`, `PATCH`, `DELETE /api/payment-methods/[id]`

`DELETE` means logical deactivation.

## Dynamic payment allocations and metrics

Sale input uses distinct `{ paymentMethodId, amount }` allocations with no arbitrary maximum count. `create_income` locks all referenced active methods in deterministic UUID order, rejects duplicates or missing/inactive methods and requires the exact bigint allocation sum to equal the authoritative sale total.

Income filtering accepts `paymentMethodId`. A combined sale matches every method it contains. List/detail responses expose payments as method ID, historical method name and amount.

Paginated metrics retain:

- `grossTotal`;
- `commissionTotal`;
- `barbershopNet`;
- `count`;
- `average`.

Hardcoded `cashTotal` and `transferTotal` are replaced by `paymentTotals`, an ordered array of `{ paymentMethodId, name, amount }`. Totals derive from active filtered incomes only. Employee scope remains restricted to their responsible sales; managers may filter across responsible users.

## User interface

### Products

Owner/admin receive an `Administrar categorías` action on `/products`. A responsive management modal/table supports create, rename, deactivate and reactivate. The product editor loads active categories and stores their IDs; hardcoded category unions and labels are removed.

### Incomes

Owner/admin receive an `Administrar medios de pago` action on `/incomes`. Sale entry loads active methods and lets the user add or remove distinct allocations while showing allocated, remaining and excess amounts.

Each selected product line exposes `Dar este producto al 100% al empleado` for a valid manager-to-other-non-owner attribution. The service and multiple product lines can be selected together. Invalid responsible-employee changes clear or disable exceptions before confirmation.

Confirmation and sale detail show every item's subtotal, effective percentage, commission amount and 100% exception. They also show aggregate employee commission and estimated barbershop net.

Income filters use catalog IDs and include inactive methods with historical use. Dashboard/history payment summaries render dynamic `paymentTotals` rather than assuming exactly cash and transfer.

### Customers

The existing visit modal keeps pagination and adds unit price, subtotal and visit total. It does not expose internal employee or commission data.

## Error behavior

Repositories map database sentinel errors to safe application errors:

- duplicate category/method name: HTTP 409;
- category still used by active products: HTTP 409;
- last active payment method: HTTP 409;
- missing or inactive payment method: HTTP 409;
- payment allocation mismatch: HTTP 409;
- invalid, self-authorized or owner-targeted commission exception: HTTP 403;
- reused request ID with changed semantic payload: HTTP 409.

Authorization is repeated at page, route/service and transactional database boundaries. RLS remains enabled with no browser policies; only the server secret role receives function/table access.

## Testing strategy

Implementation follows test-driven development by domain:

1. owner zero-rate calculation, existing-owner backfill and override rejection;
2. visit price/subtotal/total parsing and rendering;
3. category validation, authorization, lifecycle, migration mapping and product integration;
4. per-item normal/full commission calculation, aggregate reconciliation, self/owner rejection and idempotency fingerprints;
5. dynamic method validation, lifecycle, arbitrary split allocation, historical snapshots, filtering and payment totals;
6. role-scoped live metrics.

SQL adapter tests verify exact canonical RPC names and parameters. Route, service, repository, schema and component tests cover authorization and public contracts. Focused suites run after each task, followed by the complete Vitest suite, ESLint, TypeScript through the production build and `git diff --check`.

## Supabase deployment and verification

The application changes are completed and locally verified before remote schema mutation.

1. Inspect the configured Supabase database for all `010` and `011` columns, constraints, functions, RLS flags and grants.
2. Run the documented `010` and `011` acceptance checks. Do not blindly reapply them when the expected objects already exist.
3. Apply `012` through `016` sequentially, stopping after any error.
4. Run each migration's structural checks before continuing.
5. Run rollback-wrapped behavioral SQL for owner, admin and employee sales.
6. Verify a combined sale with at least three payment methods, simultaneous service/product exceptions, customer financial history and payment filtering.
7. Query live manager and employee metrics and independently reconcile `grossTotal`, `commissionTotal` and `barbershopNet` from active scoped rows.
8. Run application smoke tests against the configured project.

If browser/dashboard access or a database connection is unavailable, remote execution is reported as an explicit external blocker; local SQL creation and verification are not misrepresented as applied database state.

## Out of scope

- payment-provider integrations;
- card fees, surcharges or settlement reconciliation;
- hierarchical product categories;
- partial-quantity 100% product exceptions;
- physical deletion of catalog rows;
- reinterpretation of snapshots after the one-time owner-policy correction;
- daily cash-register closure and expense accounting.

## Acceptance criteria

- Owners can own sales but always receive zero commission.
- Owner and self-targeted 100% exceptions fail at the database boundary.
- Visit history shows historical item prices, subtotals and visit totals.
- Product categories are database-managed and all existing products are migrated without null references.
- Managers can administer both catalogs; deactivated values remain historical.
- A sale can allocate its exact total across three or more active methods.
- Any selected product line can receive a manager-authorized 100% commission, including all units in that line.
- Item commission sums equal aggregate sale commission and net reconciliation.
- Income filtering matches any selected method in combined sales.
- Dynamic payment totals and gross/commission/net metrics respect active status and role scope.
- The final database exposes canonical RPC names and contains no retained `_v2` RPCs or version-suffixed tables.
