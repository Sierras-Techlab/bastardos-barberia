# Payment Method Sidebar Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant payment-method placeholder from manager navigation while retaining payment-method administration inside `/incomes`.

**Architecture:** Delete the single static navigation entry and its now-unused icon import. Protect the product decision with a manager sidebar regression test; do not alter routes, APIs or the income modal.

**Tech Stack:** React 19, TypeScript, Next.js 16, Vitest and Testing Library.

## Global Constraints

- Preserve the `Ingresos` link and the manager-only modal inside `/incomes`.
- Do not change payment-method API, SQL or lifecycle behavior.
- Add no dependency.

---

### Task 1: Remove redundant navigation entry

**Files:**
- Modify: `src/components/app-sidebar.tsx`
- Modify: `src/components/app-sidebar.test.tsx`
- Modify: `context_snapshot.md`

**Interfaces:**
- Consumes: existing `AppSidebar({ user, activeItem? })` props.
- Produces: the same sidebar API without a `Medios de pago` menu item.

- [ ] **Step 1: Write the failing manager navigation test**

```tsx
it("keeps payment-method administration contextual to incomes", () => {
  render(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={owner} />
      </SidebarProvider>
    </TooltipProvider>,
  );

  expect(screen.queryByText("Medios de pago")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ingresos" })).toHaveAttribute(
    "href",
    "/incomes",
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run `npm test -- src/components/app-sidebar.test.tsx`.

Expected: FAIL because the manager sidebar still renders `Medios de pago`.

- [ ] **Step 3: Remove the entry and unused icon**

Delete this entry from `administrationNavigation`:

```ts
{ label: "Medios de pago", icon: CreditCard },
```

Remove `CreditCard` from the `lucide-react` import. Do not modify any other navigation item.

- [ ] **Step 4: Run focused verification**

```bash
npm test -- src/components/app-sidebar.test.tsx src/components/incomes/payment-methods-dialog.test.tsx
npx tsc --noEmit
git diff --check
```

Expected: all tests, TypeScript and diff checks pass.

- [ ] **Step 5: Update context and run complete verification**

Document the contextual navigation decision and the pending manual migration `016` in `context_snapshot.md`, then run:

```bash
npm test -- --maxWorkers=2 --reporter=dot
npm run lint
npm run build -- --webpack
git diff --check
```

Expected: full suite, lint, build and diff checks pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/app-sidebar.tsx src/components/app-sidebar.test.tsx context_snapshot.md
git commit -m "refactor(navigation): keep payment methods in incomes"
```
