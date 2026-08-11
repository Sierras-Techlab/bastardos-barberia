# Products and Inventory Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/products` mock with a persistent, role-authorized product catalog and an auditable stock ledger.

**Architecture:** A new `008_products_inventory.sql` script owns the database schema and atomic stock functions. Server-only repository and service modules translate Supabase rows into the existing catalog DTOs; Route Handlers expose authenticated mutations, while the Server Component loads the initial catalog directly and the Client Component uses a narrow API client for updates.

**Tech Stack:** Next.js 16.3 App Router and Route Handlers, React 19.2, strict TypeScript, Supabase PostgreSQL through `SUPABASE_SECRET_KEY`, Zod 4, Vitest 4 and Testing Library.

## Global Constraints

- Read the relevant guides in `node_modules/next/dist/docs/` before changing framework code; Route Handler params are promises in this installed Next.js version.
- Browser code must never import `@/lib/supabase/admin` or receive audit identifiers.
- Only owner/admin may mutate products; employees may read active products only.
- Product names remain unique across active and inactive records.
- Stock, price and quantities are integer values; stock may never become negative.
- Product creation and every stock adjustment record the authenticated actor.
- Product removal is out of scope; lifecycle changes use `is_active`.
- Do not execute SQL against Supabase, run the owner bootstrap or modify credentials.
- Preserve the existing responsive catalog, filters, sorting, metrics, dialogs and Sonner success feedback.
- Use TDD for behavior changes and commit after every completed task.
- SQL migration files are the sole TDD exception: no local PostgreSQL/Docker runtime is available and remote execution is prohibited, so their behavior is verified by rollback-safe queries documented for the user; every TypeScript consumer is still developed RED/GREEN.

---

### Task 1: Database contract and installation script

**Files:**
- Create: `supabase/queries/008_products_inventory.sql`
- Modify: `supabase/queries/README.md`
- Modify: `src/lib/supabase/database.types.ts`

**Interfaces:**
- Consumes: `public.users(id)` and `service_role` security conventions from scripts `001` through `007`.
- Produces: `products`, `inventory_movements`, `create_product(...)` and `adjust_product_stock(...)` for the product repository.

- [x] **Step 1: Add the complete SQL schema and atomic functions**

Implement these exact database contracts in `008_products_inventory.sql`:

```sql
public.products(
  id uuid primary key,
  name text,
  normalized_name text unique,
  category text check (category in ('hair-care','styling','beard-care','fragrance')),
  price integer check (price >= 0),
  stock integer check (stock >= 0),
  is_active boolean,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz,
  updated_at timestamptz
)

public.inventory_movements(
  id uuid primary key,
  product_id uuid references public.products(id),
  movement_type text check (movement_type in ('initial','entry','exit','sale','sale_void')),
  quantity_delta integer check (quantity_delta <> 0),
  stock_after integer check (stock_after >= 0),
  user_id uuid references public.users(id),
  created_at timestamptz
)
```

Add a database-maintained normalized product name, indexes for active/name/catalog and product movement history, manager-agnostic service-role functions that accept an actor UUID, row locking in `adjust_product_stock`, sanitized sentinel errors `PRODUCT_NAME_EXISTS`, `PRODUCT_NOT_FOUND` and `INSUFFICIENT_STOCK`, RLS, revoked browser access and service-role grants. End the file with read-only verification queries.

Update `database.types.ts` with `ProductRow` and `InventoryMovementRow`. Update the README execution order and verification table list.

- [x] **Step 2: Review the rollback-safe verification block and run the local whitespace check**

Confirm the script ends with read-only catalog/security queries plus `begin;` / sample RPC calls / assertions / `rollback;` instructions that the user can execute after installation without retaining sample data.

Run: `git diff --check`

Expected: no output.

- [x] **Step 3: Commit the database contract**

```bash
git add supabase/queries/008_products_inventory.sql supabase/queries/README.md src/lib/supabase/database.types.ts
git commit -m "feat(products): add inventory database contract"
```

### Task 2: Product validation and domain service

**Files:**
- Create: `src/lib/products/schemas.ts`
- Create: `src/lib/products/contracts.ts`
- Create: `src/lib/products/service.ts`
- Create: `src/lib/products/service.test.ts`
- Modify: `src/types/product.ts`
- Modify: `src/lib/products/product-catalog.ts`
- Modify: `src/lib/products/product-management.ts`
- Modify: `src/lib/products/product-management.test.ts`

**Interfaces:**
- Consumes: `SafeUser`, `assertManager` and the existing `CatalogProduct` presentation shape.
- Produces: `ProductRepository`, public Zod schemas and service functions used by pages and Route Handlers.

- [x] **Step 1: Write failing schema and service tests**

Test these exact behaviors:

```ts
expect(createProductSchema.parse({
  name: " Gel ", category: "styling", price: 9900, stock: 4,
})).toEqual({ name: "Gel", category: "styling", price: 9900, stock: 4 });

await expect(createProduct(employee, validInput, deps))
  .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

await createProduct(owner, validInput, deps);
expect(deps.products.create).toHaveBeenCalledWith({
  ...validInput,
  createdBy: owner.id,
});

await adjustProductStock(owner, productId, { kind: "exit", quantity: 2 }, deps);
expect(deps.products.adjustStock).toHaveBeenCalledWith(
  productId,
  owner.id,
  { kind: "exit", quantity: 2 },
);
```

Also cover empty PATCH rejection, UUID IDs, invalid category/price/stock, employees receiving active products only, managers receiving all products, missing records and stable domain errors.

- [x] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/lib/products/service.test.ts src/lib/products/product-management.test.ts`

Expected: FAIL because the schemas, contracts and service do not exist.

- [x] **Step 3: Implement the public contracts and service**

Define:

```ts
export type ProductRepository = {
  list(includeInactive: boolean): Promise<CatalogProduct[]>;
  findById(id: string): Promise<CatalogProduct | null>;
  create(input: ProductCreateRecord): Promise<CatalogProduct>;
  update(id: string, changes: ProductUpdateRecord): Promise<CatalogProduct | null>;
  adjustStock(id: string, actorId: string, input: StockAdjustment): Promise<CatalogProduct | null>;
};

export type ProductServiceDependencies = { products: ProductRepository };

export const listProducts: (actor: SafeUser, deps?: ProductServiceDependencies) => Promise<ProductCatalogData>;
export const createProduct: (actor: SafeUser, input: CreateProductInput, deps?: ProductServiceDependencies) => Promise<CatalogProduct>;
export const updateProduct: (actor: SafeUser, id: string, input: UpdateProductInput, deps?: ProductServiceDependencies) => Promise<CatalogProduct>;
export const adjustProductStock: (actor: SafeUser, id: string, input: StockAdjustment, deps?: ProductServiceDependencies) => Promise<CatalogProduct>;
```

Change `ProductCatalogData` from `{ isMock: true; products: ... }` to `{ products: ... }`. Keep pure presentation filtering/sorting functions. Re-export or reuse the Zod input schemas so UI and API validation cannot drift.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/lib/products/service.test.ts src/lib/products/product-management.test.ts src/lib/products/product-catalog.test.ts`

Expected: PASS.

- [x] **Step 5: Commit validation and services**

```bash
git add src/types/product.ts src/lib/products
git commit -m "feat(products): add product domain service"
```

### Task 3: Supabase product repository

**Files:**
- Create: `src/lib/products/repository.ts`
- Create: `src/lib/products/repository.test.ts`

**Interfaces:**
- Consumes: `ProductRepository`, `ProductRow`, `getSupabaseAdmin()` and SQL RPC names from Task 1.
- Produces: `productRepository`, the default persistence dependency for the service.

- [x] **Step 1: Write failing repository tests**

Mock `getSupabaseAdmin()` and assert:

```ts
expect(toCatalogProduct(row)).toEqual({
  id: row.id,
  name: row.name,
  category: row.category,
  price: row.price,
  stock: row.stock,
  isActive: row.is_active,
});

await productRepository.create(record);
expect(admin.rpc).toHaveBeenCalledWith("create_product", {
  product_name: record.name,
  product_category: record.category,
  product_price: record.price,
  initial_stock: record.stock,
  actor_user_id: record.createdBy,
});
```

Cover active-only and manager listing, update audit values, entry/exit RPC mapping, missing rows, normalized-name conflict mapping and insufficient-stock mapping.

- [x] **Step 2: Run the repository test and verify RED**

Run: `npm test -- src/lib/products/repository.test.ts`

Expected: FAIL because `repository.ts` does not exist.

- [x] **Step 3: Implement the server-only repository**

Add `import "server-only";`, a safe select string, `toCatalogProduct`, sanitized `productDatabaseFailure`, RPC calls followed by exact-ID reads, and direct profile/status updates that always set `updated_by`. Map SQL sentinel messages to `AppError` codes defined by Task 2.

Do not export raw rows and do not use the browser Supabase roles.

- [x] **Step 4: Run repository and service tests**

Run: `npm test -- src/lib/products/repository.test.ts src/lib/products/service.test.ts`

Expected: PASS.

- [x] **Step 5: Commit the repository**

```bash
git add src/lib/products/repository.ts src/lib/products/repository.test.ts src/lib/products/service.ts
git commit -m "feat(products): persist catalog operations"
```

### Task 4: Authenticated product Route Handlers

**Files:**
- Create: `src/app/api/products/route.ts`
- Create: `src/app/api/products/route.test.ts`
- Create: `src/app/api/products/[id]/route.ts`
- Create: `src/app/api/products/[id]/route.test.ts`
- Create: `src/app/api/products/[id]/stock-movements/route.ts`
- Create: `src/app/api/products/[id]/stock-movements/route.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `requireManager`, product Zod schemas and Task 2 service functions.
- Produces: the HTTP API consumed by the product client.

- [x] **Step 1: Write failing Route Handler tests**

Use hoisted mocks and assert the exact actor/input boundary:

```ts
const response = await POST(new Request("http://localhost/api/products", {
  method: "POST",
  body: JSON.stringify(validInput),
}));
expect(requireManager).toHaveBeenCalledOnce();
expect(createProduct).toHaveBeenCalledWith(actor, validInput);
expect(response.status).toBe(201);
```

Cover GET with `requireUser`, PATCH with awaited `context.params`, stock POST, invalid UUID/body responses, 401, 403, 404 and 409 error shapes.

- [x] **Step 2: Run Route Handler tests and verify RED**

Run: `npm test -- src/app/api/products`

Expected: FAIL because the handlers do not exist.

- [x] **Step 3: Implement thin Next.js 16 handlers**

Use native `Request`/`Response`, `successResponse`, `errorResponse` and promised route params:

```ts
type ProductRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: ProductRouteContext) {
  try {
    const { user } = await requireManager();
    const id = productIdSchema.parse((await context.params).id);
    const input = updateProductSchema.parse(await request.json());
    return successResponse(await updateProduct(user, id, input));
  } catch (error) {
    return errorResponse(error);
  }
}
```

Do not cache GET because it reads authenticated request state and mutable database data.

- [x] **Step 4: Run API tests and verify GREEN**

Run: `npm test -- src/app/api/products`

Expected: PASS.

- [x] **Step 5: Commit the API**

```bash
git add src/app/api/products
git commit -m "feat(products): expose authorized product API"
```

### Task 5: Product API client and persistent UI

**Files:**
- Create: `src/lib/products/client.ts`
- Create: `src/lib/products/client.test.ts`
- Modify: `src/app/(dashboard)/products/page.tsx`
- Modify: `src/app/(dashboard)/products/page.test.tsx`
- Modify: `src/components/products/products-view.tsx`
- Modify: `src/components/products/products-view.test.tsx`
- Modify: `src/components/products/product-editor-dialog.tsx`
- Modify: `src/components/products/product-editor-dialog.test.tsx`
- Modify: `src/components/products/product-stock-dialog.tsx`
- Modify: `src/components/products/product-stock-dialog.test.tsx`
- Modify: `src/components/products/product-status-dialog.tsx`
- Modify: `src/components/products/product-status-dialog.test.tsx`

**Interfaces:**
- Consumes: the Task 4 HTTP endpoints and Task 2 DTO/input types.
- Produces: a persistent `/products` experience with no mock dependency.

- [ ] **Step 1: Write failing client and UI tests**

Assert the client unwraps `{ data }`, maps structured API errors to an `ApiClientError`, and sends exact methods/bodies. Update page tests to mock `listProducts(user)` and assert the demonstration badge is absent.

Update component tests to use a fake client:

```ts
const client = {
  create: vi.fn().mockResolvedValue(createdProduct),
  update: vi.fn().mockResolvedValue(updatedProduct),
  adjustStock: vi.fn().mockResolvedValue(adjustedProduct),
};

render(<ProductsView data={{ products }} canManage productClient={client} />);
await user.click(screen.getByRole("button", { name: /nuevo producto/i }));
// fill existing dialog fields
await user.click(screen.getByRole("button", { name: /crear producto/i }));
expect(client.create).toHaveBeenCalledWith(expectedInput);
expect(await screen.findByText(createdProduct.name)).toBeVisible();
```

Cover pending double-submit prevention, preserved dialog on failure, server error display, successful edit/stock/status replacement, and employee read-only behavior.

- [ ] **Step 2: Run focused client/UI tests and verify RED**

Run: `npm test -- src/lib/products/client.test.ts src/components/products "src/app/(dashboard)/products/page.test.tsx"`

Expected: FAIL because the API client and async integration are absent.

- [ ] **Step 3: Implement the API-backed UI**

Define:

```ts
export type ProductClient = {
  create(input: CreateProductInput): Promise<CatalogProduct>;
  update(id: string, input: UpdateProductInput): Promise<CatalogProduct>;
  adjustStock(id: string, input: StockAdjustment): Promise<CatalogProduct>;
};
```

The server page calls `requirePageUser()`, then `listProducts(user)`, and passes the result to `ProductsView`. Remove `products.mock.json`, `authorizeProductCatalogData` usage and the demonstration badge from the route.

Make dialog saves asynchronous, add one mutation-in-progress guard, preserve inputs and show returned errors on failure, replace the returned product by ID on success, and keep existing success toasts. General editing must never send stock.

- [ ] **Step 4: Run all product tests and verify GREEN**

Run: `npm test -- src/lib/products src/components/products src/app/api/products "src/app/(dashboard)/products/page.test.tsx"`

Expected: PASS.

- [ ] **Step 5: Commit the persistent UI**

```bash
git add "src/app/(dashboard)/products" src/components/products src/lib/products/client.ts src/lib/products/client.test.ts src/data/products.mock.json
git commit -m "feat(products): connect catalog to persistence"
```

### Task 6: Product milestone documentation and verification

**Files:**
- Modify: `context_snapshot.md`
- Modify: `product.md`

**Interfaces:**
- Consumes: all product milestone deliverables.
- Produces: an accurate handoff that marks remote SQL application as the only external action.

- [ ] **Step 1: Run focused and complete verification**

Run: `npm test -- src/lib/products src/components/products src/app/api/products "src/app/(dashboard)/products/page.test.tsx"`

Expected: PASS.

Run: `npm test`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 2: Update durable project state**

Record the exact branch, delivered persistent product behavior, automated verification results, the unapplied `008_products_inventory.sql` action and the next task: execute the sales-domain plan without claiming remote database installation.

- [ ] **Step 3: Commit the verified product milestone**

```bash
git add context_snapshot.md product.md
git commit -m "docs(products): record persistent catalog milestone"
```

- [ ] **Step 4: Verify the milestone commit and clean tree**

Run: `git status --short --branch`

Expected: branch `feat/backend-models` with no modified or untracked files.
