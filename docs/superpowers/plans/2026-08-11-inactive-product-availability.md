# Inactive Product Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show `No disponible` for every inactive product, even when it retains stock, in desktop and mobile manager catalogs.

**Architecture:** Preserve quantity-derived stock status for filters and metrics, and add a separate presentation-level availability derivation where inactivity has precedence. Both product renderers consume the same pure helper.

**Tech Stack:** React 19, TypeScript strict mode, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Inactive products remain visible to owner/admin and hidden from employees.
- Exact stock quantities and the existing `Inactivo` badge remain visible to managers.
- Stock filters and metrics continue using `getProductStockStatus(stock)` and must not treat inactivity as zero stock.
- No persistence, API or SQL changes are required.

---

### Task 1: Inactive-aware product presentation

**Files:**
- Modify: `src/types/product.ts`
- Modify: `src/lib/products/product-catalog.ts`
- Modify: `src/lib/products/product-catalog.test.ts`
- Modify: `src/components/products/product-table.tsx`
- Modify: `src/components/products/product-mobile-list.tsx`
- Modify: `src/components/products/products-view.test.tsx`

**Interfaces:**
- Produces: `ProductAvailabilityStatus = ProductStockStatus | "unavailable"`.
- Produces: `getProductAvailabilityStatus(product: Pick<CatalogProduct, "isActive" | "stock">): ProductAvailabilityStatus`.
- Preserves: `getProductStockStatus(stock: number): ProductStockStatus` for quantity-only filters and metrics.

- [ ] **Step 1: Write failing helper and component regression tests**

Add pure helper expectations:

```ts
expect(getProductAvailabilityStatus({ stock: 8, isActive: false })).toBe("unavailable");
expect(getProductAvailabilityStatus({ stock: 8, isActive: true })).toBe("available");
```

In the existing deactivate-flow test, scope assertions to Hunter Cream's desktop row and mobile list item after deactivation. Both must contain `No disponible` and neither may contain `Disponible`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/lib/products/product-catalog.test.ts src/components/products/products-view.test.tsx`

Expected: FAIL because the inactive-aware helper and label do not exist.

- [ ] **Step 3: Implement the minimal availability derivation**

Add the type and helper:

```ts
export const getProductAvailabilityStatus = (
  product: Pick<CatalogProduct, "isActive" | "stock">,
): ProductAvailabilityStatus =>
  product.isActive ? getProductStockStatus(product.stock) : "unavailable";
```

Use it in both product renderers. Map `unavailable` to `No disponible` and a neutral gray badge; keep active `available`, `low-stock`, and `out-of-stock` styles and labels unchanged.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/lib/products/product-catalog.test.ts src/components/products/products-view.test.tsx`

Expected: helper, desktop and mobile regressions pass without changing filtering tests.

- [ ] **Step 5: Commit the product presentation fix**

```bash
git add src/types/product.ts src/lib/products/product-catalog.ts src/lib/products/product-catalog.test.ts src/components/products/product-table.tsx src/components/products/product-mobile-list.tsx src/components/products/products-view.test.tsx
git commit -m "fix(products): mark inactive items unavailable"
```

### Task 2: Documentation and full verification

**Files:**
- Modify: `context_snapshot.md`
- Modify: `product.md`

**Interfaces:**
- Records the deployed dashboard activity and inactive-product presentation behavior.

- [ ] **Step 1: Update operational and product state**

Record that recent income/customer activity is persistent, expense activity remains mocked, and inactive manager-visible products show `No disponible` independently of retained stock. Update the exact final test count only after the complete suite runs.

- [ ] **Step 2: Run the complete verification suite**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: zero failing tests, ESLint exits 0 without warnings, Next.js production build exits 0, and `git diff --check` emits no output.

- [ ] **Step 3: Review scope and repository state**

Run `git status --short` and `git diff`. Confirm only the planned application, test and documentation files changed; no SQL or unrelated mock sections changed.

- [ ] **Step 4: Commit documentation**

```bash
git add context_snapshot.md product.md
git commit -m "docs(dashboard): record persisted recent activity"
```
