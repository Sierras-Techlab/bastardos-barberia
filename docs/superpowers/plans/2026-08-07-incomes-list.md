# Income History View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `/incomes` como una vista responsive de ingresos del mes, con métricas, filtros, paginación, detalle lateral y permisos visuales por rol.

**Architecture:** La página Server Component entrega un DTO mock serializable a `IncomesView`. Funciones puras resuelven clasificación, búsqueda, filtros, orden y métricas; los componentes visuales consumen la misma colección derivada. TanStack Table administra la tabla y paginación de escritorio, mientras una lista de cards reutiliza los mismos registros en móvil.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui sobre Base UI, TanStack Table, Lucide, Vitest y Testing Library.

## Global Constraints

- Usar npm y mantener Node `24.18.x` y npm `11.16.x`.
- Leer la documentación relevante en `node_modules/next/dist/docs/` antes de modificar rutas o convenciones de Next.js.
- Mantener la estética del dashboard y de `/incomes/new`: sidebar oscuro, fondo gris cálido, cards redondeadas y rojo de marca.
- El dueño ve todos los ingresos; el empleado recibe únicamente los propios y no dispone del filtro por empleado.
- El período inicial es agosto de 2026, que representa el mes actual del mock.
- Los ingresos anulados se muestran, pero no cuentan en las métricas.
- `Editar` y `Anular` aparecen deshabilitados con `Próximamente`; no implementar mutaciones.
- No conectar backend, exportación, pagos divididos ni paginación de servidor.
- No hacer commits automáticamente; los pasos de commit son checkpoints para que el usuario los ejecute.

---

## File Map

- `src/types/income.ts`: extender contratos compartidos con DTOs de listado, filtros, estado y métricas.
- `src/lib/incomes/income-list.ts`: funciones puras de clasificación, filtrado, orden y métricas.
- `src/lib/incomes/income-list.test.ts`: especificar el comportamiento del dominio.
- `src/data/incomes.mock.json`: historial amplio y serializable de agosto de 2026.
- `src/components/incomes/income-metrics.tsx`: cuatro métricas compactas.
- `src/components/incomes/income-filters.tsx`: búsqueda y filtros según rol.
- `src/components/incomes/income-table.tsx`: tabla y paginación de escritorio con TanStack Table.
- `src/components/incomes/income-mobile-list.tsx`: cards móviles de la misma colección.
- `src/components/incomes/income-detail-sheet.tsx`: detalle lateral de solo lectura.
- `src/components/incomes/incomes-state.tsx`: loading, error, empty y no-results reutilizables.
- `src/components/incomes/incomes-view.tsx`: orquestación de filtros, selección, métricas y página.
- `src/app/incomes/page.tsx`: composición Server Component de `/incomes`.
- `src/app/incomes/loading.tsx`: skeleton de navegación instantánea.
- `src/app/incomes/error.tsx`: error boundary con reintento.
- `src/components/app-sidebar.tsx`: navegación real y estado activo para Ingresos.
- Tests co-localizados `*.test.tsx`: contratos de cada componente e integración de la ruta.

---

### Task 1: Domain contracts and pure calculations

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/types/income.ts`
- Create: `src/lib/incomes/income-list.ts`
- Create: `src/lib/incomes/income-list.test.ts`

**Interfaces:**
- Produces: `IncomeListItem`, `IncomeListData`, `IncomeListFilters`, `IncomeKind`, `IncomeStatus`, `IncomeListMetrics`.
- Produces: `getIncomeKind(item)`, `filterIncomeItems(items, filters)`, `sortIncomeItems(items)`, `calculateIncomeMetrics(items)`.

- [ ] **Step 1: Install TanStack Table with npm**

Run:

```bash
npm install @tanstack/react-table
```

Expected: `package.json` contains `@tanstack/react-table` and npm updates the lockfile without peer-dependency errors.

- [ ] **Step 2: Extend the income DTO contracts**

Append contracts equivalent to:

```ts
export type IncomeStatus = "active" | "voided";
export type IncomeKind = "service" | "products" | "combined";

export type IncomeListProduct = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export type IncomeListItem = {
  id: string;
  createdAt: string;
  employee: Employee;
  customer: Customer | null;
  service: Service | null;
  products: IncomeListProduct[];
  paymentMethod: PaymentMethod;
  total: number;
  status: IncomeStatus;
};

export type IncomeListFilters = {
  query: string;
  dateFrom: string;
  dateTo: string;
  employeeId: string;
  paymentMethod: PaymentMethod | "all";
  kind: IncomeKind | "all";
};

export type IncomeListMetrics = {
  total: number;
  count: number;
  average: number;
  cashTotal: number;
  transferTotal: number;
};

export type IncomeListData = {
  currentUser: CurrentUser;
  employees: Employee[];
  incomes: IncomeListItem[];
};
```

- [ ] **Step 3: Write failing domain tests**

Cover literal fixtures for:

```ts
expect(getIncomeKind(serviceOnly)).toBe("service");
expect(getIncomeKind(productsOnly)).toBe("products");
expect(getIncomeKind(combined)).toBe("combined");

expect(filterIncomeItems(items, { ...emptyFilters, query: "tomás" }))
  .toEqual([combined]);
expect(filterIncomeItems(items, { ...emptyFilters, employeeId: "employee-fer" }))
  .toEqual([productsOnly]);
expect(filterIncomeItems(items, { ...emptyFilters, paymentMethod: "cash" }))
  .toEqual([serviceOnly, combined]);
expect(filterIncomeItems(items, { ...emptyFilters, kind: "combined" }))
  .toEqual([combined]);

expect(sortIncomeItems([older, newer]).map((item) => item.id))
  .toEqual(["newer", "older"]);

expect(calculateIncomeMetrics([activeCash, activeTransfer, voided])).toEqual({
  total: 35000,
  count: 2,
  average: 17500,
  cashTotal: 16000,
  transferTotal: 19000,
});
```

Use `dateFrom: "2026-08-01"` and `dateTo: "2026-08-31"` to cover inclusive date boundaries.

- [ ] **Step 4: Run the domain test and verify RED**

Run:

```bash
npm test -- src/lib/incomes/income-list.test.ts
```

Expected: FAIL because `income-list.ts` and its exports do not exist.

- [ ] **Step 5: Implement the minimal pure functions**

Implementation rules:

```ts
export const getIncomeKind = (item: IncomeListItem): IncomeKind => {
  if (item.service && item.products.length > 0) return "combined";
  if (item.service) return "service";
  return "products";
};
```

- Normalize search with `trim().toLocaleLowerCase("es")`.
- Search employee, customer, service and every product name.
- Apply non-`all` filters with strict IDs/values.
- Treat `dateFrom` as local `00:00:00` and `dateTo` as local `23:59:59.999`.
- Sort using `Date.parse(b.createdAt) - Date.parse(a.createdAt)` without mutating the input.
- Calculate metrics from `status === "active"` only and return average `0` when count is zero.

- [ ] **Step 6: Run domain tests and verify GREEN**

Run:

```bash
npm test -- src/lib/incomes/income-list.test.ts
```

Expected: all domain tests PASS.

- [ ] **Step 7: User commit checkpoint**

```bash
git add package.json package-lock.json src/types/income.ts src/lib/incomes/income-list.ts src/lib/incomes/income-list.test.ts
git commit -m "feat(incomes): add list domain and calculations"
```

---

### Task 2: Representative mock history

**Files:**
- Create: `src/data/incomes.mock.json`
- Create: `src/data/incomes.mock.test.ts`

**Interfaces:**
- Consumes: `IncomeListData` from Task 1.
- Produces: one owner-view `IncomeListData` fixture used by the route and component tests.

- [ ] **Step 1: Write a failing mock-contract test**

```ts
import mock from "./incomes.mock.json";

it("covers the income-list scenarios", () => {
  const data = mock as IncomeListData;

  expect(data.currentUser.role).toBe("owner");
  expect(data.employees).toHaveLength(2);
  expect(data.incomes.length).toBeGreaterThanOrEqual(24);
  expect(new Set(data.incomes.map(getIncomeKind))).toEqual(
    new Set(["service", "products", "combined"]),
  );
  expect(new Set(data.incomes.map((item) => item.paymentMethod))).toEqual(
    new Set(["cash", "transfer"]),
  );
  expect(data.incomes.some((item) => item.status === "voided")).toBe(true);
  expect(data.incomes.every((item) => item.createdAt.startsWith("2026-08"))).toBe(true);
});
```

- [ ] **Step 2: Run the mock test and verify RED**

Run:

```bash
npm test -- src/data/incomes.mock.test.ts
```

Expected: FAIL because the JSON file does not exist.

- [ ] **Step 3: Create the mock data**

Create at least 24 items across August 1–7, 2026. Include:

- Lautaro and Fernanda.
- Named and anonymous customers.
- The three approved services and products already present in `income-form.mock.json`.
- Cash and transfer payments.
- Service-only, products-only and combined sales.
- At least two voided sales.
- Totals equal to service price plus product unit price × quantity.

- [ ] **Step 4: Run the mock contract and verify GREEN**

Run:

```bash
npm test -- src/data/incomes.mock.test.ts
```

Expected: PASS.

- [ ] **Step 5: User commit checkpoint**

```bash
git add src/data/incomes.mock.json src/data/incomes.mock.test.ts
git commit -m "test(incomes): add representative history fixture"
```

---

### Task 3: Metrics and role-aware filters

**Files:**
- Create: `src/components/incomes/income-metrics.tsx`
- Create: `src/components/incomes/income-metrics.test.tsx`
- Create: `src/components/incomes/income-filters.tsx`
- Create: `src/components/incomes/income-filters.test.tsx`

**Interfaces:**
- Consumes: `IncomeListMetrics`, `IncomeListFilters`, `Employee`, `UserRole`.
- Produces: controlled `IncomeMetrics` and `IncomeFilters` components.

- [ ] **Step 1: Write failing metric-card tests**

```tsx
render(
  <IncomeMetrics
    metrics={{
      total: 874000,
      count: 42,
      average: 20810,
      cashTotal: 524000,
      transferTotal: 350000,
    }}
  />,
);

expect(screen.getByText("$ 874.000")).toBeVisible();
expect(screen.getByText("42")).toBeVisible();
expect(screen.getByText("$ 20.810")).toBeVisible();
expect(screen.getByText(/60% efectivo/i)).toBeVisible();
```

- [ ] **Step 2: Run metric tests and verify RED**

Run:

```bash
npm test -- src/components/incomes/income-metrics.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement four compact metric cards**

Use the existing `Card`, `formatArs`, Lucide icons and a responsive `grid-cols-2 xl:grid-cols-4`. Calculate payment percentages from the received totals; when total is zero, show `0%` for both methods.

- [ ] **Step 4: Run metric tests and verify GREEN**

Run the same test command. Expected: PASS.

- [ ] **Step 5: Write failing controlled-filter tests**

```tsx
render(
  <IncomeFilters
    role="owner"
    employees={employees}
    value={emptyFilters}
    onChange={onChange}
    onClear={onClear}
  />,
);

await user.type(screen.getByRole("searchbox", { name: /buscar ingresos/i }), "tomas");
expect(onChange).toHaveBeenCalledWith({ ...emptyFilters, query: "tomas" });
expect(screen.getByRole("combobox", { name: /empleado/i })).toBeVisible();

rerender(<IncomeFilters role="employee" {...controlledProps} />);
expect(screen.queryByRole("combobox", { name: /empleado/i })).not.toBeInTheDocument();
```

Also test payment, kind, date boundaries and `Limpiar filtros`.

- [ ] **Step 6: Run filter tests and verify RED**

Run:

```bash
npm test -- src/components/incomes/income-filters.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 7: Implement controlled filters**

- Search input is always visible.
- Desktop filters use native selects styled consistently with `/incomes/new`.
- The employee select only renders for `role === "owner"`.
- A `Filtrar` button controls a compact mobile panel using the existing `Sheet` or `Dialog` primitives.
- `onChange` always receives the complete next `IncomeListFilters` object.
- `Limpiar filtros` invokes `onClear` and is disabled when filters equal the initial month defaults.

- [ ] **Step 8: Run filter tests and verify GREEN**

Run the same filter test command. Expected: PASS.

- [ ] **Step 9: User commit checkpoint**

```bash
git add src/components/incomes/income-metrics* src/components/incomes/income-filters*
git commit -m "feat(incomes): add metrics and filters"
```

---

### Task 4: Desktop table and mobile cards

**Files:**
- Create: `src/components/incomes/income-table.tsx`
- Create: `src/components/incomes/income-table.test.tsx`
- Create: `src/components/incomes/income-mobile-list.tsx`
- Create: `src/components/incomes/income-mobile-list.test.tsx`

**Interfaces:**
- Consumes: sorted `IncomeListItem[]` and `onSelect(item)`.
- Produces: table pagination and mobile cards that select the same DTO.

- [ ] **Step 1: Write failing table tests**

```tsx
render(<IncomeTable incomes={twelveItems} onSelect={onSelect} />);

expect(screen.getAllByRole("row")).toHaveLength(11); // header + 10 rows
expect(screen.getByText(/página 1 de 2/i)).toBeVisible();

await user.click(screen.getByRole("button", { name: /siguiente/i }));
expect(screen.getByText("income-12")).toBeVisible();

await user.click(screen.getByRole("button", { name: /abrir ingreso income-12/i }));
expect(onSelect).toHaveBeenCalledWith(twelveItems[11]);
```

Assert headers `Fecha`, `Concepto`, `Empleado`, `Cliente`, `Pago`, `Total` and a visible `Anulado` badge when applicable.

- [ ] **Step 2: Run table tests and verify RED**

Run:

```bash
npm test -- src/components/incomes/income-table.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement TanStack Table**

Use:

```ts
const table = useReactTable({
  data: incomes,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
});
```

Rows must be focusable, respond to `Enter`, and expose an accessible `Abrir ingreso <id>` action. Concept copy rules:

- Service only: service name.
- Products only: `N productos`.
- Combined: `<service> + N productos`.

Voided rows use muted/line-through treatment without disappearing.

- [ ] **Step 4: Run table tests and verify GREEN**

Run the same table command. Expected: PASS.

- [ ] **Step 5: Write failing mobile-list tests**

```tsx
render(<IncomeMobileList incomes={[combined]} onSelect={onSelect} />);

const card = screen.getByRole("button", { name: /abrir ingreso income-1/i });
expect(within(card).getByText(/corte.*2 productos/i)).toBeVisible();
expect(within(card).getByText(/transferencia/i)).toBeVisible();
expect(within(card).getByText(/19\.000/i)).toBeVisible();

await user.click(card);
expect(onSelect).toHaveBeenCalledWith(combined);
```

- [ ] **Step 6: Run mobile tests and verify RED**

Run:

```bash
npm test -- src/components/incomes/income-mobile-list.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 7: Implement compact mobile cards**

Use semantic buttons or focusable cards, minimum 44px targets, no fixed widths, `lg:hidden`, hover/focus feedback and the same concept formatter exported from `income-list.ts`.

- [ ] **Step 8: Run mobile tests and verify GREEN**

Run the same mobile test command. Expected: PASS.

- [ ] **Step 9: User commit checkpoint**

```bash
git add src/components/incomes/income-table* src/components/incomes/income-mobile-list*
git commit -m "feat(incomes): add responsive income listing"
```

---

### Task 5: Read-only income detail sheet

**Files:**
- Create: `src/components/incomes/income-detail-sheet.tsx`
- Create: `src/components/incomes/income-detail-sheet.test.tsx`

**Interfaces:**
- Consumes: `income: IncomeListItem | null`, `open: boolean`, `onOpenChange(open)`.
- Produces: accessible detail view; no mutation callbacks.

- [ ] **Step 1: Write the failing detail test**

```tsx
render(
  <IncomeDetailSheet
    income={combinedIncome}
    open
    onOpenChange={onOpenChange}
  />,
);

expect(screen.getByRole("dialog", { name: /detalle del ingreso/i })).toBeVisible();
expect(screen.getByText("Tomás Pereyra")).toBeVisible();
expect(screen.getByText("Corte, perfilado y barba")).toBeVisible();
expect(screen.getByText("Hunter Cream × 2")).toBeVisible();
expect(screen.getByText("Transferencia")).toBeVisible();
expect(screen.getByText("$ 79.000")).toBeVisible();
expect(screen.getByRole("button", { name: /editar/i })).toBeDisabled();
expect(screen.getByRole("button", { name: /anular/i })).toBeDisabled();
expect(screen.getAllByText(/próximamente/i)).not.toHaveLength(0);
```

- [ ] **Step 2: Run the detail test and verify RED**

Run:

```bash
npm test -- src/components/incomes/income-detail-sheet.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the Sheet**

Use `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` and `SheetFooter`. The content should be `w-full sm:max-w-md`, scroll internally when needed and show status, timestamp, employee, customer, line items, payment and total. Render both future actions disabled with a small `Próximamente` badge or description.

- [ ] **Step 4: Run the detail test and verify GREEN**

Run the same test command. Expected: PASS without Base UI console warnings.

- [ ] **Step 5: User commit checkpoint**

```bash
git add src/components/incomes/income-detail-sheet*
git commit -m "feat(incomes): add income detail sheet"
```

---

### Task 6: IncomesView orchestration and UI states

**Files:**
- Create: `src/components/incomes/incomes-state.tsx`
- Create: `src/components/incomes/incomes-state.test.tsx`
- Create: `src/components/incomes/incomes-view.tsx`
- Create: `src/components/incomes/incomes-view.test.tsx`

**Interfaces:**
- Consumes: `data: IncomeListData` and optional `state?: "ready" | "loading" | "error"` plus `onRetry?` for deterministic state tests.
- Produces: complete interactive body for `/incomes`.

- [ ] **Step 1: Write failing state-component tests**

```tsx
render(<IncomesState state="loading" />);
expect(screen.getByRole("status", { name: /cargando ingresos/i })).toBeVisible();

rerender(<IncomesState state="error" onRetry={onRetry} />);
await user.click(screen.getByRole("button", { name: /reintentar/i }));
expect(onRetry).toHaveBeenCalledOnce();

rerender(<IncomesState state="empty" />);
expect(screen.getByText(/todavía no hay ingresos/i)).toBeVisible();

rerender(<IncomesState state="no-results" onClear={onClear} />);
await user.click(screen.getByRole("button", { name: /limpiar filtros/i }));
expect(onClear).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Run state tests and verify RED**

Run:

```bash
npm test -- src/components/incomes/incomes-state.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement reusable states**

Loading uses existing `Skeleton`. Error renders `Reintentar`, empty renders `Cargar ingreso`, and no-results renders `Limpiar filtros`. Do not duplicate the page shell.

- [ ] **Step 4: Run state tests and verify GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Write failing orchestration tests**

Test the real child components together:

```tsx
render(<IncomesView data={ownerData} />);
expect(screen.getByRole("combobox", { name: /empleado/i })).toBeVisible();
expect(screen.getByText("$ 874.000")).toBeVisible();

await user.type(screen.getByRole("searchbox", { name: /buscar ingresos/i }), "tomás");
expect(screen.queryByText("Lucas Romero")).not.toBeInTheDocument();
expect(screen.getByText("Tomás Pereyra")).toBeVisible();

await user.click(screen.getByRole("button", { name: /abrir ingreso income-1/i }));
expect(screen.getByRole("dialog", { name: /detalle del ingreso/i })).toBeVisible();
```

Also assert:

- Employee data hides the employee filter.
- Empty source renders `empty`.
- A query with no matches renders `no-results`.
- Changing any filter resets table page index to zero.

- [ ] **Step 6: Run orchestration tests and verify RED**

Run:

```bash
npm test -- src/components/incomes/incomes-view.test.tsx
```

Expected: FAIL because `IncomesView` does not exist.

- [ ] **Step 7: Implement IncomesView**

Use `useState` for complete filters and selected item; derive filtered/sorted values and metrics with `useMemo`. Initial filters:

```ts
{
  query: "",
  dateFrom: "2026-08-01",
  dateTo: "2026-08-31",
  employeeId: "",
  paymentMethod: "all",
  kind: "all",
}
```

Render metrics and filters once, then:

- `IncomeTable` inside `hidden lg:block`.
- `IncomeMobileList` inside `lg:hidden`.
- `IncomeDetailSheet` controlled by selection.
- `IncomesState` when loading, error, empty or no-results.

When `currentUser.role === "employee"`, defensively restrict the received collection to `employee.id === currentUser.id` for the mock UX; keep a code comment that backend authorization remains mandatory.

- [ ] **Step 8: Run orchestration tests and verify GREEN**

Run:

```bash
npm test -- src/components/incomes/incomes-view.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Run all income component tests**

Run:

```bash
npm test -- src/components/incomes src/lib/incomes src/data/incomes.mock.test.ts
```

Expected: all income tests PASS.

- [ ] **Step 10: User commit checkpoint**

```bash
git add src/components/incomes/incomes-state* src/components/incomes/incomes-view*
git commit -m "feat(incomes): compose income history view"
```

---

### Task 7: Route shell, loading/error boundaries and sidebar navigation

**Files:**
- Create: `src/app/incomes/page.tsx`
- Create: `src/app/incomes/page.test.tsx`
- Create: `src/app/incomes/loading.tsx`
- Create: `src/app/incomes/error.tsx`
- Modify: `src/components/app-sidebar.tsx`
- Create: `src/components/app-sidebar.test.tsx`
- Modify: `src/app/incomes/new/page.tsx`

**Interfaces:**
- Consumes: mock `IncomeListData`, `IncomesView`, existing app shell.
- Produces: public `/incomes` route and navigable sidebar.

- [ ] **Step 1: Read current Next.js route documentation**

Read completely before editing:

```bash
sed -n '1,260p' node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
sed -n '1,260p' node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md
sed -n '1,260p' node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md
```

Confirm: `page.tsx` remains a Server Component; `error.tsx` must be a Client Component; no synchronous `params` or `searchParams` are needed.

- [ ] **Step 2: Write failing sidebar tests**

Desired API:

```tsx
render(<AppSidebar activeItem="Ingresos" />);

expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/");
expect(screen.getByRole("link", { name: "Ingresos" })).toHaveAttribute("href", "/incomes");
expect(screen.getByRole("link", { name: "Ingresos" })).toHaveAttribute("data-active", "true");
```

- [ ] **Step 3: Run sidebar tests and verify RED**

Run:

```bash
npm test -- src/components/app-sidebar.test.tsx
```

Expected: FAIL because navigation is not made of links and `activeItem` does not exist.

- [ ] **Step 4: Implement real operation links**

Change `AppSidebar` to accept:

```ts
type AppSidebarProps = {
  activeItem?: "Inicio" | "Ingresos" | "Clientes" | "Servicios" | "Productos";
};
```

Default to `Inicio`. Replace `Cargar ingreso` with `Ingresos` and define hrefs. Render `SidebarMenuButton` with a Next `Link` using the Base UI composition contract without console warnings; only Inicio and Ingresos need live routes in this task. Pass `activeItem="Ingresos"` from both income pages.

- [ ] **Step 5: Run sidebar tests and verify GREEN**

Run the same sidebar command. Expected: PASS without Base UI warnings.

- [ ] **Step 6: Write the failing route test**

```tsx
render(<IncomesPage />);

expect(screen.getByRole("heading", { name: "Ingresos" })).toBeVisible();
expect(screen.getByText("Agosto 2026")).toBeVisible();
expect(screen.getByRole("link", { name: /cargar ingreso/i })).toHaveAttribute(
  "href",
  "/incomes/new",
);
expect(screen.getByRole("table", { name: /historial de ingresos/i })).toBeVisible();
expect(metadata.title).toBe("Ingresos");
```

- [ ] **Step 7: Run route test and verify RED**

Run:

```bash
npm test -- src/app/incomes/page.test.tsx
```

Expected: FAIL because `/incomes/page.tsx` does not exist.

- [ ] **Step 8: Implement the page shell**

Compose `TooltipProvider`, `SidebarProvider`, `AppSidebar activeItem="Ingresos"`, `SidebarInset`, sticky 64px header and `IncomesView`. Use a normal Next `Link` styled through `buttonVariants` for `Cargar ingreso`. Export:

```ts
export const metadata: Metadata = {
  title: "Ingresos",
  description: "Consultá las ventas registradas de Bastardos Barbería.",
};
```

Do not render `new Date()` inside a hydrated Client Component for the month label; use the fixed serializable period label `Agosto 2026` from route data.

- [ ] **Step 9: Add route loading and error files**

- `loading.tsx` renders the same content width with metric and table skeletons.
- `error.tsx` starts with `"use client"`, accepts `{ error: Error & { digest?: string }, reset: () => void }`, renders el texto fijo `No pudimos cargar los ingresos.` y expone `Reintentar` llamando a `reset()`.
- Both preserve accessible status/alert semantics.

- [ ] **Step 10: Run route and navigation tests**

Run:

```bash
npm test -- src/app/incomes src/components/app-sidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 11: User commit checkpoint**

```bash
git add src/app/incomes src/components/app-sidebar.tsx src/components/app-sidebar.test.tsx
git commit -m "feat(incomes): add income history route"
```

---

### Task 8: Final verification and responsive QA

**Files:**
- Modify only files implicated by verification failures.

**Interfaces:**
- Consumes: complete implementation from Tasks 1–7.
- Produces: verified feature ready for the user's commit/push/PR workflow.

- [ ] **Step 1: Run the full automated suite**

```bash
npm test
```

Expected: all test files PASS with zero failures and no console warnings.

- [ ] **Step 2: Run lint and whitespace verification**

```bash
npm run lint
git diff --check
```

Expected: both exit successfully with no output indicating errors.

- [ ] **Step 3: Build with the supported webpack path**

```bash
npm run build -- --webpack
```

Expected: compile and TypeScript succeed; route table includes `/incomes` and `/incomes/new`.

- [ ] **Step 4: Verify desktop in the browser**

At `1440 × 900`, verify:

- Header and sidebar do not overlap content.
- Four metrics fit on one row.
- Filters are usable without clipping.
- Table displays 10 rows and pagination.
- Hover, keyboard selection and detail Sheet work.
- Sticky elements respect the 64px header.
- Browser console contains no warnings or hydration errors.

- [ ] **Step 5: Verify mobile in the browser**

At `390 × 844`, verify:

- No horizontal scroll.
- Metrics use two columns.
- Filter action opens the compact filter panel.
- Cards remain readable and open the detail Sheet.
- `Cargar ingreso` is reachable.
- The detail Sheet can scroll and close.

- [ ] **Step 6: Inspect final working tree**

```bash
git status --short --untracked-files=all
git diff --stat
```

Report unrelated user changes separately, especially `.gitignore`. Do not stage or commit them without explicit instruction.

- [ ] **Step 7: User final commit checkpoint**

If Tasks 1–7 were not committed individually, stage only the feature files and use:

```bash
git commit -m "feat(incomes): add income history view"
```
