# Payment Selector Visual Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore card-based payment-method selection while retaining the dynamic catalog and arbitrary multi-method allocations.

**Architecture:** Keep `PaymentMethodSelector`'s public contract unchanged and derive the selected visual mode from `payments`. Single-method cards replace allocations with the full total; a synthetic combined card expands the existing dynamic allocation editor.

**Tech Stack:** React 19, TypeScript strict mode, Tailwind CSS, Lucide icons, Testing Library, Vitest.

## Global Constraints

- Render only active payment methods.
- Never branch behavior on fixed method names or IDs.
- Preserve arbitrary split allocations, catalog cleanup and exact remaining/excess validation.
- Do not change backend, API, database, form schema or persisted income contracts.
- Use real buttons with `aria-pressed` and preserve existing explicit control labels.

---

### Task 1: Restore card selection and retain dynamic combined allocations

**Files:**
- Modify: `src/components/incomes/payment-method-selector.tsx`
- Test: `src/components/incomes/payment-method-selector.test.tsx`

**Interfaces:**
- Consumes: `PaymentMethodSelector({ methods, payments, total, onChange, error })` and `IncomePaymentInput`.
- Produces: the same `onChange(payments: IncomePaymentInput[])` contract with no schema changes.

- [ ] **Step 1: Write failing card-selection tests**

Add tests proving the visible contract:

```tsx
it("renders active methods and combined as selectable cards", () => {
  render(
    <PaymentMethodSelector
      methods={methods}
      payments={[{ paymentMethodId: methods[0].id, amount: 49000 }]}
      total={49000}
      onChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: "Efectivo" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Transferencia" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "Combinado" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.queryByRole("button", { name: "Cheque" })).not.toBeInTheDocument();
});

it("selects one method for the complete total", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <PaymentMethodSelector
      methods={methods}
      payments={[{ paymentMethodId: methods[0].id, amount: 49000 }]}
      total={49000}
      onChange={onChange}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Tarjeta" }));
  expect(onChange).toHaveBeenLastCalledWith([
    { paymentMethodId: methods[2].id, amount: 49000 },
  ]);
});

it("opens combined mode with two distinct dynamic methods", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <PaymentMethodSelector
      methods={methods}
      payments={[{ paymentMethodId: methods[0].id, amount: 49000 }]}
      total={49000}
      onChange={onChange}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Combinado" }));
  expect(onChange).toHaveBeenLastCalledWith([
    { paymentMethodId: methods[0].id, amount: 49000 },
    { paymentMethodId: methods[1].id, amount: 0 },
  ]);
});
```

Update the existing editor-oriented tests so they enter or start in combined mode before looking for allocation controls:

- In the add/remove test, click `Combinado`, rerender with the emitted two-allocation value, then add the third active method and remove it.
- In the remaining/exact/excess test, provide at least two distinct allocations for every case so the combined editor and its `role="status"` feedback are visible.
- Keep the inactive-catalog cleanup assertion unchanged; it verifies data normalization independently of the visible mode.
- Keep the zero-allocation auto-fill assertion and replace the inactive `<option>` assertion with an inactive-card assertion so the test reflects the restored hierarchy.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm test -- src/components/incomes/payment-method-selector.test.tsx
```

Expected: the new tests fail because the current implementation renders allocation rows immediately and has no card buttons or combined selection.

- [ ] **Step 3: Implement derived selection and card grid**

In `PaymentMethodSelector`:

```tsx
const combined = payments.length > 1;
const selectedMethodId = payments.length === 1 ? payments[0].paymentMethodId : null;

const selectSingle = (paymentMethodId: string) => {
  onChange([{ paymentMethodId, amount: total }]);
};

const selectCombined = () => {
  if (payments.length > 1) return;
  const current = payments[0] ?? {
    paymentMethodId: activeMethods[0].id,
    amount: total,
  };
  const additional = activeMethods.find(
    ({ id }) => id !== current.paymentMethodId,
  );
  if (additional) {
    onChange([current, { paymentMethodId: additional.id, amount: 0 }]);
  }
};
```

Render a responsive card grid before the allocation editor. Each active method is a button with `aria-pressed={selectedMethodId === method.id}`; `Combinado` uses `aria-pressed={combined}` and is disabled when fewer than two active methods exist. Apply the prior classes: `min-h-20`, `rounded-2xl`, primary selected state, warm-gray unselected state, ring, shadow and hover lift. Use a neutral payment icon for dynamically named methods and `Split` for the synthetic combined card; do not infer icons or behavior from names.

Render the existing allocation-row editor only when `combined` is true. Keep the add/remove methods, distinct-option filtering, amount editing, balance status and error rendering unchanged inside a rounded warm-gray panel.

- [ ] **Step 4: Run selector and form tests and verify GREEN**

Run:

```bash
npm test -- src/components/incomes/payment-method-selector.test.tsx src/components/incomes/income-form.test.tsx
```

Expected: all selector and form tests pass; single-method selection still auto-fills the total and arbitrary combined allocations remain supported.

- [ ] **Step 5: Run complete verification**

Run:

```bash
npm test -- --maxWorkers=2 --reporter=dot
npm run lint
npm run build -- --webpack
git diff --check
```

Expected: all tests pass, build succeeds, diff check is clean, and lint has no errors. The known unused-variable warning must be removed if still present in the current tree.

- [ ] **Step 6: Update durable context and commit**

Update `context_snapshot.md` to record the restored card selector and the fresh verification counts, then commit:

```bash
git add src/components/incomes/payment-method-selector.tsx \
  src/components/incomes/payment-method-selector.test.tsx \
  context_snapshot.md
git commit -m "feat(incomes): restore payment selection cards"
```
