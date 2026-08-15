# Payment Method Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let managers permanently delete unused payment methods, hide inactive methods by default, and preserve every method referenced by historical sales.

**Architecture:** Keep `is_active` as the only reversible lifecycle state. Move deactivate/reactivate to the existing `PATCH` boundary, make `DELETE` a true physical deletion backed by a transaction-safe PostgreSQL RPC, and filter inactive methods only in the administration dialog while continuing to load the complete catalog for historical consumers.

**Tech Stack:** Next.js 16 App Router Route Handlers, React 19, TypeScript strict mode, Supabase PostgreSQL RPCs, Zod, shadcn/base-ui Dialog, Sonner, Vitest and Testing Library.

## Global Constraints

- Only active owners and admins may create, update, deactivate, reactivate or delete payment methods.
- A referenced payment method must never be physically deleted or cascade into `income_payments`.
- The last active payment method can be neither deactivated nor deleted.
- Active-state changes and deletion must share one transaction-scoped advisory lock.
- `DELETE /api/payment-methods/:id` means permanent deletion; deactivation and reactivation use `PATCH`.
- The administration dialog shows active methods by default and exposes inactive methods behind `Ver desactivados`.
- Historical catalog reads continue returning active and inactive methods.
- Do not add a second archived/deleted state or new dependency.
- Preserve server-only Supabase access and existing manager authorization-before-validation ordering.

---

### Task 1: Transaction-safe database deletion contract

**Files:**
- Modify: `supabase/queries/016_payment_methods.sql`
- Modify: `src/lib/payment-methods/migration-016.test.ts`

**Interfaces:**
- Consumes: `public.payment_methods`, `public.income_payments.payment_method_id`, `public.update_payment_method(...)`.
- Produces: `public.delete_payment_method(actor_user_id uuid, target_payment_method_id uuid) returns uuid` and shared advisory-lock behavior for active-state mutations.

- [ ] **Step 1: Write the failing migration contract test**

Add a test requiring all of these observable migration guarantees:

```ts
it("serializes lifecycle changes and deletes only unused non-final methods", () => {
  const sql = migration();

  expect(sql.match(/bastardos_payment_method_lifecycle/g)?.length).toBeGreaterThanOrEqual(2);
  expect(sql).toMatch(/create or replace function public\.delete_payment_method\([\s\S]*?PAYMENT_METHOD_IN_USE[\s\S]*?delete from public\.payment_methods/);
  expect(sql).toMatch(/drop function if exists public\.deactivate_payment_method\(uuid, uuid\)/);
  expect(sql).toMatch(/grant execute on function public\.delete_payment_method\(uuid, uuid\)\s+to service_role/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- src/lib/payment-methods/migration-016.test.ts
```

Expected: FAIL because `delete_payment_method` and the shared lifecycle lock are absent.

- [ ] **Step 3: Implement the minimal SQL lifecycle changes**

At the beginning of both `update_payment_method` and the new deletion RPC, after manager authorization and before row/count reads, acquire:

```sql
perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('bastardos_payment_method_lifecycle', 0)
);
```

Implement the deletion RPC with the exact sentinels:

```sql
create or replace function public.delete_payment_method(
  actor_user_id uuid,
  target_payment_method_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role_id smallint;
  current_record record;
  active_count integer;
begin
  select role_id into actor_role_id
  from public.users
  where id = actor_user_id and is_active and deleted_at is null;

  if not found or actor_role_id not in (1, 2) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('bastardos_payment_method_lifecycle', 0)
  );

  select id, is_active into current_record
  from public.payment_methods
  where id = target_payment_method_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_NOT_FOUND';
  end if;

  if current_record.is_active then
    select count(*) into active_count
    from public.payment_methods
    where is_active;

    if active_count <= 1 then
      raise exception using errcode = 'P0001', message = 'LAST_ACTIVE_PAYMENT_METHOD';
    end if;
  end if;

  if exists (
    select 1 from public.income_payments
    where payment_method_id = target_payment_method_id
  ) then
    raise exception using errcode = 'P0001', message = 'PAYMENT_METHOD_IN_USE';
  end if;

  delete from public.payment_methods
  where id = target_payment_method_id;

  return target_payment_method_id;
end;
$$;
```

Remove the obsolete `deactivate_payment_method` RPC from the canonical surface with `drop function if exists`, revoke public execution from the new RPC and grant it only to `service_role`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- src/lib/payment-methods/migration-016.test.ts
git diff --check
```

Expected: migration tests pass and the diff check is silent.

- [ ] **Step 5: Commit Task 1**

```bash
git add supabase/queries/016_payment_methods.sql src/lib/payment-methods/migration-016.test.ts
git commit -m "feat(payment-methods): add safe deletion RPC"
```

---

### Task 2: Domain, API and browser client semantics

**Files:**
- Modify: `src/types/payment-method.ts`
- Modify: `src/lib/payment-methods/schemas.ts`
- Modify: `src/lib/payment-methods/schemas.test.ts`
- Modify: `src/lib/payment-methods/contracts.ts`
- Modify: `src/lib/payment-methods/service.ts`
- Modify: `src/lib/payment-methods/service.test.ts`
- Modify: `src/lib/payment-methods/repository.ts`
- Modify: `src/lib/payment-methods/repository.test.ts`
- Modify: `src/app/api/payment-methods/[id]/route.ts`
- Modify: `src/app/api/payment-methods/[id]/route.test.ts`
- Modify: `src/lib/payment-methods/client.ts`
- Modify: `src/lib/payment-methods/client.test.ts`

**Interfaces:**
- Consumes: `delete_payment_method(uuid, uuid)` from Task 1.
- Produces: `PaymentMethodUpdate = { name?: string; isActive?: boolean }`, `deletePaymentMethod(...)`, repository `remove(...)`, client `deactivate(...)` through PATCH and client `remove(...)` through DELETE.

- [ ] **Step 1: Write failing schema and domain tests**

Change the schema expectation so `{ isActive: false }` parses successfully. Extend the fake repository with:

```ts
remove: vi.fn().mockResolvedValue(method.id),
```

Require both manager-only operations:

```ts
await updatePaymentMethod(manager, method.id, { isActive: false }, deps);
await expect(deletePaymentMethod(manager, method.id, deps)).resolves.toEqual({
  id: method.id,
});
expect(deps.methods.update).toHaveBeenCalledWith(manager.id, method.id, {
  isActive: false,
});
expect(deps.methods.remove).toHaveBeenCalledWith(manager.id, method.id);
```

Also assert employees reach neither persistence operation and a missing deletion maps to `PAYMENT_METHOD_NOT_FOUND`.

- [ ] **Step 2: Write failing repository, route and client tests**

Require repository `remove` to call:

```ts
expect(rpc).toHaveBeenCalledWith("delete_payment_method", {
  actor_user_id: actorId,
  target_payment_method_id: methodId,
});
```

Require `PAYMENT_METHOD_IN_USE` and a defensive PostgreSQL `23503` to map to:

```ts
{
  code: "PAYMENT_METHOD_IN_USE",
  message: "Este medio de pago tiene ventas registradas. Desactivalo para ocultarlo sin perder el historial.",
  status: 409,
}
```

Require the Route Handler to authorize first, accept `PATCH { isActive: false }`, and make `DELETE` call `deletePaymentMethod`. Require the browser client to send:

```ts
// deactivate
{
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ isActive: false }),
}

// remove
{ method: "DELETE" }
```

- [ ] **Step 3: Run the focused boundary tests and verify RED**

Run:

```bash
npm test -- src/lib/payment-methods/schemas.test.ts src/lib/payment-methods/service.test.ts src/lib/payment-methods/repository.test.ts 'src/app/api/payment-methods/[id]/route.test.ts' src/lib/payment-methods/client.test.ts
```

Expected: FAIL on false-state parsing and missing deletion interfaces.

- [ ] **Step 4: Implement the minimal TypeScript contract**

Use these exact signatures:

```ts
export type PaymentMethodUpdate = {
  name?: string;
  isActive?: boolean;
};

export type PaymentMethodRepository = {
  // existing members
  remove(actorId: string, id: string): Promise<string | null>;
};

export const deletePaymentMethod = async (
  actor: SafeUser,
  id: string,
  dependencies: PaymentMethodServiceDependencies = defaultDependencies,
): Promise<{ id: string }> => {
  assertManager(actor);
  const deletedId = await dependencies.methods.remove(actor.id, id);
  if (!deletedId) throw paymentMethodNotFound();
  return { id: deletedId };
};
```

Remove `assertNotDeactivationAttempt` and the service/repository dependency on the obsolete deactivation RPC. Keep a browser-facing `deactivate(id)` convenience method implemented with `PATCH { isActive: false }`, and add:

```ts
remove(id: string): Promise<{ id: string }>;
```

The Route Handler's `DELETE` body must call `deletePaymentMethod(user, id)`. Preserve `requireManager()` before awaiting and validating `params`.

- [ ] **Step 5: Run the focused boundary tests and verify GREEN**

Run:

```bash
npm test -- src/lib/payment-methods/schemas.test.ts src/lib/payment-methods/service.test.ts src/lib/payment-methods/repository.test.ts 'src/app/api/payment-methods/[id]/route.test.ts' src/lib/payment-methods/client.test.ts
npx tsc --noEmit
git diff --check
```

Expected: all focused tests, TypeScript and diff checks pass.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/types/payment-method.ts src/lib/payment-methods 'src/app/api/payment-methods/[id]/route.ts' 'src/app/api/payment-methods/[id]/route.test.ts'
git commit -m "feat(payment-methods): expose deletion API"
```

---

### Task 3: Explicit destructive confirmation

**Files:**
- Create: `src/components/incomes/payment-method-delete-dialog.tsx`
- Create: `src/components/incomes/payment-method-delete-dialog.test.tsx`

**Interfaces:**
- Consumes: a `PaymentMethod` and an async confirmation callback supplied by the administration dialog.
- Produces: `PaymentMethodDeleteDialog({ method, onConfirm, onClose })` with its own saving/error state.

- [ ] **Step 1: Write the failing confirmation tests**

Cover all of these behaviors with the real dialog component:

```tsx
render(
  <PaymentMethodDeleteDialog
    method={method}
    onConfirm={onConfirm}
    onClose={onClose}
  />,
);

expect(screen.getByText(/“Efectivo”/)).toBeVisible();
expect(onConfirm).not.toHaveBeenCalled();
await user.click(screen.getByRole("button", { name: "Eliminar medio de pago" }));
expect(onConfirm).toHaveBeenCalledTimes(1);
```

Add separate cases proving cancellation does not delete, the button shows `Eliminando...` while pending, close is blocked while saving, and a rejected `PaymentMethodApiError` leaves the exact public message visible.

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
npm test -- src/components/incomes/payment-method-delete-dialog.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the focused dialog**

Follow the existing `ServiceDeleteDialog` structure and styles. Use `Trash2`, the shared `Dialog` primitives and a destructive button. The description must say:

```text
¿Querés eliminar “{name}” permanentemente? Sólo se eliminará si todavía no tiene ventas registradas.
```

Call `onClose()` only after a successful `await onConfirm()`. Convert unknown failures with:

```ts
const messageFor = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "No se pudo eliminar el medio de pago.";
```

- [ ] **Step 4: Run the dialog test and verify GREEN**

Run:

```bash
npm test -- src/components/incomes/payment-method-delete-dialog.test.tsx
git diff --check
```

Expected: all dialog tests pass and the diff check is silent.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/components/incomes/payment-method-delete-dialog.tsx src/components/incomes/payment-method-delete-dialog.test.tsx
git commit -m "feat(payment-methods): add deletion confirmation"
```

---

### Task 4: Active-first administration and deletion integration

**Files:**
- Modify: `src/components/incomes/payment-methods-dialog.tsx`
- Modify: `src/components/incomes/payment-methods-dialog.test.tsx`
- Modify: `supabase/queries/README.md`
- Modify: `product.md`
- Modify: `context_snapshot.md`

**Interfaces:**
- Consumes: `paymentMethodClient.deactivate`, `paymentMethodClient.update`, `paymentMethodClient.remove`, and `PaymentMethodDeleteDialog` from Tasks 2–3.
- Produces: active-only default administration, an inactive view, reactivation, permanent deletion and synchronized parent form state.

- [ ] **Step 1: Write failing administration tests**

Update the injected client type to include `remove`. Add separate tests proving:

1. inactive methods are absent initially;
2. `Ver desactivados (1)` reveals them;
3. deactivation calls `deactivate(id)` and removes the method from the active view without deleting it from parent state;
4. reactivation calls `update(id, { isActive: true })` and moves it back to the active view;
5. delete opens confirmation, calls `remove(id)` only after confirmation, removes the method from parent state and emits `Medio de pago eliminado correctamente.`;
6. `PAYMENT_METHOD_IN_USE` keeps the method and shows the server guidance;
7. both active and inactive empty states are readable.

- [ ] **Step 2: Run the administration tests and verify RED**

Run:

```bash
npm test -- src/components/incomes/payment-methods-dialog.test.tsx src/components/incomes/payment-method-delete-dialog.test.tsx
```

Expected: FAIL because inactive filtering and deletion integration are absent.

- [ ] **Step 3: Implement active/inactive views and deletion**

Add:

```ts
const [showInactive, setShowInactive] = useState(false);
const [deleting, setDeleting] = useState<PaymentMethod | null>(null);
const visibleMethods = methods.filter(
  (method) => method.isActive !== showInactive,
);
const inactiveCount = methods.filter((method) => !method.isActive).length;
```

Render a rounded secondary control named `Ver desactivados (${inactiveCount})` and, in the inactive view, `Volver a activos`. Add an icon-only destructive action with an accessible name `Eliminar ${method.name}` to both views.

Wire confirmation with:

```tsx
{deleting && (
  <PaymentMethodDeleteDialog
    method={deleting}
    onClose={() => setDeleting(null)}
    onConfirm={async () => {
      await paymentMethodClient.remove(deleting.id);
      replace(methods.filter((method) => method.id !== deleting.id));
      toast.success("Medio de pago eliminado correctamente.");
    }}
  />
)}
```

Keep inactive methods in `methods` and `onMethodsChange`; only `visibleMethods` controls what the administration list renders. This preserves historical selectors while preventing screen clutter.

- [ ] **Step 4: Run the complete payment-method slice**

Run:

```bash
npm test -- src/lib/payment-methods src/app/api/payment-methods src/components/incomes/payment-method-selector.test.tsx src/components/incomes/payment-methods-dialog.test.tsx src/components/incomes/payment-method-delete-dialog.test.tsx
npx tsc --noEmit
git diff --check
```

Expected: all payment-method tests, TypeScript and diff checks pass.

- [ ] **Step 5: Update deployment and product documentation**

In `supabase/queries/README.md`, document that the latest `016` must be run in full and add verification for:

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('update_payment_method', 'delete_payment_method');
```

Update `product.md` from planned deletion to implemented locally. Update `context_snapshot.md` with the delivered API/UI behavior, the latest verification evidence and the manual requirement to rerun migration `016` before using deletion remotely.

- [ ] **Step 6: Run full verification**

Run:

```bash
npm test -- --maxWorkers=2 --reporter=dot
npm run lint
npm run build -- --webpack
git diff --check
```

Expected: complete Vitest suite, ESLint, Next.js 16.3 webpack build and diff check all pass.

- [ ] **Step 7: Validate the real interface**

Run `npm run dev`, use the browser at desktop and phone widths, and verify:

- active methods are the default view;
- inactive methods remain reachable and reactivatable;
- delete confirmation names the correct method;
- unused deletion removes the row and shows a Sonner success;
- a referenced method produces the deactivation guidance;
- no dialog is clipped and no horizontal overflow appears;
- no browser console errors occur.

- [ ] **Step 8: Commit Task 4**

```bash
git add src/components/incomes/payment-methods-dialog.tsx src/components/incomes/payment-methods-dialog.test.tsx supabase/queries/README.md product.md context_snapshot.md
git commit -m "feat(payment-methods): manage inactive and deleted methods"
```
