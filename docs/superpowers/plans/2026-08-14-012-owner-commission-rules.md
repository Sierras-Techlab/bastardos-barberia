# Owner Commission Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make owner commission configuration and every owner-responsible sale authoritative 0%, while introducing the canonical user-profile RPC.

**Architecture:** Enforce the rule in user services, the manager editor and PostgreSQL, then independently re-enforce it inside the transactional sale RPC. Migration `012` backfills current owners and owner-attributed development sales before adding immutable role snapshots.

**Tech Stack:** PostgreSQL PL/pgSQL, Supabase RPC, TypeScript, React Hook Form, Zod, Vitest and Testing Library.

## Global Constraints

- Run after migration `011`.
- Owner means the responsible user's locked role at sale time, not the registering actor.
- Owner configured rates and effective sale rates are always exactly 0.
- Owner/self-targeted 100% overrides fail at the database boundary.
- Final user RPC name is `update_user_profile`; remove `update_user_profile_v2`.
- Preserve employee/admin commission behavior and sale idempotency.

---

### Task 1: Define owner-safe commission behavior in application tests

**Files:**

- Modify: `src/lib/users/service.test.ts`
- Modify: `src/lib/users/repository.test.ts`
- Modify: `src/components/users/user-editor-dialog.test.tsx`
- Modify: `src/lib/incomes/income-commissions.test.ts`

**Interfaces:**

- Consumes: `SafeUser.role.name`, configured integer commission rates.
- Produces: `calculateCommissionPreview(input)` where `input.responsibleRole` is `owner | admin | employee`.

- [ ] **Step 1: Add failing service/repository tests**

Add assertions that owner creation and role promotion persist both rates as zero, owner commission updates cannot persist non-zero values, and repository updates call `update_user_profile`:

```ts
expect(rpc).toHaveBeenCalledWith("update_user_profile", expect.objectContaining({
  new_service_commission_rate: 0,
  new_product_commission_rate: 0,
}));
```

- [ ] **Step 2: Add failing UI and preview tests**

Assert owner commission inputs are disabled and show `0`; assert an owner preview returns zero even with configured 45/10 and requested full service:

```ts
expect(calculateCommissionPreview({
  responsibleRole: "owner",
  serviceBase: 19000,
  productBase: 30000,
  serviceRate: 45,
  productRate: 10,
  grantFullServiceCommission: true,
})).toMatchObject({ total: 0, barbershopNet: 49000, fullServiceCommission: false });
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
npm test -- --run src/lib/users/service.test.ts src/lib/users/repository.test.ts src/components/users/user-editor-dialog.test.tsx src/lib/incomes/income-commissions.test.ts
```

Expected: failures for the old RPC name, editable owner fields and missing role-aware preview.

### Task 2: Implement the application rule

**Files:**

- Modify: `src/lib/users/service.ts`
- Modify: `src/lib/users/repository.ts`
- Modify: `src/components/users/user-editor-dialog.tsx`
- Modify: `src/lib/incomes/income-commissions.ts`
- Modify: `src/types/income-commissions.ts`
- Modify: affected user/editor fixtures.

**Interfaces:**

- Produces:

```ts
type CommissionPreviewInput = {
  responsibleRole: UserRole;
  serviceBase: number;
  productBase: number;
  serviceRate: number;
  productRate: number;
  grantFullServiceCommission: boolean;
};
```

- [ ] **Step 1: Normalize owner rates in user services**

When creating or updating a target role of `owner`, pass `serviceCommissionRate: 0` and `productCommissionRate: 0`; when promoting to owner, include both zero values in the same mutation.

- [ ] **Step 2: Disable owner commission controls**

Render both number inputs disabled for owner targets, reset their local values to zero when the selected role becomes owner and omit non-zero owner payloads.

- [ ] **Step 3: Make preview role-aware**

Return zero service/product rates and amounts before evaluating overrides when `responsibleRole === "owner"`; pass the selected employee role from `CommissionPreview`.

- [ ] **Step 4: Use the canonical repository RPC and run GREEN**

Replace `update_user_profile_v2` with `update_user_profile`, then rerun Task 1's command. Expected: all focused tests pass.

### Task 3: Create migration 012 and acceptance checks

**Files:**

- Create: `supabase/queries/012_owner_commission_rules.sql`
- Modify: `supabase/queries/README.md`
- Modify: `src/lib/supabase/database.types.ts`

**Interfaces:**

- Produces: `public.incomes.responsible_role_snapshot text not null` and canonical `public.update_user_profile(...)`.

- [ ] **Step 1: Write the migration transaction**

The SQL must:

```sql
begin;
update public.users
set service_commission_rate = 0, product_commission_rate = 0
where role_id = 1;

alter table public.incomes
  add column if not exists responsible_role_snapshot text;

update public.incomes i
set responsible_role_snapshot = r.name
from public.users u join public.roles r on r.id = u.role_id
where u.id = i.employee_id and i.responsible_role_snapshot is null;
```

Then add the `owner/admin/employee` check and `NOT NULL`, add `users_owner_commission_zero_check` requiring both rates to be zero when `role_id = 1`, replace `update_user_profile_v2` with `update_user_profile`, normalize owner rates to zero, replace the existing sale RPC body so locked owner records always calculate zero, correct existing owner-attributed development income aggregates, revoke public/anon/authenticated execution and grant only `service_role`. Commit only after every statement succeeds.

- [ ] **Step 2: Add rollback-wrapped behavioral checks**

Document SQL that proves an owner sale has zero rates/commission/net reconciliation, a manager sale for an employee retains configured rates, and owner/full-service override raises `INVALID_COMMISSION_OVERRIDE`.

- [ ] **Step 3: Run structural local checks**

Run:

```bash
git diff --check
npm test -- --run src/lib/users/service.test.ts src/lib/users/repository.test.ts src/components/users/user-editor-dialog.test.tsx src/lib/incomes/income-commissions.test.ts src/lib/incomes/repository.test.ts
npx tsc --noEmit
```

Expected: exit code 0 for every command.

- [ ] **Step 4: Commit plan 012 implementation**

```bash
git add supabase/queries/012_owner_commission_rules.sql supabase/queries/README.md src/lib/supabase/database.types.ts src/lib/users src/components/users src/lib/incomes src/types/income-commissions.ts
git commit -m "feat(commissions): enforce zero owner commissions"
```
