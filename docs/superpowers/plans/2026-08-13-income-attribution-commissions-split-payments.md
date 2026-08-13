# Income Attribution, Commissions and Split Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist role-aware responsible employees, per-user commission rates, exact split payments and immutable commission/net snapshots through the prepared V2 income UI.

**Architecture:** Extend the canonical safe-user contract, add ordered migration `010`, and make PostgreSQL's `create_income_v2` function authoritative for eligibility, item totals, payment allocation and commission snapshots. Route Handlers and repositories accept only the strict V2 request; existing income list/detail components consume strict V2 responses while retaining isolated legacy presentation helpers only for pre-migration fixtures.

**Tech Stack:** Next.js 16.3 Route Handlers, React 19.2, strict TypeScript, Zod 4, Supabase PostgreSQL RPC, Vitest and Testing Library.

## Global Constraints

- Work from `origin/dev` at or after `05b479f`.
- Use Node 24.18.x and npm 11.16.x for final verification.
- Store monetary values as integer Argentine pesos and round each commission component with `round(base * rate / 100)`.
- `registered_by`, rates, prices, totals, dates, authorizer IDs and commission amounts never come from browser authority.
- Employees are responsible only for themselves; owner/admin may select any active, non-deleted user.
- Income history scope and manager filtering use the responsible `employee_id`.
- Create the SQL migration and documentation locally; do not apply it to shared Supabase without separate explicit authorization.
- Preserve idempotent stock, inventory movement and customer-visit behavior.

## File Structure

- `supabase/queries/010_income_commissions_and_split_payments.sql`: all schema changes, backfills, security and V2 income/user RPCs.
- `src/lib/auth/{types,schemas,repository-contracts}.ts`: canonical commission-aware safe user contract.
- `src/lib/users/{repository,service,client}.ts`: persistent manager commission configuration.
- `src/lib/incomes/{income-schema,contracts,repository,service,client}.ts`: canonical V2 server boundary and RPC adapter.
- `src/types/{income,income-commissions,user-commissions}.ts`: shared browser-safe types.
- `src/app/api/admin/users/**` and `src/app/api/incomes/**`: strict Route Handler boundaries.
- `src/app/(dashboard)/incomes/**` and `src/components/incomes/**`: live rates, strict V2 responses and role-aware metrics/detail.
- `supabase/queries/README.md`, `AGENTS.md`, `product.md`, `context_snapshot.md`: installation and durable state.

---

### Task 1: Make commission rates part of the canonical safe-user contract

**Files:**
- Modify: `src/lib/auth/types.ts`
- Modify: `src/lib/auth/schemas.ts`
- Modify: `src/lib/auth/repository-contracts.ts`
- Modify: `src/types/user-commissions.ts`
- Modify: `src/lib/users/frontend-user-contracts.ts`
- Test: `src/lib/auth/schemas.test.ts`
- Test: `src/lib/users/frontend-user-contracts.test.ts`
- Update typed fixtures: `src/lib/auth/authentication.test.ts`, `src/lib/auth/authorization.test.ts`, `src/lib/customers/service.test.ts`, `src/lib/products/service.test.ts`, `src/lib/services/service.test.ts`, `src/lib/incomes/service.test.ts`, `src/lib/users/{client,presentation,repository,service}.test.ts`, `src/components/users/users-view.test.tsx`

**Interfaces:**
- Produces: `SafeUser.serviceCommissionRate: number` and `SafeUser.productCommissionRate: number`.
- Produces: `CreateUserInput` with defaulted commission rates and `UpdateUserInput` with optional commission rates.
- Consumes: fixed role IDs and existing safe-user fields.

- [ ] **Step 1: Write failing schema and type-level behavior tests**

Add cases proving create defaults both rates to zero, accepts integer boundaries `0` and `100`, and rejects negative, fractional and `101` values. Add update cases proving either rate alone counts as a real change.

```ts
expect(createUserSchema.parse({
  firstName: "Ana", lastName: "Pérez", password: "password-2026", roleId: 3,
})).toMatchObject({ serviceCommissionRate: 0, productCommissionRate: 0 });

expect(updateUserSchema.parse({ serviceCommissionRate: 35 }))
  .toEqual({ serviceCommissionRate: 35 });
expect(createUserSchema.safeParse({
  firstName: "Ana", lastName: "Pérez", password: "password-2026", roleId: 3,
  serviceCommissionRate: 20.5, productCommissionRate: 0,
}).success).toBe(false);
```

- [ ] **Step 2: Run focused tests and confirm the old schemas fail**

Run: `npm test -- src/lib/auth/schemas.test.ts src/lib/users/frontend-user-contracts.test.ts`

Expected: FAIL because canonical auth schemas and `SafeUser` do not contain commission rates.

- [ ] **Step 3: Add the canonical fields and reuse one rate schema**

Implement:

```ts
const commissionRateValueSchema = z.number().int().min(0).max(100);
const commissionRateSchema = commissionRateValueSchema.default(0);

export const createUserSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  password: newPasswordSchema,
  roleId: roleIdSchema,
  serviceCommissionRate: commissionRateSchema,
  productCommissionRate: commissionRateSchema,
}).strict();
```

Use `commissionRateValueSchema.optional()` in `updateUserSchema`. Add both numeric fields to `SafeUser`, `NewUserRecord` and `UserRecordChanges`. Change `CommissionSafeUser` to an alias of `SafeUser`; do not maintain a second optional commission representation. Add explicit zero rates to every typed `SafeUser`, `CredentialUser` and authenticated-session fixture listed above so compilation cannot hide a missing server field.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/lib/auth/schemas.test.ts src/lib/users/frontend-user-contracts.test.ts`

Expected: PASS.

- [ ] **Step 5: Type-check affected user UI through its tests**

Run: `npm test -- src/components/users/user-editor-dialog.test.tsx src/components/users/users-view.test.tsx`

Expected: PASS after fixture users explicitly include zero rates or use a shared commission-aware fixture factory.

- [ ] **Step 6: Commit the canonical contract**

```bash
git add src/lib/auth src/lib/users/frontend-user-contracts.ts src/lib/users/frontend-user-contracts.test.ts src/types/user-commissions.ts src/components/users
git commit -m "feat(users): define canonical commission rates"
```

### Task 2: Persist manager-configured commission rates atomically

**Files:**
- Create: `supabase/queries/010_income_commissions_and_split_payments.sql`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `src/lib/users/repository.ts`
- Modify: `src/lib/users/service.ts`
- Modify: `src/app/api/admin/users/route.test.ts`
- Modify: `src/app/api/admin/users/[id]/route.test.ts`
- Test: `src/lib/users/repository.test.ts`
- Test: `src/lib/users/service.test.ts`

**Interfaces:**
- Produces SQL RPC: `update_user_profile_v2(target_user_id, set_first_name, new_first_name, set_last_name, new_last_name, set_role_id, new_role_id, set_is_active, new_is_active, set_service_commission_rate, new_service_commission_rate, set_product_commission_rate, new_product_commission_rate) returns uuid`.
- Produces repository selections containing `service_commission_rate` and `product_commission_rate`.
- Consumes: `CreateUserInput`, `UpdateUserInput`, existing final-owner invariant.

- [ ] **Step 1: Write failing repository, service and Route Handler tests**

Assert inserts include both rates, list/detail map them, update calls the V2 RPC with explicit `set_*` flags, and POST/PATCH accept the commission fields while rejecting unknown fields.

```ts
expect(rpc).toHaveBeenCalledWith("update_user_profile_v2", expect.objectContaining({
  target_user_id: employee.id,
  set_service_commission_rate: true,
  new_service_commission_rate: 45,
  set_product_commission_rate: true,
  new_product_commission_rate: 12,
}));
```

- [ ] **Step 2: Run focused tests and confirm persistence is missing**

Run: `npm test -- src/lib/users/repository.test.ts src/lib/users/service.test.ts src/app/api/admin/users/route.test.ts src/app/api/admin/users/[id]/route.test.ts`

Expected: FAIL because the repository omits rates and the server schemas reject them.

- [ ] **Step 3: Add user columns and the atomic manager RPC to migration 010**

Start the migration with:

```sql
alter table public.users
  add column if not exists service_commission_rate smallint not null default 0,
  add column if not exists product_commission_rate smallint not null default 0;

alter table public.users
  add constraint users_service_commission_rate_check
    check (service_commission_rate between 0 and 100),
  add constraint users_product_commission_rate_check
    check (product_commission_rate between 0 and 100);
```

Create `update_user_profile_v2` by preserving the advisory lock, deleted-user exclusion and last-active-owner check from `007_user_soft_deletion.sql`, then update both rate fields through `case when set_*`. Revoke execution from `public`, `anon`, `authenticated`; grant it only to `service_role`.

- [ ] **Step 4: Update database types, selections, creation and update plumbing**

Add snake-case fields to `UserRow`; add them to `SAFE_USER_SELECT` and `CREDENTIAL_USER_SELECT`; map them in `toSafeUser`. Include them in the insert and pass them from `createUser`:

```ts
return dependencies.users.create({
  firstName: input.firstName,
  lastName: input.lastName,
  passwordHash,
  roleId: input.roleId,
  serviceCommissionRate: input.serviceCommissionRate,
  productCommissionRate: input.productCommissionRate,
  createdBy: actor.id,
});
```

Treat rate changes as profile changes and call `update_user_profile_v2` exactly once, even when names/role/status and rates change together.

- [ ] **Step 5: Run focused user tests**

Run: `npm test -- src/lib/users src/app/api/admin/users src/components/users`

Expected: PASS.

- [ ] **Step 6: Commit user persistence and the migration foundation**

```bash
git add supabase/queries/010_income_commissions_and_split_payments.sql src/lib/supabase/database.types.ts src/lib/users src/lib/auth src/app/api/admin/users src/components/users src/types/user-commissions.ts
git commit -m "feat(users): persist commission configuration"
```

### Task 3: Replace the legacy income request with one strict V2 contract

**Files:**
- Modify: `src/types/income.ts`
- Modify: `src/types/income-commissions.ts`
- Modify: `src/lib/incomes/income-schema.ts`
- Modify: `src/lib/incomes/frontend-contracts.ts`
- Modify: `src/lib/incomes/contracts.ts`
- Modify: `src/lib/incomes/service.ts`
- Test: `src/lib/incomes/income-schema.test.ts`
- Test: `src/lib/incomes/frontend-contracts.test.ts`
- Test: `src/lib/incomes/service.test.ts`

**Interfaces:**
- Produces canonical `CreateIncomeInput` equal to the approved V2 request.
- Produces strict V2 `Income`, `PaginatedIncomes`, `IncomeCommissionSnapshot` and `IncomeListMetrics` types.
- Produces `IncomeRepository.create(actor: SafeUser, input: CreateIncomeInput): Promise<Income>`.

- [ ] **Step 1: Write failing request and authorization tests**

Cover one/two payments, duplicate methods, unknown/extra authority fields, an employee request naming another employee, and manager preservation of the selected ID.

```ts
expect(createIncomeSchema.safeParse({
  requestId, employeeId, customerId: null, serviceId,
  products: [], payments: [{ method: "cash", amount: 10_000 }],
  grantFullServiceCommission: false, total: 10_000,
}).success).toBe(false);

await createIncome(employee, { ...input, employeeId: other.id }, dependencies);
expect(dependencies.incomes.create).toHaveBeenCalledWith(
  employee,
  expect.objectContaining({ employeeId: employee.id }),
);
```

- [ ] **Step 2: Run the focused contract/service tests**

Run: `npm test -- src/lib/incomes/income-schema.test.ts src/lib/incomes/frontend-contracts.test.ts src/lib/incomes/service.test.ts`

Expected: FAIL because `CreateIncomeInput` still contains `paymentMethod` and repository creation receives only an actor ID.

- [ ] **Step 3: Make V2 canonical and remove duplicate request definitions**

Define in `src/types/income.ts`:

```ts
export type CreateIncomeInput = {
  requestId: string;
  employeeId: string;
  customerId: string | null;
  serviceId: string | null;
  products: IncomeProductInput[];
  payments: IncomePayment[];
  grantFullServiceCommission: boolean;
};
```

Have `src/types/income-commissions.ts` import this type instead of redefining it. Make `createIncomeSchema` the single strict server schema, require distinct payment methods, and retain the service-or-product refinement.

- [ ] **Step 4: Normalize employee attribution in the service and pass the full actor**

Implement:

```ts
export const createIncome = (
  actor: SafeUser,
  input: CreateIncomeInput,
  dependencies: IncomeDependencies = defaults,
) => dependencies.incomes.create(
  actor,
  actor.role.name === "employee" ? { ...input, employeeId: actor.id } : input,
);
```

The SQL function remains the final authorization boundary and repeats this rule.

- [ ] **Step 5: Run focused tests and the prepared form tests**

Run: `npm test -- src/lib/incomes/income-schema.test.ts src/lib/incomes/frontend-contracts.test.ts src/lib/incomes/service.test.ts src/components/incomes/income-form.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the canonical V2 request**

```bash
git add src/types/income.ts src/types/income-commissions.ts src/lib/incomes src/components/incomes/income-form.test.tsx
git commit -m "refactor(incomes): make v2 request canonical"
```

### Task 4: Complete the transactional SQL migration

**Files:**
- Modify: `supabase/queries/010_income_commissions_and_split_payments.sql`
- Create: `src/lib/incomes/sql-migration-contract.test.ts`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `supabase/queries/README.md`

**Interfaces:**
- Produces table `income_payments`.
- Produces RPC `create_income_v2(actor_user_id, responsible_employee_id, income_request_id, selected_customer_id, selected_service_id, product_items, payment_items, grant_full_service_commission) returns uuid`.
- Replaces JSON output of `get_income_detail` and `list_incomes` with safe V2 identities, payments and commission snapshot.
- Preserves `void_income(uuid, uuid)` behavior while excluding voids from V2 metrics.

- [ ] **Step 1: Write a failing migration contract test**

Read the SQL file from `process.cwd()` and assert the security-critical and backfill clauses exist:

```ts
const sql = readFileSync(resolve(process.cwd(), "supabase/queries/010_income_commissions_and_split_payments.sql"), "utf8");
expect(sql).toContain("create table if not exists public.income_payments");
expect(sql).toContain("create or replace function public.create_income_v2");
expect(sql).toContain("alter table public.income_payments enable row level security");
expect(sql).toContain("from public, anon, authenticated");
expect(sql).toContain("America/Argentina/Buenos_Aires");
expect(sql).toContain("INCOME_REQUEST_CONFLICT");
```

- [ ] **Step 2: Run the test and confirm migration 010 is incomplete**

Run: `npm test -- src/lib/incomes/sql-migration-contract.test.ts`

Expected: FAIL on the missing income table/function clauses.

- [ ] **Step 3: Add schema changes and historical backfills**

In one transaction-safe script:

- Rename `incomes.user_id` to `registered_by`.
- Add non-null-after-backfill `employee_id` and `request_fingerprint`.
- Add commission bases/rates/amounts/total/net/override/authorizer fields and checks.
- Make legacy `payment_method` nullable and preserve its cash/transfer check.
- Create/index/RLS-protect `income_payments` and backfill one row per historical income.
- Backfill employee to registrant, bases from `income_items`, rates/commission to zero and net to total.
- Rebuild responsible-employee and business-date indexes.

Use `extensions.digest()` for the new request fingerprint. Historical rows use `encode(extensions.digest(('legacy:' || id::text)::bytea, 'sha256'), 'hex')`.

- [ ] **Step 4: Implement `create_income_v2` validations and atomic writes**

Use an advisory lock keyed by `registered_by + request_id`. Compute a stable fingerprint from normalized effective employee, customer, service, ordered products, ordered payments and override flag. If the key exists, return the existing ID only when the fingerprint matches; otherwise raise `INCOME_REQUEST_CONFLICT`.

The function must:

```sql
effective_employee_id := case
  when actor_role_id = 3 then actor_user_id
  else responsible_employee_id
end;

service_commission_amount := round(
  service_commission_base * effective_service_rate / 100.0
)::integer;
product_commission_amount := round(
  product_commission_base * employee_product_rate / 100.0
)::integer;
commission_total := service_commission_amount + product_commission_amount;
barbershop_net := sale_total - commission_total;
```

Validate employee eligibility, override authorization, exact distinct positive payment allocation, catalog availability and stock before inserting. Insert income, items, payments, stock movements and customer visit in the same function body.

- [ ] **Step 5: Replace read/list/void JSON and metrics**

Return:

```json
{
  "employee": { "id": "...", "firstName": "...", "lastName": "..." },
  "registeredBy": { "id": "...", "firstName": "...", "lastName": "..." },
  "payments": [{ "method": "cash", "amount": 9500 }],
  "commission": {
    "serviceBase": 10000, "productBase": 9000,
    "serviceRate": 50, "productRate": 10,
    "serviceAmount": 5000, "productAmount": 900,
    "total": 5900, "barbershopNet": 13100,
    "fullServiceCommission": false, "authorizedBy": null
  }
}
```

Scope `get_income_detail` and `list_incomes` by `employee_id`. Compute active `grossTotal`, `commissionTotal`, `barbershopNet`, `count`, `average`, `cashTotal` and `transferTotal`; voided rows contribute zero. Preserve void idempotency, stock restoration and one-time visit decrement.

- [ ] **Step 6: Finish grants, verification queries and migration tests**

Drop the obsolete `create_income(uuid, uuid, uuid, uuid, jsonb, text)` function after backfill. Revoke all new tables/functions from browser roles, grant required access only to `service_role`, notify PostgREST to reload schema, and add README verification queries for columns, payments, RLS and routines.

Run: `npm test -- src/lib/incomes/sql-migration-contract.test.ts && git diff --check`

Expected: PASS.

- [ ] **Step 7: Commit the complete migration**

```bash
git add supabase/queries/010_income_commissions_and_split_payments.sql supabase/queries/README.md src/lib/incomes/sql-migration-contract.test.ts src/lib/supabase/database.types.ts
git commit -m "feat(incomes): add transactional commission migration"
```

### Task 5: Connect repositories and Route Handlers to the V2 RPC

**Files:**
- Modify: `src/lib/incomes/contracts.ts`
- Modify: `src/lib/incomes/repository.ts`
- Modify: `src/lib/incomes/service.ts`
- Modify: `src/lib/incomes/client.ts`
- Modify: `src/app/api/incomes/route.ts`
- Test: `src/lib/incomes/repository.test.ts`
- Test: `src/lib/incomes/service.test.ts`
- Test: `src/lib/incomes/client.test.ts`
- Test: `src/app/api/incomes/route.test.ts`

**Interfaces:**
- Consumes: `create_income_v2` and V2 list/detail JSON from Task 4.
- Produces: `incomeClient.create(input: CreateIncomeInput)` as the only create method.
- Produces public errors listed in the approved design.

- [ ] **Step 1: Write failing RPC and API tests**

Assert exact RPC parameters, strict Route Handler parsing, employee normalization, V2 response parsing and mappings for all new sentinels.

```ts
expect(rpc).toHaveBeenCalledWith("create_income_v2", {
  actor_user_id: owner.id,
  responsible_employee_id: input.employeeId,
  income_request_id: input.requestId,
  selected_customer_id: input.customerId,
  selected_service_id: input.serviceId,
  product_items: input.products,
  payment_items: input.payments,
  grant_full_service_commission: input.grantFullServiceCommission,
});
```

- [ ] **Step 2: Run focused tests and confirm legacy RPC use**

Run: `npm test -- src/lib/incomes/repository.test.ts src/lib/incomes/service.test.ts src/lib/incomes/client.test.ts src/app/api/incomes/route.test.ts`

Expected: FAIL because repository calls `create_income` with `selected_payment_method`.

- [ ] **Step 3: Implement strict V2 response schemas**

Make `registeredBy`, `payments` and `commission` required in server `incomeResponseSchema`. Include nullable `authorizedBy`. Replace metrics `total` with `grossTotal` and require commission/net values. Keep a browser-only optional legacy shape only in presentation tests; repository validation must never fabricate zeros.

- [ ] **Step 4: Call the V2 RPC and map public errors**

Map exact database messages:

```ts
const mappings = {
  EMPLOYEE_NOT_ELIGIBLE: ["EMPLOYEE_NOT_ELIGIBLE", "El empleado seleccionado no está disponible.", 409],
  PAYMENT_ALLOCATION_MISMATCH: ["PAYMENT_ALLOCATION_MISMATCH", "La distribución del pago no coincide con el total.", 409],
  INVALID_COMMISSION_OVERRIDE: ["INVALID_COMMISSION_OVERRIDE", "No se puede otorgar el servicio completo en esta venta.", 403],
  COMMISSION_RATE_OUT_OF_RANGE: ["COMMISSION_RATE_OUT_OF_RANGE", "La comisión configurada no es válida.", 409],
  INCOME_REQUEST_CONFLICT: ["INCOME_REQUEST_CONFLICT", "Este intento de venta ya fue usado con otros datos.", 409],
} as const;
```

Keep stock, customer, service and product mappings unchanged.

- [ ] **Step 5: Remove the duplicate browser create method**

Change `IncomeClient` to expose only `create`, `list`, `get`, `void`; have `IncomeForm` accept `Pick<IncomeClient, "create">` and submit the V2 object through it. Update API mocks without retaining `createV2` aliases.

- [ ] **Step 6: Run focused income backend tests**

Run: `npm test -- src/lib/incomes src/app/api/incomes`

Expected: PASS.

- [ ] **Step 7: Commit the backend connection**

```bash
git add src/lib/incomes src/app/api/incomes src/types/income.ts src/types/income-commissions.ts
git commit -m "feat(incomes): connect v2 transaction contract"
```

### Task 6: Feed real rates into the prepared form and finalize V2 history presentation

**Files:**
- Modify: `src/app/(dashboard)/incomes/new/page.tsx`
- Modify: `src/app/(dashboard)/incomes/new/page.test.tsx`
- Modify: `src/app/(dashboard)/incomes/page.tsx`
- Modify: `src/components/incomes/income-form.tsx`
- Modify: `src/components/incomes/income-detail-sheet.tsx`
- Modify: `src/components/incomes/income-table.tsx`
- Modify: `src/components/incomes/income-mobile-list.tsx`
- Modify: `src/components/incomes/income-metrics.tsx`
- Modify: `src/lib/incomes/income-metric-cards.ts`
- Modify: `src/lib/incomes/income-presentation.ts`
- Test: corresponding `*.test.tsx` and `*.test.ts` files.

**Interfaces:**
- Consumes: commission-aware users and strict V2 incomes from Tasks 1-5.
- Produces: live manager/employee form previews and role-specific history metrics without `Pendiente de backend` for valid V2 responses.

- [ ] **Step 1: Write failing page and presentation tests**

Assert `/incomes/new` forwards stored `45/12` rates instead of zero; a manager sees the selected employee rates and allowed 100% control; an employee receives only self. Assert strict V2 detail renders both identities, two payment rows, bases, rates, authorizer and net. Assert metric cards consume `grossTotal`.

- [ ] **Step 2: Run focused UI tests**

Run: `npm test -- "src/app/(dashboard)/incomes" src/components/incomes src/lib/incomes/income-metric-cards.test.ts src/lib/incomes/income-presentation.test.ts`

Expected: FAIL on hard-coded zero rates and old metric names. In PowerShell, quote paths containing parentheses if invoking a single file.

- [ ] **Step 3: Map live commission rates on the server page**

Use canonical fields:

```ts
employees: availableUsers.map((candidate) => ({
  id: candidate.id,
  firstName: candidate.firstName,
  lastName: candidate.lastName,
  role: candidate.role.name,
  isActive: candidate.isActive,
  serviceCommissionRate: candidate.serviceCommissionRate,
  productCommissionRate: candidate.productCommissionRate,
})),
```

- [ ] **Step 4: Remove legacy authority assumptions from V2 UI**

Use `payments[0]` only as a presentation fallback for explicitly legacy fixtures. Derive icons/labels from `payments`; show `authorizedBy` when full service commission is active. Employees do not render net; managers do. Keep void labels and exclusion copy.

- [ ] **Step 5: Update role-specific metric adapters**

Manager cards: gross, accrued commission, barbershop net, count. Employee cards: gross, accrued commission, count, average. Use server metrics; do not recalculate net from visible rows.

- [ ] **Step 6: Run focused prepared-frontend tests**

Run: `npm test -- "src/app/(dashboard)/incomes" src/components/incomes src/lib/incomes`

Expected: PASS.

- [ ] **Step 7: Commit the live frontend integration**

```bash
git add "src/app/(dashboard)/incomes" src/components/incomes src/lib/incomes src/types/income.ts
git commit -m "feat(incomes): activate role-aware commission ui"
```

### Task 7: Verify the complete income increment and update durable documentation

**Files:**
- Modify: `AGENTS.md`
- Modify: `product.md`
- Modify: `context_snapshot.md`
- Modify: `supabase/queries/README.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: an installable, documented increment ready for manual SQL review/application.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all test files and tests PASS with zero failures.

- [ ] **Step 2: Run lint and production build**

Run: `npm run lint`

Expected: exit 0 with no warnings.

Run: `npm run build`

Expected: Next.js production build completes successfully.

- [ ] **Step 3: Run repository hygiene checks**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only intentional income increment and documentation changes before the final commit.

- [ ] **Step 4: Update durable project state**

Record in `AGENTS.md` that incomes distinguish `registered_by` from responsible `employee_id`, history scopes by responsible employee, payments are normalized and commissions are immutable snapshots. Mark commissions/payments as implemented locally but SQL `010` pending manual installation in `product.md` and `context_snapshot.md` unless the migration was separately applied and verified.

- [ ] **Step 5: Commit documentation and final verification state**

```bash
git add AGENTS.md product.md context_snapshot.md supabase/queries/README.md
git commit -m "docs(incomes): record commissions increment"
```

- [ ] **Step 6: Report the external deployment gate**

Report the exact migration file, verification commands and commit range. Do not claim live persistence until `010_income_commissions_and_split_payments.sql` has been manually applied and the post-install queries have passed.
