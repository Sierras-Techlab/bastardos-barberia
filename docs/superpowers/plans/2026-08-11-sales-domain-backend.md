# Services, Customers and Incomes Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist services, customers and role-scoped incomes, including inline customer creation, atomic inventory/visit updates, idempotent creation and manager-only voiding.

**Architecture:** `009_sales_domain.sql` adds the remaining commercial tables and PostgreSQL functions that own sale/void transactions and Buenos Aires business dates. Server-only repositories and services expose narrow authenticated contracts to Next.js Route Handlers and Server Components; the existing client workspaces retain their visual structure while switching from fixtures to API-backed state and server-side income queries.

**Tech Stack:** Next.js 16.3 App Router and Route Handlers, React 19.2, strict TypeScript, Supabase PostgreSQL through `SUPABASE_SECRET_KEY`, Zod 4, Vitest 4 and Testing Library.

## Global Constraints

- Complete and verify `docs/superpowers/plans/2026-08-11-products-inventory-backend.md` first.
- Read the installed Next.js guides before changing framework code; promised params and uncached authenticated data rules apply.
- Browser requests never control audit user IDs, totals, catalog prices, `created_at` or `business_date`.
- Owner/admin see all incomes; employee sees only incomes registered by their authenticated user ID.
- All authenticated roles may create and edit customers; only owner/admin may logically delete them.
- Only owner/admin may mutate services or void incomes.
- Customer names may duplicate; normalized phone is required and unique; email is optional and unique when supplied.
- Sale creation and voiding are atomic across incomes, items, product stock, inventory movements and customer visits.
- Store `created_at timestamptz` plus an indexed `business_date` derived in `America/Argentina/Buenos_Aires`.
- Do not execute SQL remotely, alter credentials, run bootstrap or implement cash/report screens.
- Physical deletion and income editing remain out of scope.
- Use TDD and commit after every completed task.
- SQL migration files are the sole TDD exception: no local PostgreSQL/Docker runtime is available and remote execution is prohibited, so their behavior is verified by rollback-safe queries documented for the user; every TypeScript consumer is still developed RED/GREEN.

---

### Task 1: Sales-domain SQL contract

**Files:**
- Create: `supabase/queries/009_sales_domain.sql`
- Modify: `supabase/queries/README.md`
- Modify: `src/lib/supabase/database.types.ts`

**Interfaces:**
- Consumes: `users`, `products`, `inventory_movements` and service-role security from scripts `001` through `008`.
- Produces: `services`, `customers`, `incomes`, `income_items`, sale/void/list/detail functions and income-linked inventory movements.

- [x] **Step 1: Implement the complete ordered SQL script**

Create these contracts:

```sql
public.services(id, name, normalized_name, price, is_active,
  created_by, updated_by, deleted_at, deleted_by, created_at, updated_at)

public.customers(id, first_name, last_name, phone, normalized_phone,
  email, visits, created_by, updated_by, deleted_at, deleted_by,
  created_at, updated_at)

public.incomes(id, request_id, user_id, customer_id, payment_method,
  total, status, created_at, business_date, voided_at, voided_by)

public.income_items(id, income_id, item_type, service_id, product_id,
  name_snapshot, unit_price, quantity, subtotal, created_at)
```

Add partial unique indexes for non-deleted normalized service names, customer phones and non-null emails; exact-one-source item checks; service quantity-one and at-most-one-service constraints; positive money/quantity checks; `(user_id, request_id)` idempotency; daily/global and user/daily income indexes; `inventory_movements.income_id`; and RLS/grants matching the existing secret-server model.

Implement service-role-only `create_income`, `void_income`, `list_incomes` and `get_income_detail` functions. `create_income` locks products in deterministic UUID order, resolves authoritative prices/names, writes item snapshots, updates stocks/movements/visits and uses the database clock to derive Buenos Aires `business_date`. `void_income` is idempotent and reverses stock/visits once. Listing returns authorized page items, filtered metrics and pagination.

Add row types for every new table to `database.types.ts`, update README order and include copy/paste verification queries for schema/security plus one rollback-wrapped sample sale and void transaction.

- [x] **Step 2: Review rollback-safe transaction verification and run the local whitespace check**

Confirm the README provides a `begin;` / create sale / inspect stock, visits and business date / void sale / inspect reversals / `rollback;` sequence for the user to execute after installation.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 3: Commit the database domain**

```bash
git add supabase/queries/009_sales_domain.sql supabase/queries/README.md src/lib/supabase/database.types.ts
git commit -m "feat(sales): add persistent sales database domain"
```

### Task 2: Persistent services

**Files:**
- Create: `src/lib/services/schemas.ts`
- Create: `src/lib/services/contracts.ts`
- Create: `src/lib/services/repository.ts`
- Create: `src/lib/services/repository.test.ts`
- Create: `src/lib/services/service.ts`
- Create: `src/lib/services/service.test.ts`
- Create: `src/lib/services/client.ts`
- Create: `src/lib/services/client.test.ts`
- Create: `src/app/api/services/route.ts`
- Create: `src/app/api/services/route.test.ts`
- Create: `src/app/api/services/[id]/route.ts`
- Create: `src/app/api/services/[id]/route.test.ts`
- Modify: `src/types/service-catalog.ts`
- Modify: `src/lib/services/service-catalog.ts`
- Modify: `src/app/(dashboard)/services/page.tsx`
- Modify: `src/app/(dashboard)/services/page.test.tsx`
- Modify: `src/components/services/services-view.tsx`
- Modify: `src/components/services/services-view.test.tsx`
- Modify: `src/components/services/service-editor-dialog.test.tsx`
- Modify: `src/components/services/service-status-dialog.test.tsx`
- Modify: `src/components/services/service-delete-dialog.test.tsx`

**Interfaces:**
- Consumes: `ServiceRow`, authenticated users and existing service presentation components.
- Produces: persistent service APIs and `ServiceRepository` for income catalog validation.

- [x] **Step 1: Write failing service-domain tests**

Cover trimmed names, positive integer prices, UUIDs, empty PATCH rejection, manager mutations, employee active-only listing, logical deletion, duplicate-name mapping and audit actor propagation.

Use this contract:

```ts
export type ServiceRepository = {
  list(includeInactive: boolean): Promise<ServiceCatalogItem[]>;
  findById(id: string): Promise<ServiceCatalogItem | null>;
  create(input: ServiceCreateRecord): Promise<ServiceCatalogItem>;
  update(id: string, changes: ServiceUpdateRecord): Promise<ServiceCatalogItem | null>;
  softDelete(id: string, actorId: string, at: string): Promise<string | null>;
};
```

- [x] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/lib/services src/app/api/services src/components/services "src/app/(dashboard)/services/page.test.tsx"`

Expected: FAIL because persistent modules and async UI behavior are absent.

- [x] **Step 3: Implement server domain, API client and handlers**

Create `listServices`, `createService`, `updateService` and `deleteService` with optional dependency injection and default `serviceRepository`. Use `requireUser` for GET and `requireManager` for mutations. Translate missing/deleted/duplicate cases to `SERVICE_NOT_FOUND` and `SERVICE_NAME_EXISTS`.

Define the client contract:

```ts
export type ServiceClient = {
  create(input: CreateServiceInput): Promise<ServiceCatalogItem>;
  update(id: string, input: UpdateServiceInput): Promise<ServiceCatalogItem>;
  remove(id: string): Promise<{ id: string }>;
};
```

- [x] **Step 4: Connect `/services` and verify GREEN**

Load authorized data in the Server Component, remove fixture/demo imports, convert dialogs to guarded async saves, preserve drafts on failure, update returned rows only on success and keep existing feedback/layout.

Run: `npm test -- src/lib/services src/app/api/services src/components/services "src/app/(dashboard)/services/page.test.tsx"`

Expected: PASS.

- [x] **Step 5: Commit persistent services**

```bash
git add src/lib/services src/app/api/services "src/app/(dashboard)/services" src/components/services src/types/service-catalog.ts src/data/services.mock.json
git commit -m "feat(services): connect catalog to persistence"
```

### Task 3: Persistent customers and role-aware lifecycle

**Files:**
- Create: `src/lib/customers/schemas.ts`
- Create: `src/lib/customers/contracts.ts`
- Create: `src/lib/customers/repository.ts`
- Create: `src/lib/customers/repository.test.ts`
- Create: `src/lib/customers/service.ts`
- Create: `src/lib/customers/service.test.ts`
- Create: `src/lib/customers/client.ts`
- Create: `src/lib/customers/client.test.ts`
- Create: `src/app/api/customers/route.ts`
- Create: `src/app/api/customers/route.test.ts`
- Create: `src/app/api/customers/[id]/route.ts`
- Create: `src/app/api/customers/[id]/route.test.ts`
- Create: `src/components/customers/customer-delete-dialog.tsx`
- Create: `src/components/customers/customer-delete-dialog.test.tsx`
- Modify: `src/types/customer.ts`
- Modify: `src/lib/customers/customer-catalog.ts`
- Modify: `src/lib/customers/customer-catalog.test.ts`
- Modify: `src/components/customers/customer-editor-dialog.tsx`
- Modify: `src/components/customers/customer-editor-dialog.test.tsx`
- Modify: `src/components/customers/customers-view.tsx`
- Modify: `src/components/customers/customers-view.test.tsx`
- Modify: `src/app/(dashboard)/customers/page.tsx`
- Modify: `src/app/(dashboard)/customers/page.test.tsx`

**Interfaces:**
- Consumes: `CustomerRow`, authenticated session roles and current customer presentation.
- Produces: `CustomerRepository`, reusable async editor and customer API/client for `/incomes/new`.

- [x] **Step 1: Write failing validation, permission and UI tests**

Assert this model and behavior:

```ts
type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  visits: number;
  createdAt: string;
};

expect(customerEditorSchema.parse({
  firstName: " Ana ", lastName: " Pérez ", phone: "+54 351 555 0101", email: "",
})).toMatchObject({ firstName: "Ana", lastName: "Pérez", email: null });
```

Test that employee creation/edit succeeds, employee deletion fails before persistence, manager deletion calls `softDelete`, exact duplicate names are accepted, normalized duplicate phone is rejected, optional duplicate non-null email is rejected, missing email renders no `mailto:` action, and every authenticated role sees create/edit controls while only managers see delete.

- [x] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/lib/customers src/app/api/customers src/components/customers "src/app/(dashboard)/customers/page.test.tsx"`

Expected: FAIL because the persistent modules, optional email and delete flow are absent.

- [x] **Step 3: Implement customer repository, services and handlers**

Define:

```ts
export type CustomerRepository = {
  list(): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  findByNormalizedPhone(phone: string): Promise<Customer | null>;
  create(input: CustomerCreateRecord): Promise<Customer>;
  update(id: string, changes: CustomerUpdateRecord): Promise<Customer | null>;
  softDelete(id: string, actorId: string, at: string): Promise<string | null>;
};
```

GET/POST require any authenticated user; PATCH also requires any authenticated user; DELETE requires a manager. Propagate actor IDs internally, exclude deleted rows and map uniqueness to `CUSTOMER_PHONE_EXISTS` or `CUSTOMER_EMAIL_EXISTS`.

- [x] **Step 4: Implement the reusable async dialog and persistent page**

Change `CustomerEditorDialog.onSave` to return `Promise<Customer>`, require name/last name/phone, make email optional, expose pending/error state and keep the draft open on failure. Add confirmed logical deletion and update `/customers` capability props to `{ canDelete: boolean }` rather than manager-gating all mutations.

Load customers in the Server Component, remove mock/demo usage and preserve filters, metrics, responsive UI and toasts.

- [x] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/lib/customers src/app/api/customers src/components/customers "src/app/(dashboard)/customers/page.test.tsx"`

Expected: PASS.

- [x] **Step 6: Commit persistent customers**

```bash
git add src/lib/customers src/app/api/customers "src/app/(dashboard)/customers" src/components/customers src/types/customer.ts src/data/customers.mock.json
git commit -m "feat(customers): persist customer lifecycle"
```

### Task 4: Income schemas, service and repository

**Files:**
- Create: `src/lib/incomes/contracts.ts`
- Create: `src/lib/incomes/repository.ts`
- Create: `src/lib/incomes/repository.test.ts`
- Create: `src/lib/incomes/service.ts`
- Create: `src/lib/incomes/service.test.ts`
- Modify: `src/lib/incomes/income-schema.ts`
- Modify: `src/lib/incomes/income-schema.test.ts`
- Modify: `src/lib/incomes/income-list.ts`
- Modify: `src/lib/incomes/income-list.test.ts`
- Modify: `src/types/income.ts`

**Interfaces:**
- Consumes: SQL functions, current income presentation types, `SafeUser` and catalog/customer repositories.
- Produces: authoritative create/list/detail/void services for APIs and Server Components.

- [ ] **Step 1: Write failing schema and service tests**

The public create input must be:

```ts
type CreateIncomeInput = {
  requestId: string;
  customerId: string | null;
  serviceId: string | null;
  products: Array<{ productId: string; quantity: number }>;
  paymentMethod: "cash" | "transfer";
};
```

Assert Zod strips/rejects `userId`, `employeeId`, `total`, `createdAt` and `businessDate`; request ID and referenced IDs are UUIDs; an item is required; products are unique and positive; and service passes only the authenticated actor to persistence.

Test manager list scope `{ userId: query.userId ?? null, canViewAll: true }`, employee scope `{ userId: employee.id, canViewAll: false }`, employee detail denial, manager void permission, employee void denial and stable missing/stock errors.

- [ ] **Step 2: Run domain tests and verify RED**

Run: `npm test -- src/lib/incomes/income-schema.test.ts src/lib/incomes/service.test.ts src/lib/incomes/repository.test.ts`

Expected: FAIL because the real contracts and persistence modules are absent.

- [ ] **Step 3: Implement contracts and server service**

Define:

```ts
export type IncomeRepository = {
  create(actorId: string, input: CreateIncomeInput): Promise<Income>;
  list(scope: IncomeScope, query: IncomeListQuery): Promise<PaginatedIncomes>;
  findById(scope: IncomeScope, id: string): Promise<IncomeListItem | null>;
  void(id: string, actorId: string): Promise<IncomeListItem | null>;
};

export const createIncome: (actor: SafeUser, input: CreateIncomeInput, deps?: IncomeDependencies) => Promise<Income>;
export const listIncomes: (actor: SafeUser, query: IncomeListQuery, deps?: IncomeDependencies) => Promise<PaginatedIncomes>;
export const getIncome: (actor: SafeUser, id: string, deps?: IncomeDependencies) => Promise<IncomeListItem>;
export const voidIncome: (actor: SafeUser, id: string, deps?: IncomeDependencies) => Promise<IncomeListItem>;
```

Add role `admin` to presentation types. Remove `employeeId` from form values. Add `businessDate`, pagination and filtered metrics DTOs.

- [ ] **Step 4: Implement the Supabase repository**

Call `create_income`, `list_incomes`, `get_income_detail` and `void_income` with exact snake_case parameters. Treat RPC JSON as unknown, validate it with strict Zod response schemas, and map `INSUFFICIENT_STOCK`, unavailable catalog/customer, missing income and uniqueness sentinels to public `AppError`s.

- [ ] **Step 5: Run domain tests and verify GREEN**

Run: `npm test -- src/lib/incomes/income-schema.test.ts src/lib/incomes/service.test.ts src/lib/incomes/repository.test.ts src/lib/incomes/income-list.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the income domain**

```bash
git add src/lib/incomes src/types/income.ts
git commit -m "feat(incomes): add transactional income domain"
```

### Task 5: Authenticated income APIs

**Files:**
- Create: `src/app/api/incomes/route.ts`
- Create: `src/app/api/incomes/route.test.ts`
- Create: `src/app/api/incomes/[id]/route.ts`
- Create: `src/app/api/incomes/[id]/route.test.ts`
- Create: `src/app/api/incomes/[id]/void/route.ts`
- Create: `src/app/api/incomes/[id]/void/route.test.ts`
- Create: `src/lib/incomes/client.ts`
- Create: `src/lib/incomes/client.test.ts`

**Interfaces:**
- Consumes: Task 4 schemas/services and current-session authorization.
- Produces: create/list/detail/void HTTP contracts and a browser-safe client.

- [ ] **Step 1: Write failing API and client tests**

Assert GET parses search params and calls `listIncomes(user, query)`, POST parses only public create fields and returns 201, detail awaits promised params, void uses `requireManager`, and all errors use the shared response envelope.

Test client methods:

```ts
export type IncomeClient = {
  create(input: CreateIncomeInput): Promise<Income>;
  list(query: IncomeListQuery): Promise<PaginatedIncomes>;
  get(id: string): Promise<IncomeListItem>;
  void(id: string): Promise<IncomeListItem>;
};
```

- [ ] **Step 2: Run API tests and verify RED**

Run: `npm test -- src/app/api/incomes src/lib/incomes/client.test.ts`

Expected: FAIL because handlers/client do not exist.

- [ ] **Step 3: Implement thin handlers and fetch client**

Use `requireUser` for GET/POST/detail and `requireManager` for void. Route bodies contain no user/total/date overrides. The client sends `cache: "no-store"` for mutable authenticated collections and maps structured errors without exposing server internals.

- [ ] **Step 4: Run API tests and verify GREEN**

Run: `npm test -- src/app/api/incomes src/lib/incomes/client.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit income APIs**

```bash
git add src/app/api/incomes src/lib/incomes/client.ts src/lib/incomes/client.test.ts
git commit -m "feat(incomes): expose role-scoped income API"
```

### Task 6: Real income form and inline customer creation

**Files:**
- Modify: `src/app/(dashboard)/incomes/new/page.tsx`
- Modify: `src/app/(dashboard)/incomes/new/page.test.tsx`
- Modify: `src/components/incomes/income-form.tsx`
- Modify: `src/components/incomes/income-form.test.tsx`
- Modify: `src/components/incomes/customer-selector.tsx`
- Modify: `src/components/incomes/customer-selector.test.tsx`
- Modify: `src/components/incomes/income-summary.tsx`
- Modify: `src/components/incomes/income-summary.test.tsx`
- Modify: `src/components/incomes/income-confirmation-dialog.tsx`
- Modify: `src/components/incomes/income-confirmation-dialog.test.tsx`
- Modify: `src/types/income.ts`

**Interfaces:**
- Consumes: income/customer clients and persistent active catalogs.
- Produces: authenticated sale submission with reusable inline customer creation.

- [ ] **Step 1: Write failing form and selector tests**

Cover:

- The current user is displayed but no user selector exists for any role.
- Submission sends a generated UUID `requestId` and no actor, total or timestamp.
- Repeated confirm clicks reuse the same request ID until success/failure resolution.
- Customer search matches name and normalized phone.
- `Crear cliente` opens `CustomerEditorDialog` when no suitable result exists.
- Successful customer creation appends/selects the customer.
- Duplicate phone keeps the draft and offers the matching existing customer.
- Active services/products only are selectable.
- Insufficient-stock and general failures preserve the sale draft.

- [ ] **Step 2: Run focused form tests and verify RED**

Run: `npm test -- src/components/incomes "src/app/(dashboard)/incomes/new/page.test.tsx"`

Expected: FAIL because the mock service, user selector and select-only customer flow remain.

- [ ] **Step 3: Load real form data on the server**

After `requirePageUser()`, start active service, product and customer reads in parallel with `Promise.all`. Map `SafeUser` to the serializable current-user presentation and remove `income-form.mock.json` plus the demonstration badge.

- [ ] **Step 4: Integrate async income and customer clients**

Use the shared customer dialog directly from the selector. Keep a stable request ID in a ref for the current submission; generate a new UUID only after successful sale/reset. The backend response total replaces the preview total in the success state.

Remove `createMockIncomeService`, `employeeId` and manager-on-behalf behavior. Keep the confirmation/pending/success/error interaction design.

- [ ] **Step 5: Run form tests and verify GREEN**

Run: `npm test -- src/components/incomes "src/app/(dashboard)/incomes/new/page.test.tsx"`

Expected: PASS.

- [ ] **Step 6: Commit the real sale form**

```bash
git add "src/app/(dashboard)/incomes/new" src/components/incomes src/types/income.ts src/data/income-form.mock.json src/lib/incomes/mock-income-service.ts src/lib/incomes/mock-income-service.test.ts
git commit -m "feat(incomes): connect sale form to persistence"
```

### Task 7: Server-filtered income history and manager voiding

**Files:**
- Create: `src/components/incomes/income-void-dialog.tsx`
- Create: `src/components/incomes/income-void-dialog.test.tsx`
- Modify: `src/app/(dashboard)/incomes/page.tsx`
- Modify: `src/app/(dashboard)/incomes/page.test.tsx`
- Modify: `src/components/incomes/incomes-view.tsx`
- Modify: `src/components/incomes/incomes-view.test.tsx`
- Modify: `src/components/incomes/income-filters.tsx`
- Modify: `src/components/incomes/income-filters.test.tsx`
- Modify: `src/components/incomes/income-detail-sheet.tsx`
- Modify: `src/components/incomes/income-detail-sheet.test.tsx`
- Modify: `src/components/incomes/income-metrics.tsx`
- Modify: income table/mobile list tests if DTO pagination changes affect fixtures.

**Interfaces:**
- Consumes: `IncomeClient.list/void`, paginated response and role capabilities.
- Produces: authorized server-filtered history with idempotent manager voiding.

- [ ] **Step 1: Write failing history tests**

Assert:

- Initial query uses current Buenos Aires month and page size 10.
- Filter/page changes call `client.list` and render returned metrics/page metadata.
- Owner and admin see the registering-user filter; employee does not.
- Employee data is never filtered for security in browser utilities.
- Manager detail enables a confirmed void action.
- Employee detail has no void action.
- Successful void replaces the row, updates metrics from a refetch and shows feedback.
- Failed void preserves the open detail and exposes a retryable error.
- Voided rows cannot restore stock twice through repeated UI actions.

- [ ] **Step 2: Run history tests and verify RED**

Run: `npm test -- src/components/incomes/incomes-view.test.tsx src/components/incomes/income-filters.test.tsx src/components/incomes/income-detail-sheet.test.tsx "src/app/(dashboard)/incomes/page.test.tsx"`

Expected: FAIL because history still uses a fixture and local pagination/filtering.

- [ ] **Step 3: Implement server-backed history state**

The Server Component loads the first `PaginatedIncomes` page after authorization. `IncomesView` owns query state, uses the client for subsequent changes, ignores stale responses, renders loading/error/no-results states and receives `canViewAll`/`canVoid` capabilities from the server.

Use `Intl.DateTimeFormat` with `timeZone: "America/Argentina/Buenos_Aires"` for month and timestamps. Remove the fixed August label, `incomes.mock.json` and `authorizeIncomeListData` security simulation.

- [ ] **Step 4: Implement confirmed manager voiding**

Add a focused confirmation dialog. On success, close confirmation, keep/open updated detail as appropriate, refetch the current query, and show the shared toast. Keep edit unavailable. Never show void controls to employees.

- [ ] **Step 5: Run history tests and verify GREEN**

Run: `npm test -- src/components/incomes "src/app/(dashboard)/incomes/page.test.tsx"`

Expected: PASS.

- [ ] **Step 6: Commit persistent income history**

```bash
git add "src/app/(dashboard)/incomes" src/components/incomes src/data/incomes.mock.json src/data/incomes.mock.test.ts src/lib/incomes/income-list.ts src/lib/incomes/income-list.test.ts
git commit -m "feat(incomes): persist history and voiding"
```

### Task 8: Commercial-domain documentation and full verification

**Files:**
- Modify: `context_snapshot.md`
- Modify: `product.md`
- Modify: `AGENTS.md` only if implementation introduces a durable invariant not already documented.

**Interfaces:**
- Consumes: all services/customers/incomes deliverables.
- Produces: accurate project state, external SQL instructions and a clean verified branch.

- [ ] **Step 1: Run focused domain verification**

Run: `npm test -- src/lib/services src/lib/customers src/lib/incomes src/app/api/services src/app/api/customers src/app/api/incomes src/components/services src/components/customers src/components/incomes`

Expected: PASS.

- [ ] **Step 2: Run the complete verification suite**

Run: `npm test`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 3: Update durable documentation**

Record persistent module behavior, exact role permissions, logical deletion, phone identity, idempotency, atomic stock/visit behavior, Buenos Aires business dates, verification results and the unapplied remote SQL actions. Set the recommended next task to applying/verifying `008` and `009`, then designing daily cash without claiming deployment occurred.

- [ ] **Step 4: Commit the verified sales milestone**

```bash
git add context_snapshot.md product.md AGENTS.md
git commit -m "docs(sales): record persistent commercial domain"
```

- [ ] **Step 5: Verify clean handoff state**

Run: `git status --short --branch`

Expected: branch `feat/backend-models` with no modified or untracked files.
