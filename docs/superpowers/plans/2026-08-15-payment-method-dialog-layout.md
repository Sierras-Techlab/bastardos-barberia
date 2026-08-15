# Payment Method Dialog Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the payment-method administration dialog understandable and non-collapsing at every supported width and display scale.

**Architecture:** Preserve `PaymentMethodsDialog` as the lifecycle/state owner and change only its internal presentation. Replace competing horizontal flex rows with a vertical create form and independent method cards whose identity, status and actions occupy separate layout regions.

**Tech Stack:** React 19, TypeScript strict mode, Tailwind CSS, existing shadcn/base-ui components, Vitest, Testing Library and the authenticated in-app browser.

## Global Constraints

- Preserve the existing payment-method API, SQL, permissions, mutations and parent state contract.
- Use the same internal composition at phone and desktop widths; method identity and actions must never be hidden or compressed away.
- Keep the existing rounded neutral surfaces, red destructive accent and Sonner notifications.
- Keep every icon-only action accessible through a method-specific `aria-label`.
- Add no dependency.

---

### Task 1: Non-collapsing payment-method cards

**Files:**
- Modify: `src/components/incomes/payment-methods-dialog.tsx`
- Modify: `src/components/incomes/payment-methods-dialog.test.tsx`
- Modify: `context_snapshot.md`

**Interfaces:**
- Consumes: the existing `methods: PaymentMethod[]`, `paymentMethodClient`, `onMethodsChange` and `onClose` props.
- Produces: the same `PaymentMethodsDialog` component API with a stable vertical create form and card-based method list.

- [ ] **Step 1: Write the failing structural test**

Add a test that renders an active method, locates the dialog regions through stable test IDs and verifies the approved composition:

```tsx
it("keeps creation and method actions in non-collapsing card regions", () => {
  render(
    <PaymentMethodsDialog
      methods={[active]}
      paymentMethodClient={createClient()}
      onMethodsChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  expect(screen.getByTestId("payment-method-create-form")).toHaveClass(
    "grid",
    "grid-cols-1",
  );

  const card = screen.getByTestId(`payment-method-card-${active.id}`);
  expect(within(card).getByText("Efectivo")).toBeVisible();
  expect(within(card).getByText("Activo")).toBeVisible();
  expect(within(card).getByRole("button", { name: "Editar Efectivo" })).toBeVisible();
  expect(within(card).getByRole("button", { name: "Desactivar Efectivo" })).toHaveTextContent("Desactivar");
  expect(within(card).getByRole("button", { name: "Eliminar Efectivo" })).toBeVisible();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- src/components/incomes/payment-methods-dialog.test.tsx
```

Expected: FAIL because the stable create/card regions and explicit `Editar` action do not exist.

- [ ] **Step 3: Implement the approved create form**

Replace the responsive flex form with an always-stable grid:

```tsx
<form
  data-testid="payment-method-create-form"
  className="mt-4 grid grid-cols-1 gap-2"
  onSubmit={create}
>
  <Input
    aria-label="Nuevo medio de pago"
    value={newName}
    onChange={(event) => setNewName(event.target.value)}
    placeholder="Nombre del medio de pago"
    className={fieldClassName}
  />
  <Button type="submit" className="h-10 w-full rounded-xl" disabled={saving}>
    <Plus /> Agregar medio
  </Button>
</form>
```

- [ ] **Step 4: Implement independent method cards**

Replace the divided shared list with a grid of cards. Each card must preserve identity separately from its actions:

```tsx
const activeBadgeClass = "shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700";
const inactiveBadgeClass = "shrink-0 rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700";

<ul className="grid gap-2">
  {visibleMethods.map((method) => (
    <li
      key={method.id}
      data-testid={`payment-method-card-${method.id}`}
      className="rounded-2xl border border-black/5 bg-[#f7f6f3] p-3"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{method.name}</p>
        <span className={method.isActive ? activeBadgeClass : inactiveBadgeClass}>
          {method.isActive ? "Activo" : "Inactivo"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Button
          type="button"
          variant="outline"
          aria-label={`Editar ${method.name}`}
          disabled={saving}
          onClick={() => {
            setEditing(method);
            setEditingName(method.name);
            setError(null);
          }}
        >
          <Pencil /> Editar
        </Button>
        <Button
          type="button"
          variant={method.isActive ? "outline" : "default"}
          aria-label={`${method.isActive ? "Desactivar" : "Reactivar"} ${method.name}`}
          disabled={saving}
          onClick={() => setActive(method)}
        >
          {method.isActive ? "Desactivar" : "Reactivar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Eliminar ${method.name}`}
          disabled={saving}
          onClick={() => {
            setDeleting(method);
            setError(null);
          }}
          className="text-destructive hover:bg-red-50 hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  ))}
</ul>
```

On narrow cards, use `grid-cols-1` for the action group and promote it to `sm:grid-cols-[1fr_1fr_auto]`; this keeps every control readable even under increased display scaling. Keep the method-specific accessible names expected by the existing behavior tests.

- [ ] **Step 5: Run the component tests and TypeScript**

Run:

```bash
npm test -- src/components/incomes/payment-methods-dialog.test.tsx src/components/incomes/payment-method-delete-dialog.test.tsx
npx tsc --noEmit
git diff --check
```

Expected: all focused tests, TypeScript and diff checks pass.

- [ ] **Step 6: Validate the real layout**

Run the application and inspect the authenticated `/incomes` dialog at the default desktop viewport and at 390×844. At both sizes verify:

```js
({
  documentOverflow: document.documentElement.scrollWidth > window.innerWidth,
  dialogOverflow: Array.from(document.querySelectorAll('[role="dialog"]'))
    .some((dialog) => dialog.scrollWidth > dialog.clientWidth),
})
```

Expected: both values are `false`; the input, every method name, status and action remain visible, and browser error/warning logs are empty.

- [ ] **Step 7: Update operational context and run full verification**

Record the root cause, layout change and browser evidence in `context_snapshot.md`, then run:

```bash
npm test -- --maxWorkers=2 --reporter=dot
npm run lint
npm run build -- --webpack
git diff --check
```

Expected: complete tests, ESLint, production build and diff check pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/incomes/payment-methods-dialog.tsx src/components/incomes/payment-methods-dialog.test.tsx context_snapshot.md
git commit -m "fix(payment-methods): clarify administration layout"
```
