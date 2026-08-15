# Customer Visits and Fixed Schedules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show sanitized sale-backed customer visit history, persist one weekly fixed schedule per customer, audit attendance occurrences and replace the dashboard fixture with live authorized data.

**Architecture:** Add migration `011` after the income V2 migration, with transactional customer/schedule RPCs and idempotent occurrence generation in Buenos Aires time. Keep visit history as a sanitized projection over active incomes/items, expose focused authenticated endpoints, and connect the existing customer editor and dashboard card without introducing a scheduler or a dedicated fixed-customer page.

**Tech Stack:** Next.js 16.3 Route Handlers, React 19.2, strict TypeScript, Zod 4, Supabase PostgreSQL RPC, Vitest, Testing Library and Sonner.

## Global Constraints

- Execute this plan after the income attribution plan because visit history reads the V2 income schema and ordered SQL requires `010` before `011`.
- Use Node 24.18.x and npm 11.16.x for final verification.
- Use ISO weekday `1..7`, local `HH:mm` and `America/Argentina/Buenos_Aires` for every occurrence date.
- A customer has zero or one active weekly schedule.
- Attendance never creates an income, payment, commission, stock movement or customer visit.
- All authenticated roles may create/edit schedules and resolve pending attendance; customer deletion remains manager-only.
- Visit history exposes item names/quantities and dates, but no prices, totals, payments, commissions or user identities.
- Create SQL and tests locally; do not apply migration `011` to shared Supabase without separate explicit authorization.

## File Structure

- `supabase/queries/011_customer_visits_and_fixed_schedules.sql`: schedules, occurrences, generation, customer mutation, visit projection, security and grants.
- `src/types/{customer,fixed-customer}.ts`: persistent schedule, occurrence and paginated visit contracts.
- `src/lib/customers/{schemas,contracts,repository,service,client}.ts`: customer/schedule persistence and visit history.
- `src/lib/fixed-customers/{schemas,contracts,repository,service,client}.ts`: focused occurrence domain.
- `src/app/api/customers/[id]/visits/route.ts`: sanitized visit history endpoint.
- `src/app/api/fixed-customer-occurrences/**`: occurrence list and resolution endpoints.
- `src/components/customers/customer-visits-dialog.tsx`: paginated visit detail.
- `src/components/dashboard/fixed-customers-card.tsx` and home page: live occurrence presentation.
- `supabase/queries/README.md`, `AGENTS.md`, `product.md`, `context_snapshot.md`: installation and durable state.

---

### Task 1: Define canonical customer schedule, visit and occurrence contracts

**Files:**
- Modify: `src/types/customer.ts`
- Modify: `src/types/fixed-customer.ts`
- Modify: `src/lib/customers/schemas.ts`
- Modify: `src/lib/customers/frontend-customer-contracts.ts`
- Create: `src/lib/fixed-customers/schemas.ts`
- Test: `src/lib/customers/service.test.ts`
- Test: `src/lib/customers/frontend-customer-contracts.test.ts`
- Test: `src/lib/fixed-customers/schemas.test.ts`

**Interfaces:**
- Produces `FixedSchedule`, `CustomerVisit`, `PaginatedCustomerVisits`, `FixedCustomerOccurrence` and query/input schemas.
- Produces create customer input requiring `fixedSchedule: FixedSchedule | null`; update accepts optional `fixedSchedule` where explicit `null` disables it.

- [ ] **Step 1: Write failing boundary tests**

Cover valid/invalid ISO days, strict `HH:mm`, explicit `null`, omitted update schedule, visit pagination limits, date ranges and strict attendance bodies.

```ts
expect(createCustomerSchema.parse({
  firstName: "Juan", lastName: "Cruz", phone: "3515550101", email: null,
  fixedSchedule: { weekday: 4, time: "10:00" },
}).fixedSchedule).toEqual({ weekday: 4, time: "10:00" });

expect(resolveOccurrenceSchema.safeParse({
  status: "attended", expectedStatus: "pending", customerId: crypto.randomUUID(),
}).success).toBe(false);
```

- [ ] **Step 2: Run focused tests and confirm server contracts are missing**

Run: `npm test -- src/lib/customers/frontend-customer-contracts.test.ts src/lib/customers/service.test.ts src/lib/fixed-customers/schemas.test.ts`

Expected: FAIL because fixed schedules exist only in a frontend wrapper and the occurrence domain does not exist.

- [ ] **Step 3: Move the schedule schema into the server customer boundary**

Implement:

```ts
export const fixedScheduleSchema = z.object({
  weekday: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
}).strict();

export const createCustomerSchema = customerFieldsSchema.extend({
  fixedSchedule: fixedScheduleSchema.nullable().default(null),
}).strict();
```

Extend update with `fixedSchedule: fixedScheduleSchema.nullable().optional()` before the at-least-one-change refinement. Make the frontend schema reuse this contract rather than extending a different shape.

- [ ] **Step 4: Add visit and occurrence types/schemas**

Define:

```ts
export type CustomerVisit = {
  id: string;
  occurredAt: string;
  businessDate: string;
  items: Array<{ type: "service" | "product"; name: string; quantity: number }>;
};

export const fixedOccurrenceQuerySchema = z.object({
  dateFrom: z.iso.date(),
  dateTo: z.iso.date(),
  status: z.enum(["pending", "attended", "missed"]).optional(),
}).strict().refine(({ dateFrom, dateTo }) => dateFrom <= dateTo, { path: ["dateTo"] });
```

Add `customerVisitQuerySchema` with coerced `page` default `1` and `pageSize` default `20`, maximum `100`.

- [ ] **Step 5: Run focused contract tests**

Run: `npm test -- src/lib/customers/frontend-customer-contracts.test.ts src/lib/customers/service.test.ts src/lib/fixed-customers/schemas.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit canonical contracts**

```bash
git add src/types/customer.ts src/types/fixed-customer.ts src/lib/customers src/lib/fixed-customers
git commit -m "feat(customers): define fixed schedule contracts"
```

### Task 2: Add migration 011 with schedules, occurrences and sanitized visit projection

**Files:**
- Create: `supabase/queries/011_customer_visits_and_fixed_schedules.sql`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `supabase/queries/README.md`

**Interfaces:**
- Produces tables `customer_fixed_schedules` and `fixed_customer_occurrences`.
- Produces RPCs `create_customer_v2`, `update_customer_v2`, `list_customer_visits`, `list_fixed_customer_occurrences`, `resolve_fixed_customer_occurrence`.
- Produces internal function `ensure_fixed_customer_occurrences(date, date)`.

- [ ] **Step 1: Record executable post-install behavior checks before writing SQL**

Add SQL Editor verification queries to `supabase/queries/README.md` for one-schedule uniqueness, RLS/grants, occurrence uniqueness, routine availability and a transaction-wrapped generation sample that rolls back. These deployment checks exercise PostgreSQL; do not add tests that merely search SQL source text.

- [ ] **Step 2: Create tables, checks, indexes, RLS and audit fields**

Use the approved schema:

```sql
create table public.customer_fixed_schedules (
  customer_id uuid primary key references public.customers(id) on delete restrict,
  weekday smallint not null check (weekday between 1 and 7),
  local_time time not null,
  is_active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Create occurrences with schedule/customer references, version, `occurrence_date`, `scheduled_time`, constrained status, nullable status actor/time, unique schedule-version-date and chronological indexes. Enable RLS on both tables without browser policies.

- [ ] **Step 3: Implement idempotent occurrence generation and schedule synchronization**

`ensure_fixed_customer_occurrences(date_from, date_to)` calculates each active schedule's matching ISO weekday in Buenos Aires and inserts with `on conflict do nothing`. Reject inverted ranges and ranges over 70 days.

An internal `sync_customer_fixed_schedule(customer_id, actor_id, fixed_schedule jsonb, business_date date)` must:

- Insert version `1` and generate through `business_date + 56` days for a new schedule.
- Increment version on day/time change, delete only old-version future pending rows with `occurrence_date > business_date`, and generate the new version.
- On `null`, set inactive and delete only future pending rows.
- Preserve current-day, attended and missed rows.

- [ ] **Step 4: Implement transactional customer mutation and read RPCs**

`create_customer_v2` inserts customer plus schedule in one function. `update_customer_v2` locks the non-deleted customer, updates only fields whose `set_*` flags are true, and calls schedule synchronization only when `set_fixed_schedule` is true.

`list_customer_visits` validates the actor/customer, reads only active incomes and their `income_items`, returns newest-first items and pagination, and never selects monetary or user fields.

`list_fixed_customer_occurrences` validates the actor and bounded range, calls the ensure function, excludes deleted customers, applies optional status and returns ordered safe customer identity/date/time/status JSON.

`resolve_fixed_customer_occurrence` updates only when current status equals `expected_status = 'pending'`, writes actor/time and otherwise raises `FIXED_OCCURRENCE_ALREADY_RESOLVED`.

- [ ] **Step 5: Finish grants, database types and local contract verification**

Revoke tables/functions from `public`, `anon`, `authenticated`; grant table access and function execution only to `service_role`. Add `CustomerFixedScheduleRow` and `FixedCustomerOccurrenceRow`. Document install order and queries checking RLS, one-schedule uniqueness and available routines.

Repository RED/GREEN tests in Tasks 3, 4 and 6 prove the exact RPC names, arguments, output validation and error mappings. For this SQL-only step run: `git diff --check`.

Expected: no whitespace errors. Database behavior remains pending manual installation and the README SQL Editor checks.

- [ ] **Step 6: Commit migration 011**

```bash
git add supabase/queries/011_customer_visits_and_fixed_schedules.sql supabase/queries/README.md src/lib/supabase/database.types.ts
git commit -m "feat(customers): add fixed schedule migration"
```

### Task 3: Persist schedules through the customer API

**Files:**
- Modify: `src/lib/customers/contracts.ts`
- Modify: `src/lib/customers/repository.ts`
- Modify: `src/lib/customers/service.ts`
- Modify: `src/lib/customers/client.ts`
- Modify: `src/app/api/customers/route.ts`
- Modify: `src/app/api/customers/[id]/route.ts`
- Modify: `src/components/customers/customers-view.tsx`
- Modify: `src/components/customers/customer-editor-dialog.tsx`
- Test: corresponding customer repository/service/client/route/view tests.

**Interfaces:**
- Consumes: `create_customer_v2` and `update_customer_v2` from Task 2.
- Produces: customer responses always containing `fixedSchedule: FixedSchedule | null`.

- [ ] **Step 1: Write failing RPC and API tests**

Assert create sends schedule JSON, update distinguishes omitted schedule from explicit `null`, list maps schedule joins, and strict handlers reject extra fields.

```ts
expect(rpc).toHaveBeenCalledWith("update_customer_v2", expect.objectContaining({
  target_customer_id: customer.id,
  actor_user_id: employee.id,
  set_fixed_schedule: true,
  new_fixed_schedule: null,
}));
```

- [ ] **Step 2: Run focused customer tests**

Run: `npm test -- src/lib/customers src/app/api/customers src/components/customers/customer-editor-dialog.test.tsx src/components/customers/customers-view.test.tsx`

Expected: FAIL because the backend strips or rejects `fixedSchedule`.

- [ ] **Step 3: Replace direct create/update with transactional RPCs**

Change repository `create` and `update` to call the V2 functions. Pass explicit flags for every optional update property. Extend list/find selects with `fixedSchedule:customer_fixed_schedules(weekday,local_time,is_active)` and map inactive/missing schedules to `null`.

- [ ] **Step 4: Remove frontend pending fallbacks**

Delete `withoutEmptyFixedSchedule`, `explainPendingSchedule` and conditional payload stripping. `customerClient.create` always sends `fixedSchedule`; update sends `fixedSchedule` only when the editor included the field. Simplify `CustomersView.save` to pass the validated input directly.

Keep the schedule controls in the shared create/edit dialog, but use the exact question `¿Es cliente habitual?`. When selected, require weekday and time and render the existing readable weekly summary; when cleared, submit `fixedSchedule: null`.

- [ ] **Step 5: Map database sentinels safely**

Map invalid schedule to HTTP 400 `FIXED_SCHEDULE_INVALID`, concurrent schedule mutation to HTTP 409 `FIXED_SCHEDULE_CONFLICT`, and missing customer to HTTP 404. Preserve phone/email uniqueness messages.

- [ ] **Step 6: Run focused customer persistence tests**

Run: `npm test -- src/lib/customers src/app/api/customers src/components/customers/customer-editor-dialog.test.tsx src/components/customers/customers-view.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit schedule persistence**

```bash
git add src/lib/customers src/app/api/customers src/components/customers src/types/customer.ts src/types/fixed-customer.ts
git commit -m "feat(customers): persist weekly schedules"
```

### Task 4: Expose sanitized paginated customer visit history

**Files:**
- Modify: `src/lib/customers/contracts.ts`
- Modify: `src/lib/customers/repository.ts`
- Modify: `src/lib/customers/service.ts`
- Modify: `src/lib/customers/client.ts`
- Create: `src/app/api/customers/[id]/visits/route.ts`
- Create: `src/app/api/customers/[id]/visits/route.test.ts`
- Test: `src/lib/customers/repository.test.ts`
- Test: `src/lib/customers/service.test.ts`
- Test: `src/lib/customers/client.test.ts`

**Interfaces:**
- Produces `CustomerRepository.listVisits(actorId, customerId, query): Promise<PaginatedCustomerVisits>`.
- Produces `customerClient.listVisits(customerId, query, signal?)`.

- [ ] **Step 1: Write failing domain, repository and endpoint tests**

Assert all authenticated roles may read, invalid UUID/pagination returns 400, missing customer returns 404, RPC parameters are exact, and responses contain no `total`, `payment`, `commission`, `employee` or `registeredBy` keys.

- [ ] **Step 2: Run focused visit tests**

Run: `npm test -- src/lib/customers src/app/api/customers/[id]/visits/route.test.ts`

Expected: FAIL because the repository method and route do not exist.

- [ ] **Step 3: Implement repository/service mapping**

Validate RPC output with a strict Zod schema:

```ts
const customerVisitSchema = z.object({
  id: z.uuid(),
  occurredAt: z.iso.datetime({ offset: true }),
  businessDate: z.iso.date(),
  items: z.array(z.object({
    type: z.enum(["service", "product"]),
    name: z.string().min(1),
    quantity: z.number().int().positive(),
  }).strict()).min(1),
}).strict();
```

Service calls `requireUser` upstream and translates null/missing results to `CUSTOMER_NOT_FOUND`.

- [ ] **Step 4: Add the nested Route Handler and browser client**

The route awaits Next.js 16 async params, parses the customer ID and URL query, and returns `successResponse`. The client URL-encodes the ID and uses `URLSearchParams({ page, pageSize })` with `cache: "no-store"`.

- [ ] **Step 5: Run focused visit tests**

Run: `npm test -- src/lib/customers src/app/api/customers/[id]/visits/route.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the visit API**

```bash
git add src/lib/customers src/app/api/customers/[id]/visits src/types/customer.ts
git commit -m "feat(customers): expose sanitized visit history"
```

### Task 5: Add the visits dialog to desktop and mobile customer lists

**Files:**
- Create: `src/components/customers/customer-visits-dialog.tsx`
- Create: `src/components/customers/customer-visits-dialog.test.tsx`
- Modify: `src/components/customers/customers-view.tsx`
- Modify: `src/components/customers/customers-view.test.tsx`

**Interfaces:**
- Consumes: `customerClient.listVisits` from Task 4.
- Produces: clickable `X visita(s)` controls and a paginated responsive dialog.

- [ ] **Step 1: Write failing interaction tests**

Cover desktop and mobile buttons, initial loading, service/product quantities, empty, API error/retry, previous/next pagination and reset to page one after reopening another customer.

```ts
await user.click(screen.getAllByRole("button", { name: "Ver 3 visitas de Ana Pérez" })[0]);
expect(await screen.findByText("Corte clásico")).toBeVisible();
expect(screen.getByText("2 × Cera mate")).toBeVisible();
```

- [ ] **Step 2: Run focused component tests**

Run: `npm test -- src/components/customers/customer-visits-dialog.test.tsx src/components/customers/customers-view.test.tsx`

Expected: FAIL because visit counts are plain text.

- [ ] **Step 3: Implement the dialog state machine**

On open, create an `AbortController`, load page 1 and preserve the selected customer identity. On page change, retain the dialog shell and show a local loading state. Abort on close/unmount. Render dates in Buenos Aires and group each visit's item snapshots without monetary information.

- [ ] **Step 4: Replace both visit labels with accessible buttons**

Use the exact label `Ver {count} visita(s) de {fullName}` in desktop and mobile. Disable the control when count is zero but keep it focus-safe through native button semantics. Pass the selected customer to one dialog instance at the bottom of `CustomersView`.

- [ ] **Step 5: Run focused customer UI tests**

Run: `npm test -- src/components/customers/customer-visits-dialog.test.tsx src/components/customers/customers-view.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit visit presentation**

```bash
git add src/components/customers
git commit -m "feat(customers): show visit detail dialog"
```

### Task 6: Implement the fixed-occurrence server domain and APIs

**Files:**
- Create: `src/lib/fixed-customers/contracts.ts`
- Create: `src/lib/fixed-customers/repository.ts`
- Create: `src/lib/fixed-customers/service.ts`
- Create: `src/lib/fixed-customers/client.ts`
- Create: `src/app/api/fixed-customer-occurrences/route.ts`
- Create: `src/app/api/fixed-customer-occurrences/route.test.ts`
- Create: `src/app/api/fixed-customer-occurrences/[id]/status/route.ts`
- Create: `src/app/api/fixed-customer-occurrences/[id]/status/route.test.ts`
- Test: new repository/service/client tests.

**Interfaces:**
- Produces `listFixedOccurrences(actor, query)` and `resolveFixedOccurrence(actor, id, input)`.
- Produces browser client `list(query)` and `resolve(id, input)`.

- [ ] **Step 1: Write failing repository/service/route tests**

Assert exact RPC calls, safe output parsing, all authenticated role access, actor omission from JSON, missing occurrence 404 and resolved conflict 409.

- [ ] **Step 2: Run focused occurrence tests**

Run: `npm test -- src/lib/fixed-customers src/app/api/fixed-customer-occurrences`

Expected: FAIL because the domain and endpoints do not exist.

- [ ] **Step 3: Implement repository output validation and error mapping**

Map `FIXED_OCCURRENCE_NOT_FOUND` to 404 and `FIXED_OCCURRENCE_ALREADY_RESOLVED` to 409. Log other database failures through the existing sanitized pattern. Never pass customer/date/time/actor from resolution JSON.

- [ ] **Step 4: Implement services and Route Handlers**

Handlers call `requireUser`, parse async params and strict schemas, and return safe occurrence objects. The PATCH body accepted by the service is exactly:

```ts
type ResolveFixedOccurrenceInput = {
  status: "attended" | "missed";
  expectedStatus: "pending";
};
```

- [ ] **Step 5: Implement and test the browser client**

Use `cache: "no-store"` for lists and JSON PATCH for resolution. Reuse an exported `FixedCustomerApiError` so the dashboard can display the public message.

- [ ] **Step 6: Run focused occurrence tests**

Run: `npm test -- src/lib/fixed-customers src/app/api/fixed-customer-occurrences`

Expected: PASS.

- [ ] **Step 7: Commit occurrence APIs**

```bash
git add src/lib/fixed-customers src/app/api/fixed-customer-occurrences src/types/fixed-customer.ts
git commit -m "feat(customers): expose fixed occurrence attendance"
```

### Task 7: Replace the dashboard fixture with live occurrences

**Files:**
- Modify: `src/app/(dashboard)/(home)/page.tsx`
- Modify: `src/app/(dashboard)/(home)/page.test.tsx`
- Modify: `src/components/dashboard/fixed-customers-card.tsx`
- Modify: `src/components/dashboard/fixed-customers-card.test.tsx`
- Delete: `src/data/fixed-customers.mock.json`
- Modify: `src/lib/customers/fixed-customers.ts`

**Interfaces:**
- Consumes: server service and browser client from Task 6.
- Produces live dashboard occurrence list and persistent status transitions.

- [ ] **Step 1: Write failing live dashboard tests**

Assert the home page calls the server occurrence service for today through today plus 56 days, no demo badge appears, the fixture is unused, resolve buttons disable during PATCH, success persists and error restores pending state with a toast.

- [ ] **Step 2: Run focused dashboard tests**

Run: `npm test -- "src/app/(dashboard)/(home)/page.test.tsx" src/components/dashboard/fixed-customers-card.test.tsx`

Expected: FAIL because the page imports the fixture and status is only local.

- [ ] **Step 3: Load occurrences with income summary in parallel**

After `requirePageUser`, compute the Buenos Aires range and request both income pages and fixed occurrences. The fixed date range starts at today's business date and ends 56 days later. Pass the safe array directly to `FixedCustomersCard`; remove mock mapping and the demo badge.

- [ ] **Step 4: Persist attendance with rollback on failure**

Track one `pendingId`. On click, disable both actions for that occurrence, call:

```ts
await fixedCustomerClient.resolve(id, {
  status,
  expectedStatus: "pending",
});
```

Replace the occurrence with the returned server value only on success. On error keep `pending`, show `toast.error(error.message)`, and re-enable actions.

- [ ] **Step 5: Remove fixture-only behavior and fix navigation**

Delete the JSON fixture and `buildUpcomingFixedOccurrences` if no production caller remains. Until `/customers/fixed` exists, make `Ver todos` link to `/customers` with copy `Gestionar clientes fijos`.

- [ ] **Step 6: Run focused dashboard tests**

Run: `npm test -- "src/app/(dashboard)/(home)/page.test.tsx" src/components/dashboard/fixed-customers-card.test.tsx src/lib/customers/fixed-customers.test.ts`

Expected: PASS; delete the helper test if its production helper was removed.

- [ ] **Step 7: Commit live dashboard integration**

```bash
git add "src/app/(dashboard)/(home)" src/components/dashboard src/lib/customers/fixed-customers.ts src/data/fixed-customers.mock.json
git commit -m "feat(dashboard): load fixed customers from persistence"
```

### Task 8: Verify the customer increment and update durable documentation

**Files:**
- Modify: `AGENTS.md`
- Modify: `product.md`
- Modify: `context_snapshot.md`
- Modify: `supabase/queries/README.md`

**Interfaces:**
- Consumes: Tasks 1-7.
- Produces: a documented increment ready for manual migration review/application.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 2: Run lint, build and whitespace checks**

Run: `npm run lint`

Expected: exit 0 without warnings.

Run: `npm run build`

Expected: production build succeeds.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Confirm fixture and pending-contract removal**

Run: `rg -n "fixed-customers.mock|FIXED_SCHEDULE_BACKEND_PENDING|Pendiente de backend" src`

Expected: no fixed-customer fixture or pending schedule fallback remains. Any remaining income legacy copy must be intentional and covered by a legacy presentation test.

- [ ] **Step 4: Update project state**

Record one weekly schedule per customer, audited occurrences, attendance independence from sales and sanitized active-sale visit history in `AGENTS.md`. Mark the local application increment complete and migration `011` pending manual installation in `product.md` and `context_snapshot.md` unless separately applied and verified.

- [ ] **Step 5: Commit documentation**

```bash
git add AGENTS.md product.md context_snapshot.md supabase/queries/README.md
git commit -m "docs(customers): record fixed schedule increment"
```

- [ ] **Step 6: Report the deployment gate**

Report migration order `010` then `011`, focused/full verification output and commit range. Do not claim live schedules, visits or attendance until both SQL scripts have been manually applied and their README verification queries have passed.
