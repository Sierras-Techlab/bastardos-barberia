# Product Category Safe Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permanently delete only product categories without product references while preserving referenced categories through the existing deactivation lifecycle.

**Architecture:** Add an incremental PostgreSQL migration with one manager-only delete RPC, promote category deactivation to `PATCH`, and reserve HTTP `DELETE` for physical removal. Rebuild the manager modal around active/inactive card views and an explicit category-specific confirmation dialog.

**Tech Stack:** PostgreSQL/Supabase SQL, Next.js 16 Route Handlers, React 19, TypeScript strict mode, Zod, Tailwind CSS, shadcn/base-ui, Sonner, Vitest and Testing Library.

## Global Constraints

- Run migration `017_product_category_deletion.sql` after `016_payment_methods.sql`; never rerun migration `014` on an existing project.
- Delete only categories with zero rows in `products`, regardless of product active state.
- Preserve `products_category_id_fkey ON DELETE RESTRICT` and the existing active-product deactivation guard.
- Keep manager authorization at API, service and PostgreSQL boundaries.
- Add no dependency and do not alter product records or historical snapshots.

---

### Task 1: Incremental safe-delete migration

**Files:**
- Create: `supabase/queries/017_product_category_deletion.sql`
- Create: `src/lib/product-categories/migration-017.test.ts`
- Modify: `supabase/queries/README.md`

**Interfaces:**
- Consumes: `public.product_categories`, `public.products`, `public.users` and the restrictive category foreign key installed by migration `014`.
- Produces: `public.delete_product_category(actor_user_id uuid, target_category_id uuid) returns uuid`.

- [ ] **Step 1: Write a failing structural migration test**

Read the migration as text and assert it contains all of these contracts:

```ts
expect(sql).toMatch(/drop trigger if exists product_categories_prevent_delete/i);
expect(sql).toMatch(/create function public\.delete_product_category/i);
expect(sql).toMatch(/role_id in \(1, 2\)/i);
expect(sql).toMatch(/from public\.products[\s\S]*category_id = category_record\.id/i);
expect(sql).toContain("PRODUCT_CATEGORY_HAS_PRODUCTS");
expect(sql).toMatch(/delete from public\.product_categories/i);
expect(sql).toMatch(/grant execute on function public\.delete_product_category\(uuid, uuid\)[\s\S]*to service_role/i);
expect(sql).toContain("notify pgrst, 'reload schema'");
```

- [ ] **Step 2: Run the migration test and verify RED**

Run `npm test -- src/lib/product-categories/migration-017.test.ts`.

Expected: FAIL because migration `017` does not exist.

- [ ] **Step 3: Implement the transactional migration**

Create a complete `begin; ... commit;` script which:

```sql
drop trigger if exists product_categories_prevent_delete
  on public.product_categories;

drop function if exists public.prevent_product_category_delete();

create function public.delete_product_category(
  actor_user_id uuid,
  target_category_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_record record;
begin
  if not exists (
    select 1 from public.users
    where id = actor_user_id
      and role_id in (1, 2)
      and is_active
      and deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'MANAGER_REQUIRED';
  end if;

  select id into category_record
  from public.product_categories
  where id = target_category_id
  for update;

  if not found then return null; end if;

  if exists (
    select 1 from public.products
    where category_id = category_record.id
  ) then
    raise exception using errcode = 'P0001', message = 'PRODUCT_CATEGORY_HAS_PRODUCTS';
  end if;

  delete from public.product_categories where id = category_record.id;
  return category_record.id;
end;
$$;
```

Revoke execute from `public`, `anon`, `authenticated`; grant only to `service_role`; notify PostgREST and commit.

- [ ] **Step 4: Document ordered installation and verify GREEN**

Append migration `017` to `supabase/queries/README.md`, state that `014` is not rerun, and add a routine-presence query for `delete_product_category`. Run:

```bash
npm test -- src/lib/product-categories/migration-017.test.ts
git diff --check
```

- [ ] **Step 5: Commit Task 1**

```bash
git add supabase/queries/017_product_category_deletion.sql supabase/queries/README.md src/lib/product-categories/migration-017.test.ts
git commit -m "feat(product-categories): add safe deletion RPC"
```

---

### Task 2: Domain, API and browser client contract

**Files:**
- Modify: `src/types/product-category.ts`
- Modify: `src/lib/product-categories/schemas.ts`
- Modify: `src/lib/product-categories/contracts.ts`
- Modify: `src/lib/product-categories/service.ts`
- Modify: `src/lib/product-categories/repository.ts`
- Modify: `src/lib/product-categories/client.ts`
- Modify corresponding tests under `src/lib/product-categories`
- Modify: `src/app/api/product-categories/[id]/route.ts`
- Modify: `src/app/api/product-categories/[id]/route.test.ts`

**Interfaces:**
- Produces: `ProductCategoryUpdate.isActive?: boolean`, repository `remove(actorId, id): Promise<string | null>`, service `deleteProductCategory(...) => Promise<{ id: string }>`, and client `remove(id): Promise<{ id: string }>`.

- [ ] **Step 1: Write failing boundary tests**

Cover:

```ts
expect(updateProductCategorySchema.parse({ isActive: false })).toEqual({ isActive: false });
await updateProductCategory(actor, id, { isActive: false }, dependencies);
expect(dependencies.categories.deactivate).toHaveBeenCalledWith(actor.id, id);
await expect(deleteProductCategory(actor, id, dependencies)).resolves.toEqual({ id });
expect(rpc).toHaveBeenCalledWith("delete_product_category", {
  actor_user_id: actor.id,
  target_category_id: id,
});
```

Route tests must prove `PATCH { isActive:false }` deactivates and `DELETE` calls physical deletion. Client tests must prove `deactivate` sends PATCH and `remove` sends DELETE.

- [ ] **Step 2: Run boundary tests and verify RED**

Run:

```bash
npm test -- src/lib/product-categories 'src/app/api/product-categories/[id]/route.test.ts'
```

- [ ] **Step 3: Implement minimal contracts**

- Change `ProductCategoryUpdate.isActive` from `true` to `boolean` and accept `z.boolean()`.
- In `updateProductCategory`, delegate `isActive === false` to `categories.deactivate(actor.id, id)`; otherwise call `categories.update`.
- Add repository `remove`, calling `delete_product_category` and returning its UUID or `null`.
- Map `PRODUCT_CATEGORY_HAS_PRODUCTS` and PostgreSQL `23503` to code `PRODUCT_CATEGORY_HAS_PRODUCTS`, status 409 and the approved public message.
- Add manager-only `deleteProductCategory` returning `{ id }` or the existing safe 404.
- Make Route Handler `DELETE` call `deleteProductCategory`; preserve authorization before path validation.
- Make browser `deactivate(id)` send PATCH `{ isActive:false }`; add `remove(id)` using DELETE.

- [ ] **Step 4: Run boundary tests, TypeScript and diff check**

```bash
npm test -- src/lib/product-categories 'src/app/api/product-categories/[id]/route.test.ts'
npx tsc --noEmit
git diff --check
```

- [ ] **Step 5: Commit Task 2**

```bash
git add src/types/product-category.ts src/lib/product-categories 'src/app/api/product-categories/[id]/route.ts' 'src/app/api/product-categories/[id]/route.test.ts'
git commit -m "feat(product-categories): expose deletion API"
```

---

### Task 3: Explicit category deletion confirmation

**Files:**
- Create: `src/components/products/product-category-delete-dialog.tsx`
- Create: `src/components/products/product-category-delete-dialog.test.tsx`

**Interfaces:**
- Produces: `ProductCategoryDeleteDialog({ category, onConfirm, onClose })` with isolated pending/error state.

- [ ] **Step 1: Write failing component tests**

Prove the dialog names the category, cancellation never calls `onConfirm`, confirmation calls it once, pending state blocks close/double submission, success closes, and rejection keeps the exact backend guidance visible.

- [ ] **Step 2: Run and verify RED**

Run `npm test -- src/components/products/product-category-delete-dialog.test.tsx`.

- [ ] **Step 3: Implement the confirmation dialog**

Follow `PaymentMethodDeleteDialog` with `Trash2` and this description:

```text
¿Querés eliminar “{name}” permanentemente? Sólo se eliminará si todavía no tiene productos asociados.
```

Use `Eliminando...`, `Cancelar`, `Eliminar categoría`, and preserve exact `Error.message` text.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/components/products/product-category-delete-dialog.test.tsx
git diff --check
git add src/components/products/product-category-delete-dialog.tsx src/components/products/product-category-delete-dialog.test.tsx
git commit -m "feat(product-categories): add deletion confirmation"
```

---

### Task 4: Active-first category administration

**Files:**
- Modify: `src/components/products/product-categories-dialog.tsx`
- Modify: `src/components/products/product-categories-dialog.test.tsx`
- Modify the parent injected client type where TypeScript requires `remove`

**Interfaces:**
- Consumes: `categoryClient.create`, `update`, `deactivate`, `remove`, and `ProductCategoryDeleteDialog`.
- Produces: separated active/inactive views, non-collapsing category cards and synchronized deletion.

- [ ] **Step 1: Write failing administration tests**

Prove inactive categories are hidden initially, `Ver desactivadas (1)` reveals them, deactivation moves a category out of active view without deleting parent state, reactivation restores it, deletion waits for confirmation and removes it from parent state, reference conflict retains it, and both views have empty states.

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/products/product-categories-dialog.test.tsx src/components/products/product-category-delete-dialog.test.tsx
```

- [ ] **Step 3: Implement the manager workspace**

Use the payment-method dialog's proven layout:

- vertical full-width create form;
- `showInactive`, `deleting`, `inactiveCount`, `visibleCategories` state;
- green `Activa` and orange `Inactiva` badges;
- cards with `Editar`, `Desactivar`/`Reactivar`, and accessible `Eliminar {name}`;
- `Ver desactivadas (N)` / `Volver a activas`;
- confirmation calls `categoryClient.remove(id)`, removes the category from `categories`, calls `onCategoriesChange`, and emits `Categoría eliminada correctamente.`;
- preserve blocked deactivation behavior for active products.

- [ ] **Step 4: Run the complete category slice**

```bash
npm test -- src/lib/product-categories src/app/api/product-categories src/components/products/product-categories-dialog.test.tsx src/components/products/product-category-delete-dialog.test.tsx
npx tsc --noEmit
git diff --check
```

- [ ] **Step 5: Commit Task 4**

```bash
git add src/components/products
git commit -m "feat(product-categories): manage inactive and deleted categories"
```

---

### Task 5: Product and deployment documentation

**Files:**
- Modify: `README.md`
- Modify: `product.md`
- Modify: `context_snapshot.md`

- [ ] **Step 1: Document delivered behavior**

Record migration `017`, the unused-only physical deletion rule, referenced-category conflict, UI behavior and ordered manual deployment `016` then `017`.

- [ ] **Step 2: Run full verification**

```bash
npm test -- --maxWorkers=2 --reporter=dot
npm run lint
npx tsc --noEmit
npm run build -- --webpack
git diff --check
```

- [ ] **Step 3: Validate the authenticated interface**

At 1280×720 and 390×844 verify active/inactive category views, named confirmation, no document/dialog overflow and no browser errors. Do not submit a real delete before migration `017` is installed.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md product.md context_snapshot.md
git commit -m "docs: document product category deletion"
```
