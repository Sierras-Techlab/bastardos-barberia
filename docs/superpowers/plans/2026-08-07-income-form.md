# Income Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the responsive `/incomes/new` frontend flow for registering a service, products, or both with mock data, validation, confirmation, and result states.

**Architecture:** A synchronous Next.js page supplies typed mock catalog data to a client-side React Hook Form. Domain calculations and Zod validation stay pure and tested, while an injected `IncomeService` boundary simulates creation now and can be replaced by an API adapter later.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript 5, Tailwind CSS 4, shadcn/ui with Base UI, React Hook Form 7, Zod 4, Vitest 4, React Testing Library.

## Global Constraints

- Implement only `/incomes/new`; do not add `/incomes`, sidebar links, or dashboard links in issue #9.
- Use npm and preserve Node `24.18.x` and npm `11.16.x` project constraints.
- Use arrow functions for custom React components and local callbacks when a named declaration is unnecessary.
- Use integer Argentine pesos and native `Intl.NumberFormat`; do not add a currency library.
- A draft requires one service or at least one product, one employee, one payment method, and a positive total.
- Customer association remains optional.
- One payment method per entry: `cash` or `transfer`; split payments are out of scope.
- Catalog prices are read-only in this form.
- An employee uses their own identity; an owner may choose another employee.
- Backend integration, persistence, authentication, stock mutation, commissions, cash closing, discounts, and editable prices are out of scope.
- The future backend remains authoritative for authorization, catalog prices, and final totals.
- Build for notebook first and keep every interaction usable on mobile without hover.
- Read relevant local Next.js 16 documentation under `node_modules/next/dist/docs/` before changing routing or page conventions.
- Follow test-driven development: observe each new behavior test fail before adding its implementation.

---

## File Map

### Create

- `vitest.config.mts` — jsdom test environment, React transform, and `@/*` path resolution.
- `vitest.setup.ts` — Testing Library DOM matchers and cleanup.
- `src/types/income.ts` — catalog, form, service, and created-income contracts.
- `src/lib/incomes/income-schema.ts` — Zod schema and inferred form type.
- `src/lib/incomes/income-calculations.ts` — pure line and total calculations.
- `src/lib/incomes/mock-income-service.ts` — mock `IncomeService` factory.
- `src/data/income-form.mock.json` — employees, customers, services, products, and mock current user.
- `src/components/incomes/service-selector.tsx` — exclusive optional service cards.
- `src/components/incomes/product-selector.tsx` — product search, add, quantity, and remove UI.
- `src/components/incomes/payment-method-selector.tsx` — exclusive payment cards.
- `src/components/incomes/income-summary.tsx` — itemized sticky summary.
- `src/components/incomes/income-confirmation-dialog.tsx` — final review and async confirmation.
- `src/components/incomes/income-success-state.tsx` — persistent completion state.
- `src/components/incomes/income-form.tsx` — form orchestration and result-state transitions.
- `src/app/incomes/new/page.tsx` — route metadata, shell, and typed mock wiring.
- Unit/component test files colocated beside their subjects using `*.test.ts` and `*.test.tsx`.

### Modify

- `package.json` — finish test dependencies and add deterministic test scripts.
- `package-lock.json` — npm lockfile updates.

### Reuse without modifying

- `src/components/app-sidebar.tsx` — existing application navigation surface.
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/tooltip.tsx`
- `src/lib/utils.ts`

---

### Task 1: Establish the test harness and domain contracts

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.mts`
- Create: `vitest.setup.ts`
- Create: `src/types/income.ts`
- Create: `src/lib/incomes/income-schema.test.ts`
- Create: `src/lib/incomes/income-schema.ts`
- Create: `src/lib/incomes/income-calculations.test.ts`
- Create: `src/lib/incomes/income-calculations.ts`

**Interfaces:**
- Produces: `IncomeFormData`, `CurrentUser`, `CreateIncomeInput`, `Income`, `IncomeService`, `IncomeFormValues`, `calculateIncomeTotal`, and `formatArs`.
- Consumes: none.

- [ ] **Step 1: Complete the Vitest dependencies and scripts**

Run:

```bash
npm install -D @testing-library/dom @testing-library/jest-dom @vitejs/plugin-react vite-tsconfig-paths
```

Add scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Configure Vitest**

Create `vitest.config.mts`:

```ts
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

- [ ] **Step 3: Write failing schema tests**

Create `src/lib/incomes/income-schema.test.ts` with explicit cases:

```ts
import { describe, expect, it } from "vitest";
import { incomeFormSchema } from "./income-schema";

const validBase = {
  employeeId: "employee-1",
  customerId: null,
  serviceId: "service-1",
  products: [],
  paymentMethod: "cash" as const,
};

describe("incomeFormSchema", () => {
  it("accepts a service without products and an optional customer", () => {
    expect(incomeFormSchema.safeParse(validBase).success).toBe(true);
  });

  it("accepts products without a service", () => {
    const result = incomeFormSchema.safeParse({
      ...validBase,
      serviceId: null,
      products: [{ productId: "product-1", quantity: 2 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty entry", () => {
    const result = incomeFormSchema.safeParse({
      ...validBase,
      serviceId: null,
      products: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero product quantity and a missing payment method", () => {
    const result = incomeFormSchema.safeParse({
      ...validBase,
      serviceId: null,
      products: [{ productId: "product-1", quantity: 0 }],
      paymentMethod: null,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 4: Run schema tests and verify RED**

Run:

```bash
npm test -- src/lib/incomes/income-schema.test.ts
```

Expected: FAIL because `income-schema.ts` does not exist.

- [ ] **Step 5: Add exact domain contracts and schema**

Create `src/types/income.ts`:

```ts
export type PaymentMethod = "cash" | "transfer";
export type UserRole = "owner" | "employee";

export type Employee = { id: string; firstName: string; lastName: string };
export type Customer = { id: string; firstName: string; lastName: string };
export type Service = { id: string; name: string; price: number };
export type Product = { id: string; name: string; price: number; stock: number };

export type CurrentUser = Employee & { role: UserRole };

export type IncomeFormData = {
  currentUser: CurrentUser;
  employees: Employee[];
  customers: Customer[];
  services: Service[];
  products: Product[];
};

export type IncomeProductInput = { productId: string; quantity: number };

export type CreateIncomeInput = {
  employeeId: string;
  customerId: string | null;
  serviceId: string | null;
  products: IncomeProductInput[];
  paymentMethod: PaymentMethod;
};

export type Income = CreateIncomeInput & {
  id: string;
  total: number;
  createdAt: string;
};

export type IncomeService = {
  create: (input: CreateIncomeInput) => Promise<Income>;
};
```

Create `src/lib/incomes/income-schema.ts`:

```ts
import { z } from "zod";

export const incomeFormSchema = z
  .object({
    employeeId: z.string().min(1, "Seleccioná un empleado responsable."),
    customerId: z.string().nullable(),
    serviceId: z.string().nullable(),
    products: z.array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    ),
    paymentMethod: z.enum(["cash", "transfer"]).nullable(),
  })
  .refine((value) => value.serviceId !== null || value.products.length > 0, {
    message: "Seleccioná un servicio o agregá al menos un producto.",
    path: ["serviceId"],
  })
  .refine((value) => value.paymentMethod !== null, {
    message: "Seleccioná un medio de pago.",
    path: ["paymentMethod"],
  });

export type IncomeFormValues = z.infer<typeof incomeFormSchema>;
```

- [ ] **Step 6: Run schema tests and verify GREEN**

Run `npm test -- src/lib/incomes/income-schema.test.ts`.

Expected: 4 tests pass.

- [ ] **Step 7: Write failing calculation tests**

Create `src/lib/incomes/income-calculations.test.ts` to verify service-only, products-only, combined, and unknown IDs:

```ts
import { describe, expect, it } from "vitest";
import { calculateIncomeTotal, formatArs } from "./income-calculations";

const services = [{ id: "s1", name: "Corte", price: 16000 }];
const products = [{ id: "p1", name: "Pomada", price: 10000, stock: 4 }];

describe("calculateIncomeTotal", () => {
  it("adds the selected service and product quantities", () => {
    expect(
      calculateIncomeTotal(
        { serviceId: "s1", products: [{ productId: "p1", quantity: 2 }] },
        services,
        products,
      ),
    ).toBe(36000);
  });

  it("ignores unknown catalog ids instead of producing NaN", () => {
    expect(
      calculateIncomeTotal(
        { serviceId: "missing", products: [{ productId: "missing", quantity: 2 }] },
        services,
        products,
      ),
    ).toBe(0);
  });
});

it("formats integer Argentine pesos", () => {
  expect(formatArs(16000)).toContain("16.000");
});
```

- [ ] **Step 8: Run calculation tests and verify RED**

Run `npm test -- src/lib/incomes/income-calculations.test.ts`.

Expected: FAIL because `income-calculations.ts` does not exist.

- [ ] **Step 9: Implement pure calculations**

Create `src/lib/incomes/income-calculations.ts` with these signatures:

```ts
import type { Product, Service } from "@/types/income";

type CalculableDraft = {
  serviceId: string | null;
  products: Array<{ productId: string; quantity: number }>;
};

export const calculateIncomeTotal = (
  draft: CalculableDraft,
  services: Service[],
  products: Product[],
) => {
  const serviceTotal =
    services.find((service) => service.id === draft.serviceId)?.price ?? 0;
  const productTotal = draft.products.reduce((total, item) => {
    const price = products.find((product) => product.id === item.productId)?.price ?? 0;
    return total + price * item.quantity;
  }, 0);
  return serviceTotal + productTotal;
};

export const formatArs = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
```

- [ ] **Step 10: Run all Task 1 tests and commit**

Run:

```bash
npm test -- src/lib/incomes
npm run lint
```

Expected: all tests pass and ESLint exits 0.

Commit:

```bash
git add package.json package-lock.json vitest.config.mts vitest.setup.ts src/types/income.ts src/lib/incomes
git commit -m "test(incomes): establish form domain and test harness"
```

---

### Task 2: Add typed mock data and the service boundary

**Files:**
- Create: `src/data/income-form.mock.json`
- Create: `src/lib/incomes/mock-income-service.test.ts`
- Create: `src/lib/incomes/mock-income-service.ts`

**Interfaces:**
- Consumes: `IncomeFormData`, `CreateIncomeInput`, `IncomeService`, `calculateIncomeTotal` from Task 1.
- Produces: `createMockIncomeService(data, options?)` returning `IncomeService`.

- [ ] **Step 1: Add representative mock catalog data**

The JSON must include:

- Current owner user Lautaro.
- At least one employee account.
- At least eight optional customers.
- The three confirmed services and exact prices.
- At least twelve products with integer prices and stock display values.

Use stable string IDs such as `service-haircut-eyebrows`, `product-pomade`, and `employee-lautaro`; do not use array positions as identity.

- [ ] **Step 2: Write failing service tests**

Test that the service:

- Returns an ID and ISO date.
- Recalculates total from catalog IDs and quantities.
- Can be configured to reject for the UI error test.

Use the exact factory contract:

```ts
type MockIncomeServiceOptions = {
  shouldFail?: boolean;
  latencyMs?: number;
};

createMockIncomeService(data, options): IncomeService
```

- [ ] **Step 3: Run the test and verify RED**

Run `npm test -- src/lib/incomes/mock-income-service.test.ts`.

Expected: FAIL because the factory is missing.

- [ ] **Step 4: Implement the mock service**

The implementation must close over the typed catalog, optionally await `latencyMs`, throw `No se pudo registrar el ingreso.` when `shouldFail` is true, and return a created `Income` whose total comes from `calculateIncomeTotal`.

Generate a client-safe mock ID with `crypto.randomUUID()` and `createdAt` with `new Date().toISOString()`.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
npm test -- src/lib/incomes/mock-income-service.test.ts
npm run lint
```

Commit:

```bash
git add src/data/income-form.mock.json src/lib/incomes/mock-income-service.ts src/lib/incomes/mock-income-service.test.ts
git commit -m "feat(incomes): add mock catalog and income service"
```

---

### Task 3: Build service, product, and payment controls

**Files:**
- Create: `src/components/incomes/service-selector.test.tsx`
- Create: `src/components/incomes/service-selector.tsx`
- Create: `src/components/incomes/product-selector.test.tsx`
- Create: `src/components/incomes/product-selector.tsx`
- Create: `src/components/incomes/payment-method-selector.test.tsx`
- Create: `src/components/incomes/payment-method-selector.tsx`

**Interfaces:**
- Consumes: `Service`, `Product`, `PaymentMethod`, and `formatArs`.
- Produces:
  - `ServiceSelector({ services, value, onChange, error })`
  - `ProductSelector({ products, value, onChange })`
  - `PaymentMethodSelector({ value, onChange, error })`

- [ ] **Step 1: Test and implement the service selector RED-GREEN cycle**

Tests must select one service, replace it with another, clear the selected service by clicking it again, expose `aria-pressed`, display prices, and render the passed error message.

Implementation uses semantic `button type="button"` cards and the existing shadcn `Card`; selection must remain obvious without hover.

- [ ] **Step 2: Test and implement the product selector RED-GREEN cycle**

Tests must:

- Filter products case-insensitively by name.
- Add a product once.
- Increment an existing row rather than duplicating it.
- Increment and decrement quantities.
- Keep quantity one when decrement is pressed at one.
- Remove only through the explicit remove action.
- Display unit price and row subtotal.

The component owns only its search query. Selected product state is controlled through:

```ts
type ProductSelection = Array<{ productId: string; quantity: number }>;
```

- [ ] **Step 3: Test and implement the payment selector RED-GREEN cycle**

Tests must select cash, switch to transfer, expose `aria-pressed`, and show the provided required-field error.

Use large button cards with `Banknote` and `Landmark` Lucide icons; do not introduce a third-party radio component.

- [ ] **Step 4: Run all selector tests and commit**

Run:

```bash
npm test -- src/components/incomes/service-selector.test.tsx src/components/incomes/product-selector.test.tsx src/components/incomes/payment-method-selector.test.tsx
npm run lint
```

Commit:

```bash
git add src/components/incomes/service-selector* src/components/incomes/product-selector* src/components/incomes/payment-method-selector*
git commit -m "feat(incomes): add sale selection controls"
```

---

### Task 4: Compose the form and sticky summary

**Files:**
- Create: `src/components/incomes/income-summary.test.tsx`
- Create: `src/components/incomes/income-summary.tsx`
- Create: `src/components/incomes/income-form.test.tsx`
- Create: `src/components/incomes/income-form.tsx`

**Interfaces:**
- Consumes: Task 1 schema/types/calculations, Task 2 `IncomeService`, and Task 3 controls.
- Produces:
  - `IncomeSummary({ values, data })`
  - `IncomeForm({ data, incomeService })`

- [ ] **Step 1: Test and implement the summary RED-GREEN cycle**

Verify exact employee name, optional customer fallback, service line, product quantity/subtotal lines, payment label, and formatted total.

Use a black rounded `Card` that becomes sticky at desktop widths and remains a normal block on mobile.

- [ ] **Step 2: Write failing form orchestration tests**

Render the form with typed mock data and an injected service spy. Cover:

- Current user becomes the default employee.
- Employee users do not see an employee selector.
- Owner users can change employee.
- Customer defaults to optional and can be selected.
- Empty review displays the composition and payment errors.
- Selecting service plus payment enables a valid review.
- Products-only plus payment enables a valid review.
- Total updates live in the summary.

Use accessible queries (`getByRole`, `getByLabelText`, `getByText`) instead of CSS selectors.

- [ ] **Step 3: Implement the minimal React Hook Form composition**

Use:

```ts
useForm<IncomeFormValues>({
  resolver: zodResolver(incomeFormSchema),
  defaultValues: {
    employeeId: data.currentUser.id,
    customerId: null,
    serviceId: null,
    products: [],
    paymentMethod: null,
  },
});
```

Use `Controller` for service, products, and payment. Use `watch`/`useWatch` for the live summary. Render owner employee and optional customer as labeled native selects styled consistently with shadcn inputs; use `disabled` or omit the employee select for non-owners rather than trusting its value.

The review submission calls a local `handleReview(values)` that stores the validated draft for Task 5 confirmation. It must not call `incomeService.create` yet.

- [ ] **Step 4: Verify form and summary GREEN and commit**

Run:

```bash
npm test -- src/components/incomes/income-summary.test.tsx src/components/incomes/income-form.test.tsx
npm run lint
```

Commit:

```bash
git add src/components/incomes/income-summary* src/components/incomes/income-form*
git commit -m "feat(incomes): compose sale form and live summary"
```

---

### Task 5: Add confirmation, pending, success, and error behavior

**Files:**
- Add with shadcn CLI: `src/components/ui/dialog.tsx`
- Create: `src/components/incomes/income-confirmation-dialog.test.tsx`
- Create: `src/components/incomes/income-confirmation-dialog.tsx`
- Create: `src/components/incomes/income-success-state.test.tsx`
- Create: `src/components/incomes/income-success-state.tsx`
- Modify: `src/components/incomes/income-form.test.tsx`
- Modify: `src/components/incomes/income-form.tsx`

**Interfaces:**
- Consumes: `IncomeService.create`, `CreateIncomeInput`, `Income`, `IncomeSummary`.
- Produces:
  - `IncomeConfirmationDialog({ open, values, data, pending, onBack, onConfirm })`
  - `IncomeSuccessState({ income, onReset })`

- [ ] **Step 1: Add the shadcn dialog component**

Run:

```bash
npx shadcn@latest add dialog
```

Review generated files before staging; accept only the dialog component and required lockfile changes.

- [ ] **Step 2: Test and implement the confirmation dialog RED-GREEN cycle**

Verify the dialog includes the same itemized data as the summary, offers "Volver y editar" and "Confirmar ingreso," calls the correct callbacks, disables both submission paths while pending, and announces loading text.

At mobile width the dialog content uses viewport-safe maximum height and internal overflow; at desktop it remains centered.

- [ ] **Step 3: Test and implement the success state RED-GREEN cycle**

Verify it displays "Ingreso registrado," formatted total, "Cargar otro ingreso," and a link to `/` labeled "Volver al dashboard."

- [ ] **Step 4: Write failing async integration tests in `income-form.test.tsx`**

Use deferred promises to prove:

- Review does not create before final confirmation.
- Confirm sends only employee/customer/service IDs, product IDs/quantities, and payment method.
- Confirm cannot be triggered twice while pending.
- A resolved service displays the success state.
- "Cargar otro ingreso" restores initial defaults.
- A rejected service preserves the form values and permits retry.

- [ ] **Step 5: Implement async state transitions**

Keep explicit state:

```ts
const [reviewValues, setReviewValues] = useState<IncomeFormValues | null>(null);
const [createdIncome, setCreatedIncome] = useState<Income | null>(null);
const [submitError, setSubmitError] = useState<string | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);
```

The confirm callback narrows the validated nullable payment method before building `CreateIncomeInput`, awaits the injected service exactly once, then transitions to success or retains the draft with a Spanish error message.

- [ ] **Step 6: Verify all component tests and commit**

Run:

```bash
npm test -- src/components/incomes
npm run lint
```

Commit:

```bash
git add src/components/ui/dialog.tsx src/components/incomes package.json package-lock.json
git commit -m "feat(incomes): add confirmation and result states"
```

---

### Task 6: Create the responsive Next.js route and verify the complete feature

**Files:**
- Create: `src/app/incomes/new/page.tsx`
- Create: `src/app/incomes/new/page.test.tsx`

**Interfaces:**
- Consumes: typed JSON `IncomeFormData`, `createMockIncomeService`, `IncomeForm`, `AppSidebar`, existing sidebar providers.
- Produces: the static `/incomes/new` route.

- [ ] **Step 1: Re-read the installed Next.js route and metadata docs**

Read:

```text
node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md
node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md
```

Confirm the page remains a synchronous Server Component and delegates interaction to `IncomeForm`.

- [ ] **Step 2: Write the failing route composition test**

Test the synchronous page component for the "Cargar ingreso" heading, "Venta nueva" context, sidebar brand/navigation, and rendered form. Do not test Next routing internals.

- [ ] **Step 3: Implement `page.tsx`**

Export static metadata:

```ts
export const metadata: Metadata = {
  title: "Cargar ingreso",
  description: "Registrá una venta de Bastardos Barbería.",
};
```

Use the existing `TooltipProvider`, `SidebarProvider`, `AppSidebar`, and `SidebarInset`. Unlike the dashboard's no-scroll desktop canvas, allow this form page to scroll vertically. Pass typed mock data and a mock service configured without failure by default into `IncomeForm`.

Use an arrow component plus default export:

```ts
const NewIncomePage = () => { /* synchronous JSX */ };
export default NewIncomePage;
```

- [ ] **Step 4: Run automated verification**

Run:

```bash
npm test
npm run lint
npx next build --webpack
git diff --check
```

Expected:

- Every Vitest test passes.
- ESLint exits 0.
- TypeScript and production compilation succeed.
- Route list includes static `/incomes/new`.
- No whitespace errors.

Use Webpack for final build evidence if Turbopack repeats the known environment-only port-binding panic.

- [ ] **Step 5: Perform manual browser verification**

Start `npm run dev` and verify `/incomes/new` at approximately:

- Notebook: 1440 × 900.
- Narrow notebook: 1024 × 768.
- Phone: 390 × 844.

Checklist:

- No horizontal overflow.
- Sidebar works at desktop and as a sheet on mobile.
- Sticky summary does not cover fields.
- Bottom mobile action does not cover content.
- Every control works with keyboard only.
- Focus is visible.
- Service and payment selections are apparent without hover.
- Product controls have comfortable touch targets.
- Validation points to the relevant section.
- Confirmation fits the viewport.
- Success reset returns to a blank draft.

- [ ] **Step 6: Commit the route**

```bash
git add src/app/incomes/new
git commit -m "feat(incomes): add responsive income creation page"
```

- [ ] **Step 7: Prepare the Pull Request**

Push:

```bash
git push -u origin feat/9-income-form
```

PR target: `dev`
PR reference: `Refs #9`

PR verification summary must list the exact test count, lint result, build result, and the three manually checked viewport sizes.

---

## Final Requirement Trace

- Service-only, products-only, and combined entries: Tasks 1, 3, and 4.
- Optional customer and role-aware employee: Task 4.
- Cash/transfer exclusive payment: Tasks 1 and 3.
- Read-only prices and live integer totals: Tasks 1, 3, and 4.
- Review-before-create: Task 5.
- Pending, duplicate prevention, success, retry, and draft preservation: Task 5.
- Mock/API service separation: Tasks 1 and 2.
- Notebook/mobile responsive shell: Task 6.
- shadcn visual primitives and Bastardos styling: Tasks 3 through 6.
- No backend, stock, commissions, split payment, or route-list scope expansion: Global Constraints and Task 6.
