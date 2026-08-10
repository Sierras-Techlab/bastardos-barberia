# Mock Product Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner/admin-only in-memory product management, exact stock workflows and stock/price sorting to `/products` for issue #16.

**Architecture:** The authenticated Server Component derives a `canManage` capability and passes it to the existing client catalog. `ProductsView` becomes the in-memory source of truth; pure domain helpers validate and sort products, while focused shadcn/ui dialogs handle editing, stock adjustment and activation without any backend call.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, React Hook Form, Zod 4, existing shadcn/base-ui components, Tailwind CSS, Lucide icons, Vitest and Testing Library.

## Global Constraints

- Product mutations remain frontend-only and reset after a page reload/remount.
- Do not add or modify APIs, Supabase clients, database types or SQL.
- Only `owner` and `admin` receive management controls; `employee` remains read-only.
- Future backend operations must reauthorize managers independently; `canManage` is presentation-only.
- Do not physically delete products.
- Stock changes occur only through explicit entry/exit adjustments.
- A stock exit cannot produce a negative quantity.
- Desktop stock and price sorting cycle ascending, descending and original order.
- Mobile exposes original, stock ascending/descending and price ascending/descending choices.
- Use arrow functions for application components and helpers.

---

### Task 1: Management domain, validation and sorting

**Files:**
- Modify: `src/types/product.ts`
- Modify: `src/data/products.mock.json`
- Modify: `src/lib/products/product-catalog.ts`
- Modify: `src/lib/products/product-catalog.test.ts`
- Create: `src/lib/products/product-management.ts`
- Test: `src/lib/products/product-management.test.ts`

**Interfaces:**
- Add `isActive: boolean` to `CatalogProduct`.
- Add `activeState: "all" | "active" | "inactive"` to `ProductCatalogFilters`.
- Produce `ProductSort = "original" | "stock-asc" | "stock-desc" | "price-asc" | "price-desc"`.
- Produce `sortProducts(products, sort): CatalogProduct[]` without mutating input.
- Produce `productEditorSchema`, `stockAdjustmentSchema`, `validateUniqueProductName` and `applyStockAdjustment`.

- [x] **Step 1: Write failing management-domain tests**

Test observable contracts with literals:

```ts
expect(productEditorSchema.safeParse({
  name: "",
  category: "styling",
  price: 12000,
  stock: 2,
}).success).toBe(false);

expect(validateUniqueProductName(" hunter cream ", products)).toBe(
  "Ya existe un producto con ese nombre.",
);

expect(applyStockAdjustment(8, { kind: "entry", quantity: 3 })).toBe(11);
expect(applyStockAdjustment(8, { kind: "exit", quantity: 3 })).toBe(5);
expect(() => applyStockAdjustment(2, { kind: "exit", quantity: 3 })).toThrow(
  "No podés descontar más unidades que el stock disponible.",
);

expect(sortProducts(products, "stock-asc").map((product) => product.stock))
  .toEqual([0, 2, 3, 5, 8, 9, 10, 11, 12, 13, 14, 16]);
expect(sortProducts(products, "price-desc")[0].price).toBe(30000);
expect(sortProducts(products, "original").map(({ id }) => id))
  .toEqual(products.map(({ id }) => id));
```

Also assert that sorting does not mutate the input and that an edit may retain its own normalized name while still rejecting another product's name.

- [x] **Step 2: Run tests and verify RED**

Run: `npm test -- src/lib/products/product-management.test.ts src/lib/products/product-catalog.test.ts`

Expected: FAIL because management types/helpers and `isActive` do not exist.

- [x] **Step 3: Implement domain behavior**

Add these types:

```ts
export type ProductActiveState = "all" | "active" | "inactive";
export type ProductSort =
  | "original"
  | "stock-asc"
  | "stock-desc"
  | "price-asc"
  | "price-desc";

export type ProductEditorInput = {
  name: string;
  category: ProductCategory;
  price: number;
  stock: number;
};

export type StockAdjustment = {
  kind: "entry" | "exit";
  quantity: number;
};
```

Use Zod preprocessors for numeric form inputs with exact Spanish messages from the spec. Normalize duplicate comparisons with trim plus `toLocaleLowerCase("es-AR")`. `sortProducts` must return a copied array and rely on stable JavaScript sorting so equal values keep insertion order. Extend catalog filtering with optional active state and add `isActive` to every strict fixture record, including at least one inactive item.

- [x] **Step 4: Run domain tests and verify GREEN**

Run: `npm test -- src/lib/products/product-management.test.ts src/lib/products/product-catalog.test.ts`

Expected: both files PASS.

- [x] **Step 5: Commit the domain increment**

```bash
git add src/types/product.ts src/data/products.mock.json src/lib/products
git commit -m "feat(products): add mock management domain (#16)"
```

---

### Task 2: Role capability, filtering and responsive sorting

**Files:**
- Modify: `src/app/(dashboard)/products/page.tsx`
- Modify: `src/app/(dashboard)/products/page.test.tsx`
- Modify: `src/components/products/products-view.tsx`
- Modify: `src/components/products/products-view.test.tsx`
- Modify: `src/components/products/product-filters.tsx`
- Modify: `src/components/products/product-table.tsx`
- Modify: `src/components/products/product-mobile-list.tsx`

**Interfaces:**
- Change `ProductsView` props to `{ data: ProductCatalogData; canManage: boolean }`.
- Add `sort`, `onSortChange`, `canManage` and optional management callbacks to presentation components.
- Pass `canManage={user.role.name === "owner" || user.role.name === "admin"}` from the page.

- [x] **Step 1: Write failing capability and sorting tests**

Update page tests with an owner and an employee response. Assert the owner sees `Nuevo producto`, the employee does not, and the employee cannot see the inactive fixture product.

In the client view test, click desktop `Stock` and assert product row names in ascending order, click again for descending, and click a third time to restore insertion order. Repeat price behavior through `Ordenar por`:

```ts
await user.click(screen.getByRole("button", { name: /ordenar por stock/i }));
expect(readDesktopProductNames()).toEqual(expectedStockAscendingNames);
await user.click(screen.getByRole("button", { name: /ordenar por stock/i }));
expect(readDesktopProductNames()).toEqual(expectedStockDescendingNames);
await user.click(screen.getByRole("button", { name: /ordenar por stock/i }));
expect(readDesktopProductNames()).toEqual(originalNames);

await user.selectOptions(screen.getByLabelText("Ordenar por"), "price-desc");
expect(readMobileProductNames()[0]).toBe("Hunter Cream");
```

- [x] **Step 2: Run page/view tests and verify RED**

Run: `npm test -- 'src/app/(dashboard)/products/page.test.tsx' src/components/products/products-view.test.tsx`

Expected: FAIL because the capability and sorting controls are absent.

- [x] **Step 3: Implement capability, active filtering and sorting**

Destructure `{ user }` from `requirePageUser()`. Render `Nuevo producto` only for managers and pass the capability into `ProductsView`. Initialize products with `useState(() => data.products)` and sort after filtering:

```ts
const visibleProducts = canManage
  ? products
  : products.filter((product) => product.isActive);
const displayedProducts = sortProducts(
  filterProducts(visibleProducts, filters),
  sort,
);
```

Managers receive an active-state select; employees do not. Add a reusable three-state `nextColumnSort` helper or equivalent pure transition. Desktop headers expose buttons with `aria-sort`; mobile exposes a native sort select. Show an `Inactivo` badge to managers in both responsive presentations.

- [x] **Step 4: Run page/view tests and verify GREEN**

Run: `npm test -- 'src/app/(dashboard)/products/page.test.tsx' src/components/products/products-view.test.tsx`

Expected: both files PASS.

- [x] **Step 5: Commit capability and sorting**

```bash
git add 'src/app/(dashboard)/products' src/components/products
git commit -m "feat(products): add role-aware catalog sorting (#16)"
```

---

### Task 3: Create and edit workflows

**Files:**
- Create: `src/components/products/product-editor-dialog.tsx`
- Test: `src/components/products/product-editor-dialog.test.tsx`
- Create: `src/components/products/product-actions.tsx`
- Modify: `src/components/products/products-view.tsx`
- Modify: `src/components/products/products-view.test.tsx`
- Modify: `src/components/products/product-table.tsx`
- Modify: `src/components/products/product-mobile-list.tsx`

**Interfaces:**
- Produce `ProductEditorDialog({ mode, product, products, open, onClose, onSave })`.
- Produce `ProductActions({ product, onEdit, onAdjustStock, onToggleStatus })`.
- `onSave(input)` creates or updates the in-memory collection synchronously.

- [x] **Step 1: Write failing editor tests**

Cover create, edit, validation and cancellation:

```ts
await user.click(screen.getByRole("button", { name: "Nuevo producto" }));
await user.type(screen.getByLabelText("Nombre"), "Pomada mate");
await user.selectOptions(screen.getByLabelText("Categoría"), "styling");
await user.type(screen.getByLabelText("Precio"), "14500");
await user.type(screen.getByLabelText("Stock inicial"), "6");
await user.click(screen.getByRole("button", { name: "Crear producto" }));
expect(screen.getAllByText("Pomada mate").length).toBeGreaterThan(0);
expect(screen.getAllByText("6 unidades").length).toBeGreaterThan(0);
```

Attempt `Hunter Cream` and assert the duplicate message. Open `Editar` for a known product, change name/price/category, save, and assert stock remains unchanged. Open and cancel another edit and assert no mutation. Unmount and rerender with fixture data to prove reset behavior.

- [x] **Step 2: Run editor/view tests and verify RED**

Run: `npm test -- src/components/products/product-editor-dialog.test.tsx src/components/products/products-view.test.tsx`

Expected: FAIL because editor/actions do not exist.

- [x] **Step 3: Implement create/edit dialogs and row actions**

Use React Hook Form with `zodResolver(productEditorSchema)`. In edit mode hide the initial-stock field and preserve `product.stock`. Render field errors with `role="alert"`. Use a monotonic client-only identifier such as `mock-product-${nextIdRef.current++}` after checking existing IDs.

`ProductActions` uses the existing dropdown menu and a rounded icon button labelled `Gestionar <product name>`. Render it in the table action column and mobile card. The menu's status action label reflects `isActive`.

- [x] **Step 4: Run editor/view tests and verify GREEN**

Run: `npm test -- src/components/products/product-editor-dialog.test.tsx src/components/products/products-view.test.tsx`

Expected: both files PASS without React or dialog warnings.

- [ ] **Step 5: Commit create/edit workflows**

```bash
git add src/components/products
git commit -m "feat(products): add mock create and edit workflows (#16)"
```

---

### Task 4: Stock adjustment and active-state workflows

**Files:**
- Create: `src/components/products/product-stock-dialog.tsx`
- Test: `src/components/products/product-stock-dialog.test.tsx`
- Create: `src/components/products/product-status-dialog.tsx`
- Test: `src/components/products/product-status-dialog.test.tsx`
- Modify: `src/components/products/products-view.tsx`
- Modify: `src/components/products/products-view.test.tsx`

**Interfaces:**
- Produce `ProductStockDialog({ product, open, onClose, onConfirm })`.
- Produce `ProductStatusDialog({ product, open, onClose, onConfirm })`.
- `onConfirm` callbacks synchronously mutate only the matching product in view state.

- [x] **Step 1: Write failing stock/status tests**

Test entry from 8 to 11, exit from 8 to 5, rejection of exit 9 from stock 8, and live preview text. With stock sorting active, adjust a product and assert it moves to the correct ordered position.

Deactivate a product and assert the manager still sees it with `Inactivo`; remount as employee and assert it is absent. Reactivate and assert the badge disappears. Closing either dialog must preserve state.

- [x] **Step 2: Run stock/status tests and verify RED**

Run: `npm test -- src/components/products/product-stock-dialog.test.tsx src/components/products/product-status-dialog.test.tsx src/components/products/products-view.test.tsx`

Expected: FAIL because both dialogs are absent.

- [x] **Step 3: Implement stock and status dialogs**

The stock dialog uses radio-like buttons or a select for `Entrada`/`Salida`, a number input with `min=1`, and a preview:

```text
Stock actual: 8
Stock resultante: 5
```

Call `applyStockAdjustment` on submit and surface its exact excessive-exit message. The status dialog uses explicit copy (`Desactivar producto` / `Activar producto`) and notes that deactivation preserves history. Update the selected product reference after mutations or close dialogs immediately to avoid stale objects.

- [x] **Step 4: Run stock/status tests and verify GREEN**

Run: `npm test -- src/components/products/product-stock-dialog.test.tsx src/components/products/product-status-dialog.test.tsx src/components/products/products-view.test.tsx`

Expected: all files PASS.

- [ ] **Step 5: Commit stock/status workflows**

```bash
git add src/components/products
git commit -m "feat(products): add mock stock and status management (#16)"
```

---

### Task 5: Documentation and complete verification

**Files:**
- Modify: `context_snapshot.md`
- Modify: `product.md`
- Modify: `docs/superpowers/specs/2026-08-09-products-management-design.md` only if implementation decisions changed.
- Track: `docs/superpowers/plans/2026-08-09-products-management.md`

- [x] **Step 1: Update project state**

Document owner/admin-only mock create/edit/stock/status management, responsive sorting, employee read-only behavior and reload reset. Keep backend authorization, persistence and movement audit history explicitly deferred.

- [x] **Step 2: Run focused product tests**

Run:

```bash
npm test -- src/lib/products src/components/products 'src/app/(dashboard)/products/page.test.tsx'
```

Expected: every product-domain, component and route test PASS.

- [x] **Step 3: Run complete verification**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

If Turbopack cannot bind its internal sandbox port, record that exact environment failure and run `npx next build --webpack`; do not report the Turbopack build as passing.

- [x] **Step 4: Review the final diff**

Run: `git status --short && git diff --stat && git diff`

Confirm no API, Supabase, SQL or credential file changed and every mutation remains in client state.

- [ ] **Step 5: Commit documentation**

```bash
git add context_snapshot.md product.md docs/superpowers/plans/2026-08-09-products-management.md
git commit -m "docs(products): record mock management prototype (#16)"
```
