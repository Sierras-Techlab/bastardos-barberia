# Frontend-Independent Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose employee commission rates, make zero-valued commission inputs editable, add fixed-customer filtering and preserve verified role-scoped dashboard summaries without changing backend contracts.

**Architecture:** Extend the current responsive user and customer components in place. Keep number-input text raw until valid submission, compose fixed-schedule filtering with the existing client-side customer pipeline, and retain the dashboard's existing server-side role scoping.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS, existing shadcn/base-ui components, Vitest and Testing Library.

## Global Constraints

- Do not change Route Handler contracts, SQL functions, database tables or persisted behavior.
- Preserve existing responsive styling and Spanish copy.
- Commission payloads remain numeric integers from 0 through 100.
- Customer schedule filtering uses the existing `fixedSchedule` response field.
- Preserve unrelated local changes in `src/components/incomes/commission-preview.tsx` and the session commission-hydration fix.

---

### Task 1: Display commission rates in the user directory

**Files:**
- Modify: `src/components/users/user-list.tsx`
- Test: `src/components/users/users-view.test.tsx`

**Interfaces:**
- Consumes: `SafeUser.serviceCommissionRate` and `SafeUser.productCommissionRate`.
- Produces: separate accessible service/product values in desktop and mobile presentations.

- [ ] **Step 1: Write the failing responsive-list assertions**

Set the employee fixture rates to 45 and 10, then add:

```tsx
expect(screen.getAllByLabelText("Comisión servicios de Lucía Ferreyra: 45%")).toHaveLength(2);
expect(screen.getAllByLabelText("Comisión productos de Lucía Ferreyra: 10%")).toHaveLength(2);
```

- [ ] **Step 2: Run the test and verify RED**

```bash
npm test -- src/components/users/users-view.test.tsx
```

Expected: FAIL because the commission labels are absent.

- [ ] **Step 3: Add desktop columns and mobile values**

Use one seven-column template on the desktop header and rows:

```ts
md:grid-cols-[minmax(13rem,1.4fr)_8rem_7rem_9rem_9rem_9rem_3rem]
```

Add headers `Comisión servicios` and `Comisión productos` before `Último acceso`. Render each desktop value as `{rate}%` with the tested aria-label. Below the mobile last-access copy, render:

```tsx
<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-zinc-500 md:hidden">
  <span aria-label={`Comisión servicios de ${fullName}: ${user.serviceCommissionRate}%`}>
    Servicios {user.serviceCommissionRate}%
  </span>
  <span aria-label={`Comisión productos de ${fullName}: ${user.productCommissionRate}%`}>
    Productos {user.productCommissionRate}%
  </span>
</div>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

```bash
npm test -- src/components/users/users-view.test.tsx
```

Expected: all user view tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/users/user-list.tsx src/components/users/users-view.test.tsx
git commit -m "feat(users): show commission rates in directory"
```

### Task 2: Allow commission inputs to be cleared and replaced

**Files:**
- Modify: `src/components/users/user-editor-dialog.tsx`
- Test: `src/components/users/user-editor-dialog.test.tsx`

**Interfaces:**
- Consumes and preserves numeric `FrontendCreateUserInput`/`FrontendUpdateUserInput` commission properties.
- Produces string-based input state converted only after validation.

- [ ] **Step 1: Write the failing edit test**

Render edit mode with product commission `0`, then:

```tsx
const input = screen.getByLabelText("Comisión por productos (%)");
await browser.clear(input);
expect(input).toHaveValue(null);
await browser.type(input, "20");
await browser.click(screen.getByRole("button", { name: "Guardar cambios" }));
expect(onUpdate).toHaveBeenCalledWith({ productCommissionRate: 20 });
```

- [ ] **Step 2: Run the test and verify RED**

```bash
npm test -- src/components/users/user-editor-dialog.test.tsx
```

Expected: FAIL because clearing immediately restores zero.

- [ ] **Step 3: Store raw strings and validate on submit**

Initialize both fields with `String(commissionUser?.serviceCommissionRate ?? 0)` and keep `event.target.value` unchanged. In `submit`, calculate:

```ts
const parsedServiceCommissionRate = Number(serviceCommissionRate);
const parsedProductCommissionRate = Number(productCommissionRate);
const validCommissions = [
  [serviceCommissionRate, parsedServiceCommissionRate],
  [productCommissionRate, parsedProductCommissionRate],
].every(([raw, parsed]) => String(raw).trim() !== ""
  && Number.isInteger(parsed)
  && Number(parsed) >= 0
  && Number(parsed) <= 100);
```

Use parsed numeric values in comparisons and payloads. Keep the existing validation message when invalid.

- [ ] **Step 4: Cover empty submission and verify GREEN**

Clear one commission, submit and assert the alert contains `Las comisiones deben ser porcentajes enteros entre 0 y 100.` and `onUpdate` was not called. Then run:

```bash
npm test -- src/components/users/user-editor-dialog.test.tsx
```

Expected: all editor tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/users/user-editor-dialog.tsx src/components/users/user-editor-dialog.test.tsx
git commit -m "fix(users): allow replacing zero commission rates"
```

### Task 3: Filter customers by fixed schedule

**Files:**
- Modify: `src/types/customer.ts`
- Modify: `src/lib/customers/customer-catalog.ts`
- Modify: `src/components/customers/customers-view.tsx`
- Test: `src/lib/customers/customer-catalog.test.ts`
- Test: `src/components/customers/customers-view.test.tsx`

**Interfaces:**
- Produces: `CustomerScheduleFilter = "all" | "fixed" | "not-fixed"`.
- Produces: `filterCustomers(customers, query, schedule = "all")`.

- [ ] **Step 1: Write failing catalog tests**

With one scheduled and one regular customer, assert:

```ts
expect(filterCustomers(customers, "", "fixed").map(({ id }) => id)).toEqual(["fixed"]);
expect(filterCustomers(customers, "", "not-fixed").map(({ id }) => id)).toEqual(["regular"]);
```

- [ ] **Step 2: Run the catalog test and verify RED**

```bash
npm test -- src/lib/customers/customer-catalog.test.ts
```

Expected: FAIL because the third argument is unsupported.

- [ ] **Step 3: Implement the catalog filter**

Export the union type from `src/types/customer.ts`. In `filterCustomers`, reject a customer before text matching when:

```ts
const matchesSchedule = schedule === "all"
  || (schedule === "fixed" && customer.fixedSchedule !== null)
  || (schedule === "not-fixed" && customer.fixedSchedule === null);
```

Return `false` when it does not match; otherwise apply the existing name/email/phone logic.

- [ ] **Step 4: Write the failing view interaction test**

Render a local two-customer fixture, select `fixed`, assert only the scheduled customer remains in desktop/mobile, click `Limpiar`, and assert both return.

- [ ] **Step 5: Implement the view selector**

Add `scheduleFilter` state defaulting to `all`; pass it to `filterCustomers`; add this selector between search and sort:

```tsx
<select aria-label="Filtrar por horario fijo" value={scheduleFilter}
  onChange={(event) => setScheduleFilter(event.target.value as CustomerScheduleFilter)}>
  <option value="all">Todos los clientes</option>
  <option value="fixed">Clientes fijos</option>
  <option value="not-fixed">Sin horario fijo</option>
</select>
```

Use `lg:grid-cols-[minmax(16rem,1fr)_12rem_14rem_auto]`. Enable `Limpiar` when this filter is not `all` and reset it with query/sort.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
npm test -- src/lib/customers/customer-catalog.test.ts src/components/customers/customers-view.test.tsx
```

Expected: all customer tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/customer.ts src/lib/customers/customer-catalog.ts src/lib/customers/customer-catalog.test.ts src/components/customers/customers-view.tsx src/components/customers/customers-view.test.tsx
git commit -m "feat(customers): filter directory by fixed schedule"
```

### Task 4: Verify dashboard role scoping and project state

**Files:**
- Verify: `src/app/(dashboard)/(home)/page.test.tsx`
- Verify: `src/lib/incomes/service.test.ts`
- Modify: `context_snapshot.md`
- Modify: `product.md`

**Interfaces:**
- Consumes existing server-enforced `listIncomes(actor, query)` scoping.
- Produces documentation of the completed frontend behavior; no dashboard production change.

- [ ] **Step 1: Verify existing role regression coverage**

```bash
npm test -- src/app/\(dashboard\)/\(home\)/page.test.tsx src/lib/incomes/service.test.ts
```

Expected: PASS for the employee dashboard and employee/manager income-scope cases. If either fails, investigate server scoping instead of adding client filtering.

- [ ] **Step 2: Update durable documentation**

Record in `context_snapshot.md` that commissions are visible, zero can be replaced and customer schedules can be filtered. Update the user administration and customer module result cells in `product.md` with the same delivered behavior.

- [ ] **Step 3: Run complete verification**

Run independently:

```bash
npm test -- --maxWorkers=2 --reporter=dot
npm run lint
npm run build -- --webpack
git diff --check
```

Expected: 0 failures/errors and a successful production build.

- [ ] **Step 4: Commit documentation**

```bash
git add context_snapshot.md product.md
git commit -m "docs: record frontend directory improvements"
```

