# Product Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded product categories with an audited, manager-administered catalog while migrating every existing product to a canonical foreign key.

**Architecture:** Add a focused category domain matching existing product/service repository patterns, expose manager mutation routes and load category records into `/products`. Migration `014` seeds the four current values, backfills products, validates references and removes the legacy text column.

**Tech Stack:** Next.js 16.3 Route Handlers, PostgreSQL, Supabase, TypeScript, Zod, React, Vitest, Testing Library and Sonner.

## Global Constraints

- Run after migration `013`.
- Read the local Next.js Route Handler and dynamic-route guides before creating API files.
- Category names are globally unique after normalization, including inactive records.
- `DELETE` means logical deactivation; physical deletion is forbidden.
- A category with active products cannot be deactivated.
- Managers see inactive categories; employee product reads expose active categories only.

---

### Task 1: Define the category domain with TDD

**Files:**

- Create: `src/types/product-category.ts`
- Create: `src/lib/product-categories/schemas.ts`
- Create: `src/lib/product-categories/schemas.test.ts`
- Create: `src/lib/product-categories/contracts.ts`
- Create: `src/lib/product-categories/repository.ts`
- Create: `src/lib/product-categories/repository.test.ts`
- Create: `src/lib/product-categories/service.ts`
- Create: `src/lib/product-categories/service.test.ts`

**Interfaces:**

- Produces:

```ts
export type ProductCategory = {
  id: string;
  name: string;
  isActive: boolean;
};
export type ProductCategoryInput = { name: string };
export type ProductCategoryUpdate = { name?: string; isActive?: boolean };
```

Repository operations: `list(includeInactive)`, `findById(id)`, `create(actorId,input)`, `update(actorId,id,input)` and `deactivate(actorId,id)`.

- [ ] **Step 1: Write schema and service authorization tests**

Assert trimmed names of 1–80 characters, strict payloads, manager-only create/update/deactivate, employee active-only list and not-found behavior.

- [ ] **Step 2: Write repository contract tests**

Assert exact canonical table/RPC fields, complete row mapping and sentinel mappings:

```ts
expect(rpc).toHaveBeenCalledWith("deactivate_product_category", {
  actor_user_id: manager.id,
  target_category_id: category.id,
});
```

Map `PRODUCT_CATEGORY_NAME_EXISTS` and `PRODUCT_CATEGORY_IN_USE` to HTTP 409.

- [ ] **Step 3: Run RED**

```bash
npm test -- --run src/lib/product-categories/schemas.test.ts src/lib/product-categories/repository.test.ts src/lib/product-categories/service.test.ts
```

Expected: missing modules.

- [ ] **Step 4: Implement the domain and run GREEN**

Implement the exact interfaces, server-only repository, strict Zod schemas, `assertManager` mutations and safe errors. Rerun Step 3. Expected: pass.

### Task 2: Add category Route Handlers and client

**Files:**

- Create: `src/app/api/product-categories/route.ts`
- Create: `src/app/api/product-categories/route.test.ts`
- Create: `src/app/api/product-categories/[id]/route.ts`
- Create: `src/app/api/product-categories/[id]/route.test.ts`
- Create: `src/lib/product-categories/client.ts`
- Create: `src/lib/product-categories/client.test.ts`

**Interfaces:**

- `GET /api/product-categories` returns `{ categories: ProductCategory[] }`.
- `GET /api/product-categories/[id]` returns one category or 404.
- `POST` returns one category with 201.
- `PATCH` renames/reactivates and returns one category.
- `DELETE` deactivates and returns one category.

- [ ] **Step 1: Write failing route/client tests**

Assert `requireUser` for GET, `requireManager` for mutations, awaited Next 16 `params`, strict ID/body parsing and error response propagation.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run src/app/api/product-categories/route.test.ts "src/app/api/product-categories/[id]/route.test.ts" src/lib/product-categories/client.test.ts
```

- [ ] **Step 3: Implement handlers/client and run GREEN**

Follow the existing products Route Handler shape; use `successResponse`/`errorResponse` and no Supabase import in the client. Rerun Step 2.

### Task 3: Migrate product contracts from category strings to objects

**Files:**

- Modify: `src/types/product.ts`
- Modify: `src/lib/products/schemas.ts`
- Modify: `src/lib/products/contracts.ts`
- Modify: `src/lib/products/repository.ts`
- Modify: `src/lib/products/repository.test.ts`
- Modify: `src/lib/products/product-catalog.ts`
- Modify: `src/lib/products/product-catalog.test.ts`
- Modify: `src/lib/products/client.test.ts`
- Modify: `src/lib/products/service.test.ts`
- Modify: `src/lib/products/product-management.test.ts`
- Modify: `src/data/products.mock.json`
- Modify: `src/app/api/products/route.test.ts`
- Modify: `src/app/api/products/[id]/route.test.ts`
- Modify: `src/components/products/product-stock-dialog.test.tsx`
- Modify: `src/components/products/product-status-dialog.test.tsx`

**Interfaces:**

- `CatalogProduct.category: ProductCategory`.
- Create/update payloads use `categoryId: string`.
- Product select joins `category:product_categories(id,name,is_active)`.
- Filters use `categoryId | "all"`.

- [ ] **Step 1: Change tests to the new object/ID contract and run RED**

```ts
expect(product.category).toEqual({ id: categoryId, name: "Cuidado capilar", isActive: true });
expect(rpc).toHaveBeenCalledWith("create_product", expect.objectContaining({ product_category_id: categoryId }));
```

Run:

```bash
npm test -- --run src/lib/products/repository.test.ts src/lib/products/product-catalog.test.ts src/lib/products/client.test.ts src/lib/products/service.test.ts
```

- [ ] **Step 2: Implement product contract changes and run GREEN**

Remove the TypeScript category union/label map, validate UUID `categoryId`, map the joined category object and filter by category ID. Replace direct product updates with canonical `update_product`, mapping inactive/missing category sentinels safely. Convert the shared product JSON fixture and every product/API/dialog fixture to the complete category object. Rerun Step 1.

### Task 4: Add category administration UI

**Files:**

- Create: `src/components/products/product-categories-dialog.tsx`
- Create: `src/components/products/product-categories-dialog.test.tsx`
- Modify: `src/components/products/products-view.tsx`
- Modify: `src/components/products/products-view.test.tsx`
- Modify: `src/components/products/product-editor-dialog.tsx`
- Modify: `src/components/products/product-editor-dialog.test.tsx`
- Modify: `src/components/products/product-filters.tsx`
- Modify: `src/components/products/product-filters.test.tsx`
- Modify: `src/components/products/product-table.tsx`
- Modify: `src/components/products/product-mobile-list.tsx`
- Modify: `src/app/(dashboard)/products/page.tsx`
- Modify: `src/app/(dashboard)/products/page.test.tsx`

**Interfaces:**

- `ProductsView` receives `categories: ProductCategory[]` and optional category client.
- Only `canManage` users see `Administrar categorías`.

- [ ] **Step 1: Write failing dialog/page/editor tests**

Cover create, rename, deactivate conflict display, reactivation, active-only editor options and dynamic filter labels. Assert employees never see the manager action.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run src/components/products/product-categories-dialog.test.tsx src/components/products/products-view.test.tsx src/components/products/product-editor-dialog.test.tsx src/components/products/product-filters.test.tsx "src/app/(dashboard)/products/page.test.tsx"
```

- [ ] **Step 3: Implement the modal/table and dynamic selectors**

Use existing Dialog, Button, Input and Sonner patterns. Keep mutation state local, replace category records from API responses and disable deactivation when the server returns `PRODUCT_CATEGORY_IN_USE`.

- [ ] **Step 4: Run GREEN**

Rerun Step 2. Expected: pass.

### Task 5: Create migration 014 and verify the full category slice

**Files:**

- Create: `supabase/queries/014_product_categories.sql`
- Modify: `supabase/queries/README.md`
- Modify: `src/lib/supabase/database.types.ts`

**Interfaces:**

- Produces: `product_categories`, `products.category_id`, canonical category lifecycle functions and revised `create_product(product_category_id uuid, ...)`.

- [ ] **Step 1: Write the transactional migration**

Create the audited table, normalized-name trigger, indexes, RLS and service-role grants. Insert the four fixed seed rows, backfill by exact old text value, assert no product has a null category, add `NOT NULL`/FK, then drop `products.category` and `products_category_check`. Install canonical `create_product` and `update_product` functions that lock the category row `FOR SHARE`, require it active and then mutate the product. Category deactivation locks the category first and rejects active references, preserving a consistent category-first lock order.

- [ ] **Step 2: Add SQL acceptance blocks**

Prove four mapped categories, zero orphan products, duplicate-name conflict, manager-only mutation and `PRODUCT_CATEGORY_IN_USE` for an active product.

- [ ] **Step 3: Run complete focused verification**

```bash
npm test -- --run src/lib/product-categories src/app/api/product-categories src/app/api/products src/lib/products src/components/products "src/app/(dashboard)/products/page.test.tsx"
npx tsc --noEmit
git diff --check
```

- [ ] **Step 4: Commit**

```bash
git add supabase/queries/014_product_categories.sql supabase/queries/README.md src/lib/supabase/database.types.ts src/types/product.ts src/types/product-category.ts src/lib/product-categories src/app/api/product-categories src/lib/products src/components/products "src/app/(dashboard)/products/page.tsx" "src/app/(dashboard)/products/page.test.tsx"
git commit -m "feat(products): add administrable categories"
```
