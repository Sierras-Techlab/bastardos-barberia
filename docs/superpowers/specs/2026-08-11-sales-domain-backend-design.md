# Persistent Services, Customers and Incomes Backend Design

**Date:** 2026-08-11
**Branch:** `feat/backend-models`
**Prerequisite:** Completed products and inventory backend plus `008_products_inventory.sql`
**Scope:** Persistent services, customers, income creation/history and audited voiding

## Objective

Replace the services, customers and incomes demonstration sources with one persistent commercial domain. A sale belongs only to the authenticated user who registered it, may optionally belong to a customer, contains at most one service and any number of products, preserves historical names and prices, adjusts stock atomically and supports manager-only voiding.

The design also prepares a reliable daily-cash boundary by recording an exact database timestamp and an indexed Buenos Aires business date for every income.

## SQL delivery and execution order

All objects in this design will be delivered in the new file `supabase/queries/009_sales_domain.sql`. It runs only after `008_products_inventory.sql` and leaves scripts `001` through `008` unchanged.

The file creates services, customers, incomes and income items; adds the income reference needed by inventory movements; defines transactional sale functions; enables RLS; restricts grants to `service_role`; and finishes with manual verification queries. The agent does not apply it to Supabase. The user executes `008` and then `009` manually.

## Services

### Data model

`services` contains UUID `id`, display and normalized names, positive integer price, active state, `created_by`, `updated_by`, `deleted_at`, `deleted_by`, `created_at` and `updated_at`.

Normalized names are unique among non-deleted services. Deactivation makes a service temporarily unavailable; logical deletion removes it from normal catalog reads while preserving historical references.

### Permissions and API

- Owner/admin may create, edit, activate, deactivate and logically delete.
- Employee may list active, non-deleted services only.
- `GET/POST /api/services` and `PATCH/DELETE /api/services/:id` enforce those rules at the server boundary.

`/services` preserves its current cards, metrics, search, sorting and dialogs while replacing local fixtures and mutations with the API. The demonstration badge is removed. Deletion remains confirmed and becomes durable logical deletion.

## Customers

### Data model and identity

`customers` contains UUID `id`, first name, last name, required display phone, `normalized_phone`, optional normalized email, non-negative `visits`, `created_by`, `updated_by`, `deleted_at`, `deleted_by`, `created_at` and `updated_at`.

Exact customer names may repeat. Names are presentation data, not identity. The phone is normalized to digits and must be unique among non-deleted customers. Email is optional; when supplied it must be syntactically valid, normalized and unique among non-deleted customers. Logical deletion allows historical incomes to retain the original customer reference and removes the customer from normal reads and future selection.

### Permissions and API

- Every authenticated role may list, create and edit customers.
- Only owner/admin may logically delete customers.
- `GET/POST /api/customers` and `PATCH/DELETE /api/customers/:id` enforce these rules.
- Audit identifiers always come from the authenticated session.

`/customers` exposes create and edit actions to all authenticated roles and delete only to managers. Existing filters, metrics, responsive representations and shared success feedback remain. Email links render only when an email exists.

### Income-form creation flow

The reusable `CustomerEditorDialog` changes to require first name, last name and phone while making email optional. Both `/customers` and `/incomes/new` use the same component and validation messages.

The income customer selector searches by name or phone. When no suitable customer exists, `Crear cliente` opens the shared dialog. A successful `POST /api/customers` immediately adds and selects the returned customer. Customer creation is independent from income submission, so abandoning the sale does not remove the customer.

If the normalized phone or supplied email already exists, the database uniqueness constraint wins under races. The UI explains the conflict and, when the matching active customer is available, offers to select that record instead of creating a duplicate.

## Incomes and income items

### `incomes`

Each income contains:

- `id`: UUID primary key.
- `request_id`: client-generated UUID used only for idempotency.
- `user_id`: authenticated user who registered the sale.
- `customer_id`: optional non-deleted customer selected at creation.
- `payment_method`: `cash` or `transfer`.
- `total`: positive integer pesos calculated by PostgreSQL.
- `status`: `active` or `voided`.
- `created_at`: authoritative `timestamptz` assigned by PostgreSQL.
- `business_date`: date derived in `America/Argentina/Buenos_Aires` and stored for daily cash queries.
- `voided_at` and `voided_by`: manager audit fields populated only when voided.

`request_id` is unique per `user_id`. Retrying the same request returns the already-created income and never creates duplicate items or stock movements.

Indexes support manager date/history queries and employee-scoped queries by `(business_date, created_at)` and `(user_id, business_date, created_at)`. Neither timestamp, business date, total nor user ID is accepted from browser input.

### `income_items`

Each immutable item contains its income, type (`service` or `product`), exactly one matching source reference, name snapshot, unit-price snapshot, positive quantity and subtotal. Service quantity is exactly one, and a unique partial constraint permits at most one service per income. Product quantities are positive integers.

Snapshots keep historical detail stable after catalog renames, price changes, deactivation or logical deletion. An income must contain at least one service or one product; the transactional creation function enforces this invariant.

## Transactional creation

The Route Handler validates the public payload and supplies the authenticated actor to a service-role-only PostgreSQL function. The transaction:

1. Resolves an existing idempotency request before performing mutations.
2. Validates the optional customer and selected service are available.
3. Sorts and locks all selected product rows in deterministic order.
4. Validates active state and sufficient stock.
5. Resolves authoritative catalog names and prices.
6. Inserts the income with database timestamp and Buenos Aires business date.
7. Inserts immutable service/product items and calculates the authoritative total.
8. Updates each product stock and appends linked `sale` inventory movements.
9. Increments the associated customer's visit count once.
10. Commits all changes together or rolls everything back.

The frontend total remains an immediate preview only. PostgreSQL is authoritative.

## Role-aware history and detail

- Owner/admin may list and inspect every income and filter by registering user.
- Employee queries always include their authenticated `user_id` at the repository boundary and cannot widen scope with request parameters.
- Every new income belongs to the authenticated user; the form no longer accepts or displays a responsible-user selector.

`GET /api/incomes` supports current UI search, inclusive date range, user, payment method, sale kind, status and ten-row server pagination. It returns authorized items, filtered metrics and pagination metadata. Search covers customer, item snapshots and registering user where permitted. Initial dates are the current Buenos Aires calendar month, not a hard-coded fixture month.

`GET /api/incomes/:id` applies the same role scope before returning detail. The browser never receives an unauthorized collection and does not perform security filtering.

## Manager-only voiding

`POST /api/incomes/:id/void` is restricted to owner/admin. The database function locks the active income and relevant products, marks the income voided, stores `voided_at` and `voided_by`, restores product quantities, appends linked `sale_void` inventory movements and decrements the customer's visits without allowing it below zero.

The operation is safe to retry: an already-voided income returns its current state without restoring stock twice. Voided incomes remain visible in history but do not contribute to revenue metrics. Physical deletion and sale editing are not supported.

The detail sheet enables `Anular venta` only for managers and uses an explicit confirmation dialog. `Editar venta` remains disabled or is replaced with a clear unavailable label.

## APIs and frontend data flow

- `GET/POST /api/services`
- `PATCH/DELETE /api/services/:id`
- `GET/POST /api/customers`
- `PATCH/DELETE /api/customers/:id`
- `GET/POST /api/incomes`
- `GET /api/incomes/:id`
- `POST /api/incomes/:id/void`

The `/services`, `/customers`, `/incomes` and `/incomes/new` server pages authorize their live session before loading initial data. Client components use narrow API clients for mutations and filter/page changes. Loading, retry, pending and contextual failure states replace mock assumptions; shared Sonner feedback remains for success. All demonstration labels and mock imports are removed from these routes.

## Stable error behavior

Expected public errors include validation failure, unauthorized scope, missing or unavailable catalog records, duplicate service name, duplicate customer phone/email, insufficient product stock, missing income and invalid void state. Stock errors identify the affected product in a safe user-facing message.

Database error details, SQL text and secret configuration never reach browser responses. Transaction failure cannot leave a partial income, visit count or stock movement.

## Testing and verification

Implementation is test-driven and covers:

- Service and customer schemas, normalization, uniqueness and role permissions.
- Optional email rendering and shared customer-dialog behavior.
- Logical deletion with historical identity preservation.
- Customer quick creation, automatic selection and duplicate-phone recovery.
- Income request validation without browser-controlled user, total or timestamps.
- Manager-all versus employee-own repository scope, including direct detail requests.
- Server filtering, metrics, pagination and Buenos Aires month/day boundaries.
- Idempotent income creation and retry behavior.
- Authoritative price snapshots and totals.
- Atomic stock deductions, insufficient-stock rollback and linked movements.
- Visit increment on creation and decrement on void.
- Manager-only idempotent voiding and stock restoration.
- API response/error contracts and frontend pending/retry/success behavior.
- Preservation of existing responsive catalog, customer and income experiences.

Focused tests accompany each red/green cycle. Final verification runs the full test suite, lint, production build and `git diff --check`. The SQL README contains manual post-install checks for tables, RLS, grants, indexes, functions, a sale transaction and a void transaction.

## Execution and permission boundary

Once the user authorizes implementation, the agent may edit repository files, run local tests/lint/build and create scoped commits without further implementation confirmation. It will not execute remote SQL, modify Supabase data, run the owner bootstrap or change credentials. The user remains responsible for applying `008` and then `009` and for performing the documented live-environment verification.

## Acceptance boundary

This delivery is complete when services, customers and incomes no longer use mocks; all supported operations persist behind authenticated server boundaries; employee sale visibility is enforced server-side; customer identity is phone-based; sales and voids update stock and visits atomically; daily cash can query indexed Buenos Aires business dates; and all automated checks pass. Remote SQL application remains the only external deployment action.
