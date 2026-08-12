# Dashboard Recent Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the latest persisted, role-scoped income and latest non-deleted customer in the dashboard activity card while leaving expense activity mocked.

**Architecture:** Add one focused latest-customer repository method and expose it through the existing customer service. Keep display transformation in a pure dashboard helper, then have the authenticated Server Component load income and customer data in parallel and replace only the matching fixture entries.

**Tech Stack:** Next.js 16 Server Components, React 19, TypeScript strict mode, Supabase PostgreSQL, Vitest, Testing Library.

## Global Constraints

- All database access remains server-only through `SUPABASE_SECRET_KEY`.
- Income activity must preserve owner/admin global visibility and employee self-only visibility through `listIncomes`.
- Customer activity excludes logically deleted records.
- Expense activity remains sourced from `dashboard.mock.json`.
- No SQL or schema change is required.

---

### Task 1: Latest customer persistence boundary

**Files:**
- Modify: `src/lib/customers/contracts.ts`
- Modify: `src/lib/customers/repository.ts`
- Modify: `src/lib/customers/repository.test.ts`
- Modify: `src/lib/customers/service.ts`
- Modify: `src/lib/customers/service.test.ts`

**Interfaces:**
- Produces: `CustomerRepository.latest(): Promise<Customer | null>`.
- Produces: `getLatestCustomer(actor: SafeUser, dependencies?: CustomerServiceDependencies): Promise<Customer | null>`.

- [ ] **Step 1: Write the failing repository and service tests**

Add a repository test whose Supabase double supports `select`, `is`, `order`, `limit` and `maybeSingle`, returns the complete customer row, and asserts the observable result equals `toCustomer(row)`. Verify the boundary arguments exactly:

```ts
expect(query.is).toHaveBeenCalledWith("deleted_at", null);
expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
expect(query.limit).toHaveBeenCalledWith(1);
```

Add `latest: vi.fn().mockResolvedValue(customer)` to the service dependency and verify:

```ts
await expect(getLatestCustomer(employee, dependencies)).resolves.toEqual(customer);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/lib/customers/repository.test.ts src/lib/customers/service.test.ts`

Expected: FAIL because `latest` and `getLatestCustomer` do not exist.

- [ ] **Step 3: Implement the minimal latest-customer read**

Extend `CustomerRepository`, add `latest()` to `customerRepository`, and map a nullable row:

```ts
const { data, error } = await getSupabaseAdmin()
  .from("customers")
  .select(CUSTOMER_SELECT)
  .is("deleted_at", null)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (error) databaseFailure("latest customer", error);
return data ? toCustomer(data as unknown as CustomerRow) : null;
```

Expose it through the service without changing permissions:

```ts
export const getLatestCustomer = async (
  _actor: SafeUser,
  dependencies: CustomerServiceDependencies = defaults,
) => dependencies.customers.latest();
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- src/lib/customers/repository.test.ts src/lib/customers/service.test.ts`

Expected: both files pass with no warnings.

- [ ] **Step 5: Commit the persistence increment**

```bash
git add src/lib/customers/contracts.ts src/lib/customers/repository.ts src/lib/customers/repository.test.ts src/lib/customers/service.ts src/lib/customers/service.test.ts
git commit -m "feat(customers): expose latest customer"
```

### Task 2: Pure recent-activity presentation

**Files:**
- Create: `src/lib/dashboard/recent-activity.ts`
- Create: `src/lib/dashboard/recent-activity.test.ts`

**Interfaces:**
- Consumes: `IncomeListItem`, `Customer`, and the existing `formatArs` formatter.
- Produces: `RecentActivityItem` with fixture-compatible `id`, `type`, `title`, `description`, and `time` fields.
- Produces: `buildIncomeActivity(income: IncomeListItem | null, now?: Date): RecentActivityItem`.
- Produces: `buildCustomerActivity(customer: Customer | null, now?: Date): RecentActivityItem`.

- [ ] **Step 1: Write failing behavior tests for real and empty records**

Use complete hand-checked fixtures. Assert that a combined sale becomes:

```ts
expect(buildIncomeActivity(income, now)).toEqual({
  id: income.id,
  type: "income",
  title: "Ingreso registrado",
  description: "Barba + Gel x2 · $ 15.000",
  time: "Hace 12 min",
});
```

Assert the latest customer becomes `Ana Pérez fue agregado a clientes`, an hour-old record becomes `Hace 1 h`, and null inputs contain honest `Todavía no se registraron...` descriptions rather than fixture names.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/dashboard/recent-activity.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement deterministic builders**

Create a private relative-time formatter using `createdAt` and the injected `now`. Use `Ahora` for less than one minute, minutes below 60, hours below 24, and `Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" })` afterwards.

Build the income line from the optional service plus every product snapshot; append `xN` when quantity exceeds one and append `formatArs(income.total)`. Return honest empty-state entries for null records.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/lib/dashboard/recent-activity.test.ts`

Expected: all builder cases pass.

- [ ] **Step 5: Commit the presentation increment**

```bash
git add src/lib/dashboard/recent-activity.ts src/lib/dashboard/recent-activity.test.ts
git commit -m "feat(dashboard): derive recent activity"
```

### Task 3: Dashboard Server Component integration

**Files:**
- Modify: `src/app/(dashboard)/(home)/page.tsx`
- Modify: `src/app/(dashboard)/(home)/page.test.tsx`

**Interfaces:**
- Consumes: `getLatestCustomer`, `listIncomes`, `buildIncomeActivity`, and `buildCustomerActivity`.
- Preserves: the expense fixture and existing activity-card markup.

- [ ] **Step 1: Write the failing dashboard render tests**

Hoist complete mocks for `requirePageUser`, `listIncomes`, and `getLatestCustomer`. Render `await Home()` and assert the real names and total are visible while `Tomás Pereyra` and the fixture sale description are absent. Add a null-result test asserting both honest empty messages render.

Also assert service input at the authorization boundary:

```ts
expect(listIncomes).toHaveBeenCalledWith(user, { page: 1, pageSize: 1 });
expect(getLatestCustomer).toHaveBeenCalledWith(user);
```

- [ ] **Step 2: Run the page test and verify RED**

Run: `npm test -- "src/app/(dashboard)/(home)/page.test.tsx"`

Expected: FAIL because fixture activity is still rendered and the services are not called.

- [ ] **Step 3: Wire parallel server reads and replace two activity entries**

Change the authentication call to retain `user`, eagerly start both reads, and await them together:

```ts
const { user } = await requirePageUser();
const [incomePage, latestCustomer] = await Promise.all([
  listIncomes(user, { page: 1, pageSize: 1 }),
  getLatestCustomer(user),
]);
```

Build a three-entry array from the real income, real customer and existing expense fixture. Do not change the other mock-backed dashboard sections.

- [ ] **Step 4: Run dashboard and related focused tests**

Run: `npm test -- "src/app/(dashboard)/(home)/page.test.tsx" src/lib/dashboard/recent-activity.test.ts src/lib/customers/repository.test.ts src/lib/customers/service.test.ts`

Expected: all focused tests pass.

- [ ] **Step 5: Commit the integrated dashboard activity**

```bash
git add "src/app/(dashboard)/(home)/page.tsx" "src/app/(dashboard)/(home)/page.test.tsx"
git commit -m "feat(dashboard): show latest persisted activity"
```

