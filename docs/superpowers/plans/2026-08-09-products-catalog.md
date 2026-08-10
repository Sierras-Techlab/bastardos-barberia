# Products Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the authenticated, responsive `/products` read-only catalog for issue #16 using product-specific demonstration data.

**Architecture:** Keep the route as an async Server Component that authorizes the live session and passes validated mock data into one interactive client view. Pure helpers own fixture validation, filtering and metrics; focused presentation components render desktop and mobile variants without backend access.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Zod 4, Tailwind CSS, existing shadcn/base-ui primitives, Lucide icons, Vitest and Testing Library.

## Global Constraints

- The feature is frontend-only and must not add or call product APIs, Supabase or server persistence.
- The catalog is read-only; do not expose create, edit, delete, inventory or purchase controls.
- Display exact mock stock and derive `available`, `low-stock` and `out-of-stock`; stock is low from one through three units.
- `/products` must call `requirePageUser()` at the page boundary.
- Desktop uses a comparison table and mobile uses product cards with identical information.
- Product data comes from a products-specific JSON fixture.
- Use arrow functions for application components and helpers.
- Update `context_snapshot.md` and `product.md` when implementation is complete.

---

### Task 1: Product domain and demonstration fixture

**Files:**
- Create: `src/types/product.ts`
- Create: `src/data/products.mock.json`
- Create: `src/lib/products/product-catalog.ts`
- Test: `src/lib/products/product-catalog.test.ts`

**Interfaces:**
- Produces: `ProductStockStatus`, `CatalogProduct`, `ProductCatalogData`, `ProductCatalogFilters` and `ProductCatalogMetrics` types.
- Produces: `authorizeProductCatalogData(input: unknown): ProductCatalogData`.
- Produces: `filterProducts(products, filters): CatalogProduct[]`.
- Produces: `calculateProductMetrics(products): ProductCatalogMetrics`.
- Produces: `formatProductCategory(category): string`.

- [x] **Step 1: Write the failing domain tests**

Create focused tests that import the missing helpers and assert:

```ts
const data = authorizeProductCatalogData(productsMock);
expect(data.products).toHaveLength(12);
expect(data.products[0]).toMatchObject({
  id: expect.any(String),
  name: expect.any(String),
  category: expect.any(String),
  price: expect.any(Number),
  stock: expect.any(Number),
});

expect(filterProducts(data.products, {
  query: "barba",
  category: "all",
  stockStatus: "all",
})).toEqual(expect.arrayContaining([
  expect.objectContaining({ name: "Aceite para barba" }),
]));

expect(filterProducts(data.products, {
  query: "",
  category: "hair-care",
  stockStatus: "low-stock",
}).every((product) =>
  product.category === "hair-care" && product.stock > 0 && product.stock <= 3
)).toBe(true);

expect(calculateProductMetrics(data.products)).toEqual({
  totalProducts: 12,
  totalUnits: expect.any(Number),
  lowStockProducts: expect.any(Number),
  outOfStockProducts: expect.any(Number),
  categoryCount: expect.any(Number),
  averagePrice: expect.any(Number),
});
```

Add a malformed-fixture assertion that expects `authorizeProductCatalogData` to throw.

- [x] **Step 2: Run the domain test and verify RED**

Run: `npm test -- src/lib/products/product-catalog.test.ts`

Expected: FAIL because the product catalog module and fixture do not exist.

- [x] **Step 3: Add types, fixture and minimal helpers**

Define:

```ts
export type ProductStockStatus =
  | "available"
  | "low-stock"
  | "out-of-stock";
export type ProductCategory =
  | "hair-care"
  | "styling"
  | "beard-care"
  | "fragrance";

export type CatalogProduct = {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  stock: number;
};

export type ProductCatalogData = {
  isMock: true;
  products: CatalogProduct[];
};

export type ProductCatalogFilters = {
  query: string;
  category: ProductCategory | "all";
  stockStatus: ProductStockStatus | "all";
};

export type ProductCatalogMetrics = {
  totalProducts: number;
  totalUnits: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  categoryCount: number;
  averagePrice: number;
};
```

Use a strict Zod schema at the JSON boundary, normalize query text with `trim().toLocaleLowerCase("es-AR")`, and calculate the rounded mean price. Populate the fixture with the twelve products already used by the income form, classified across the four categories; include quantities that exercise available, low-stock and out-of-stock states.

- [x] **Step 4: Run the domain test and verify GREEN**

Run: `npm test -- src/lib/products/product-catalog.test.ts`

Expected: PASS with no warnings.

- [x] **Step 5: Commit the domain increment**

```bash
git add src/types/product.ts src/data/products.mock.json src/lib/products/product-catalog.ts src/lib/products/product-catalog.test.ts
git commit -m "feat(products): add mock catalog domain (#16)"
```

---

### Task 2: Interactive product catalog view

**Files:**
- Create: `src/components/products/product-metrics.tsx`
- Create: `src/components/products/product-filters.tsx`
- Create: `src/components/products/product-table.tsx`
- Create: `src/components/products/product-mobile-list.tsx`
- Create: `src/components/products/products-view.tsx`
- Test: `src/components/products/products-view.test.tsx`

**Interfaces:**
- Consumes: `ProductCatalogData`, `CatalogProduct`, `ProductCatalogFilters`, `filterProducts`, `calculateProductMetrics`, `formatProductCategory`.
- Produces: `ProductsView({ data }: { data: ProductCatalogData })`.

- [x] **Step 1: Write the failing interaction test**

Render `<ProductsView data={data} />` and assert that it:

```ts
expect(screen.getByRole("region", { name: /resumen de productos/i })).toBeVisible();
expect(screen.getByRole("table", { name: /catálogo de productos/i })).toBeVisible();
expect(screen.getAllByText("Hunter Cream").length).toBeGreaterThan(0);

await user.type(screen.getByRole("searchbox", { name: /buscar productos/i }), "barba");
expect(screen.getAllByText("Aceite para barba").length).toBeGreaterThan(0);
expect(screen.queryByText("Hunter Cream")).not.toBeInTheDocument();

await user.selectOptions(screen.getByLabelText(/categoría/i), "fragrance");
await user.selectOptions(screen.getByLabelText(/disponibilidad/i), "unavailable");
expect(screen.getByText(/no encontramos productos/i)).toBeVisible();

await user.click(screen.getByRole("button", { name: /limpiar filtros/i }));
expect(screen.getAllByText("Hunter Cream").length).toBeGreaterThan(0);
```

Also assert visible `Disponible` and `No disponible` badges, formatted ARS prices and mobile list semantics.

- [x] **Step 2: Run the view test and verify RED**

Run: `npm test -- src/components/products/products-view.test.tsx`

Expected: FAIL because the product components do not exist.

- [x] **Step 3: Implement the minimal responsive view**

Use `ProductsView` as the only client-state owner with this initial state:

```ts
const initialFilters: ProductCatalogFilters = {
  query: "",
  category: "all",
  stockStatus: "all",
};
```

Render four compact metrics: `Productos`, `Unidades en stock`, `Reponer pronto` and `Precio promedio`. Render the filters in one white rounded surface with a search input and native accessible selects. Use `ProductTable` inside `hidden md:block` and `ProductMobileList` inside `md:hidden`. Both representations show exact units plus the derived stock badge. Keep the same data in both because responsive CSS guarantees only one presentation is visible in the browser.

Use the existing `formatArs` helper for prices. Table columns are `Producto`, `Categoría`, `Disponibilidad` and right-aligned `Precio`. Mobile cards show the product/category on the left and price/status on the right. Add subtle hover elevation and focus-visible feedback without click handlers.

For empty results, render a `PackageSearch` icon, explanatory copy and a `Limpiar filtros` button that restores `initialFilters`.

- [x] **Step 4: Run the view test and verify GREEN**

Run: `npm test -- src/components/products/products-view.test.tsx`

Expected: PASS with no React warnings.

- [x] **Step 5: Run domain plus view regression tests**

Run: `npm test -- src/lib/products/product-catalog.test.ts src/components/products/products-view.test.tsx`

Expected: both files PASS.

- [x] **Step 6: Commit the view increment**

```bash
git add src/components/products
git commit -m "feat(products): build responsive catalog view (#16)"
```

---

### Task 3: Authenticated route and sidebar navigation

**Files:**
- Create: `src/app/(dashboard)/products/page.tsx`
- Test: `src/app/(dashboard)/products/page.test.tsx`
- Modify: `src/components/app-sidebar.tsx`
- Modify: `src/components/app-sidebar.test.tsx`

**Interfaces:**
- Consumes: `authorizeProductCatalogData`, products fixture, `ProductsView`, `requirePageUser`.
- Produces: authenticated `/products` route and active sidebar navigation.

- [x] **Step 1: Write the failing route and navigation tests**

Follow the existing `/incomes` page-test pattern. Mock `requirePageUser`, render the dashboard layout with the page and assert:

```ts
expect(screen.getByRole("heading", { name: "Productos" })).toBeVisible();
expect(screen.getByText(/catálogo de venta/i)).toBeVisible();
expect(screen.getByText(/datos de demostración/i)).toBeVisible();
expect(screen.getByRole("link", { name: /^productos$/i })).toHaveAttribute(
  "href",
  "/products",
);
expect(metadata.title).toBe("Productos");
```

Add separate assertions that `requirePageUser` is called once and a rejected authorization prevents rendering. Update the sidebar test mock pathname to `/products` and assert the Productos link has `data-active="true"`.

- [x] **Step 2: Run route/sidebar tests and verify RED**

Run: `npm test -- 'src/app/(dashboard)/products/page.test.tsx' src/components/app-sidebar.test.tsx`

Expected: FAIL because the route is missing and Productos has no href.

- [x] **Step 3: Implement the route and link**

Create an async arrow-function page with:

```ts
export const metadata: Metadata = {
  title: "Productos",
  description: "Consultá el catálogo de productos de Bastardos Barbería.",
};

const ProductsPage = async () => {
  await requirePageUser();
  return /* sticky header + ProductsView */;
};
```

Use the shared sticky header dimensions and `SidebarTrigger`; label the context `Catálogo · Agosto 2026`, render the demonstration badge, and introduce the page with `Catálogo de venta`, `Productos` and concise read-only copy. Do not render an add button. Change the Productos sidebar item to `{ label: "Productos", icon: Package, href: "/products" }`.

- [x] **Step 4: Run route/sidebar tests and verify GREEN**

Run: `npm test -- 'src/app/(dashboard)/products/page.test.tsx' src/components/app-sidebar.test.tsx`

Expected: both files PASS.

- [x] **Step 5: Commit the route increment**

```bash
git add 'src/app/(dashboard)/products' src/components/app-sidebar.tsx src/components/app-sidebar.test.tsx
git commit -m "feat(products): add authenticated catalog route (#16)"
```

---

### Task 4: Documentation and complete verification

**Files:**
- Modify: `context_snapshot.md`
- Modify: `product.md`

**Interfaces:**
- Documents the shipped frontend boundary and identifies persistent product/catalog modeling as future work.

- [x] **Step 1: Update operational context**

Set the current branch to `feat/16-products-view`. Add `/products` to current implementation as a responsive authenticated mock catalog with search, filters and desktop/mobile representations. Keep product CRUD, inventory and persistence in known boundaries. Preserve sales/cash persistence as the recommended next task unless repository state provides a newer priority.

- [x] **Step 2: Update product status**

Change `Services and products` from `Planned` to `Prototype` and describe the read-only mock catalog. Explicitly retain catalog persistence, prices, stock and inventory movements as planned backend work.

- [x] **Step 3: Run focused product tests**

Run:

```bash
npm test -- src/lib/products/product-catalog.test.ts src/components/products/products-view.test.tsx 'src/app/(dashboard)/products/page.test.tsx' src/components/app-sidebar.test.tsx
```

Expected: every focused product and navigation test PASS.

- [x] **Step 4: Run the full verification suite**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0, with no test failures, lint errors, TypeScript errors, build errors or whitespace errors.

- [x] **Step 5: Review the final diff**

Run: `git status --short && git diff --stat && git diff`

Confirm that no backend, Supabase, API or database file changed and no real credentials were added.

- [x] **Step 6: Commit documentation**

```bash
git add context_snapshot.md product.md docs/superpowers/plans/2026-08-09-products-catalog.md
git commit -m "docs(products): record catalog prototype (#16)"
```
