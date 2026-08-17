# Income Pagination Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render one authoritative server-backed paginator for `/incomes` on desktop and mobile.

**Architecture:** `IncomesView` remains the owner of page state and API requests. `IncomeTable` becomes a presentation-only table for the rows already selected by the server, eliminating its independent TanStack pagination feature and controls.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, TanStack Table, Vitest, Testing Library.

## Global Constraints

- Preserve the current API contract, page size, filters, metrics and role-safe query behavior.
- Keep the surviving paginator below the desktop table and mobile list.
- Do not refactor the independently correct paginators in users, cash history or customer visit history.
- Follow test-driven development and update `context_snapshot.md` after verification.

---

### Task 1: Remove nested income pagination

**Files:**
- Modify: `src/components/incomes/incomes-view.test.tsx`
- Modify: `src/components/incomes/income-table.tsx`
- Modify: `context_snapshot.md`

**Interfaces:**
- Consumes: `IncomesView` receives `PaginatedIncomes` and calls `IncomeClient.list(query: IncomeListQuery)`.
- Produces: `IncomeTable({ incomes, onSelect })` renders every supplied row without owning pagination; `IncomesView` exposes the only page controls.

- [ ] **Step 1: Write the failing regression test**

Add a two-page server response and assert that the rendered desktop view exposes exactly one control of each kind and requests page two:

```tsx
it("uses one server paginator for the income table", async () => {
  const user = userEvent.setup();
  const secondPage = {
    ...data,
    pagination: { page: 2, pageSize: 10, total: 12, totalPages: 2 },
  };
  const firstPage = {
    ...data,
    pagination: { page: 1, pageSize: 10, total: 12, totalPages: 2 },
  };
  const incomeClient = client();
  vi.mocked(incomeClient.list).mockResolvedValueOnce(secondPage);

  render(
    <IncomesView
      data={firstPage}
      initialQuery={initialQuery}
      currentUser={currentUser}
      employees={[currentUser]}
      paymentMethods={paymentMethods}
      canViewAll
      canVoid
      incomeClient={incomeClient}
    />,
  );

  expect(screen.getAllByRole("button", { name: "Anterior" })).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "Siguiente" })).toHaveLength(1);
  expect(screen.getAllByText("Página 1 de 2")).toHaveLength(1);

  await user.click(screen.getByRole("button", { name: "Siguiente" }));

  await waitFor(() =>
    expect(incomeClient.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10 }),
    ),
  );
  expect(await screen.findByText("Página 2 de 2")).toBeVisible();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- src/components/incomes/incomes-view.test.tsx --reporter=dot
```

Expected: FAIL because desktop currently renders two `Anterior` buttons, two `Siguiente` buttons and both `Página 1 de 1` and `Página 1 de 2`.

- [ ] **Step 3: Remove the table-owned paginator**

In `income-table.tsx`:

```tsx
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";

const features = tableFeatures({});

const table = useTable({
  features,
  data: incomes,
  columns,
});
```

Delete `createPaginatedRowModel`, `rowPaginationFeature`, the `initialState.pagination` block and the complete footer containing the local page counter and navigation buttons. Preserve the table container, headers, rows and selection actions unchanged.

- [ ] **Step 4: Run the focused income tests and verify GREEN**

Run:

```bash
npm test -- src/components/incomes/incomes-view.test.tsx --reporter=dot
```

Expected: PASS. The next-page click must call the server client with `{ page: 2, pageSize: 10 }`.

- [ ] **Step 5: Verify the repository pagination audit**

Run:

```bash
rg -n "getPaginationRowModel|createPaginatedRowModel|Página .* de|Anterior|Siguiente" src/components
```

Expected: income pagination appears only in `incomes-view.tsx`; users, cash and customer visits each retain one independent server-backed paginator.

- [ ] **Step 6: Run complete verification**

Run:

```bash
npm test
npm run lint
npm run build -- --webpack
git diff --check
```

Expected: all commands exit successfully and the build lists `/incomes`.

- [ ] **Step 7: Record and commit the fix**

Update `context_snapshot.md` with the root cause, audited views and fresh verification evidence, then run:

```bash
git add src/components/incomes/incomes-view.test.tsx src/components/incomes/income-table.tsx context_snapshot.md
git commit -m "fix(incomes): remove duplicate pagination"
```
