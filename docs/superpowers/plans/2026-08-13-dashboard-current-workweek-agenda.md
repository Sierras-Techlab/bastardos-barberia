# Dashboard Current Workweek Agenda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard fixed-customer agenda show only appointments from the current Buenos Aires date through the current week's Saturday, with no next-week appointments before Monday.

**Architecture:** Introduce a pure date-range helper for the dashboard's Monday-through-Saturday operational week. The server page will use that range independently from the existing seven-day income range and will skip the occurrence service on Sundays. The card remains responsible only for display ordering and attendance actions.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- Interpret the current date in `America/Argentina/Buenos_Aires`.
- Preserve the existing seven-day income summary behavior.
- Preserve occurrence generation, attendance persistence, authorization, and error propagation.
- Do not add a database migration or SQL query file; this change has no persistence impact.
- Work directly on `feat/backend-models`, where the user needs the result for their pull request.
- Follow test-driven development: add each failing test before the corresponding production change.

---

### Task 1: Add a deterministic Buenos Aires workweek range helper

**Files:**

- Create: `src/lib/dashboard/workweek-range.ts`
- Create: `src/lib/dashboard/workweek-range.test.ts`

- [ ] **Step 1: Write failing unit tests for the operational-week boundaries**

Create `src/lib/dashboard/workweek-range.test.ts` with cases using explicit instants:

```ts
import { describe, expect, it } from "vitest";

import { getBuenosAiresRemainingWorkweekRange } from "@/lib/dashboard/workweek-range";

describe("getBuenosAiresRemainingWorkweekRange", () => {
  it.each([
    ["Monday", "2026-08-10T15:00:00.000Z", { dateFrom: "2026-08-10", dateTo: "2026-08-15" }],
    ["Thursday", "2026-08-13T15:00:00.000Z", { dateFrom: "2026-08-13", dateTo: "2026-08-15" }],
    ["Saturday", "2026-08-15T15:00:00.000Z", { dateFrom: "2026-08-15", dateTo: "2026-08-15" }],
  ])("returns the remaining range on %s", (_label, instant, expected) => {
    expect(getBuenosAiresRemainingWorkweekRange(new Date(instant))).toEqual(expected);
  });

  it("returns null on Sunday", () => {
    expect(getBuenosAiresRemainingWorkweekRange(new Date("2026-08-16T15:00:00.000Z"))).toBeNull();
  });

  it("uses the Buenos Aires date near UTC midnight", () => {
    expect(getBuenosAiresRemainingWorkweekRange(new Date("2026-08-17T01:30:00.000Z"))).toBeNull();
    expect(getBuenosAiresRemainingWorkweekRange(new Date("2026-08-17T03:30:00.000Z"))).toEqual({
      dateFrom: "2026-08-17",
      dateTo: "2026-08-22",
    });
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails because the helper does not exist**

Run:

```bash
npm test -- --run src/lib/dashboard/workweek-range.test.ts
```

Expected: FAIL with an unresolved `@/lib/dashboard/workweek-range` import.

- [ ] **Step 3: Implement the smallest deterministic helper**

Create `src/lib/dashboard/workweek-range.ts` exporting:

```ts
export type DashboardWorkweekRange = {
  dateFrom: string;
  dateTo: string;
};

export const getBuenosAiresRemainingWorkweekRange = (
  now = new Date(),
): DashboardWorkweekRange | null => {
  // Format the calendar date in America/Argentina/Buenos_Aires.
  // Derive its UTC-safe weekday from YYYY-MM-DD.
  // Return null for Sunday; otherwise add 6 - weekday days to reach Saturday.
};
```

Use `Intl.DateTimeFormat(...).formatToParts()` as in `src/lib/dashboard/income-summary.ts`, and perform date-only arithmetic through a UTC noon anchor so host timezone and daylight-saving settings cannot shift the calendar day.

- [ ] **Step 4: Run the helper test and confirm it passes**

Run:

```bash
npm test -- --run src/lib/dashboard/workweek-range.test.ts
```

Expected: PASS for Monday, Thursday, Saturday, Sunday, and both UTC-midnight boundary instants.

- [ ] **Step 5: Commit the helper and its tests**

```bash
git add src/lib/dashboard/workweek-range.ts src/lib/dashboard/workweek-range.test.ts
git commit -m "feat(dashboard): calculate remaining workweek range"
```

---

### Task 2: Query only the remaining workweek from the dashboard

**Files:**

- Modify: `src/app/(dashboard)/(home)/page.test.tsx`
- Modify: `src/app/(dashboard)/(home)/page.tsx`

- [ ] **Step 1: Extend the page test with an explicit workweek-range mock**

Mock `@/lib/dashboard/workweek-range` with a hoisted function and default it in `beforeEach` to:

```ts
{ dateFrom: "2026-08-13", dateTo: "2026-08-15" }
```

Update the existing fixed-occurrence assertion to require the exact service call:

```ts
expect(listFixedOccurrences).toHaveBeenCalledWith(expect.anything(), {
  dateFrom: "2026-08-13",
  dateTo: "2026-08-15",
});
```

Add a Sunday case that makes the helper return `null`, renders the page, asserts `listFixedOccurrences` was not called, and verifies the card receives/rendered the empty state.

- [ ] **Step 2: Run the page test and confirm the new assertions fail**

Run:

```bash
npm test -- --run "src/app/(dashboard)/(home)/page.test.tsx"
```

Expected: FAIL because the page still queries from today through 56 days and does not skip Sunday.

- [ ] **Step 3: Replace the 56-day query with the approved workweek range**

In `src/app/(dashboard)/(home)/page.tsx`:

- import `getBuenosAiresRemainingWorkweekRange`;
- remove the local `addDays` helper;
- calculate `fixedCustomerRange` independently from `getBuenosAiresSevenDayRange()`;
- call `listFixedOccurrences(user, fixedCustomerRange)` only when the helper returns a range;
- resolve `[]` without a service call on Sunday;
- stop passing a dashboard date cutoff that duplicates the server query.

The relevant data flow should be equivalent to:

```ts
const incomeRange = getBuenosAiresSevenDayRange();
const fixedCustomerRange = getBuenosAiresRemainingWorkweekRange();

const fixedOccurrencesPromise = fixedCustomerRange
  ? listFixedOccurrences(user, fixedCustomerRange)
  : Promise.resolve([]);
```

- [ ] **Step 4: Run the page test and confirm it passes**

Run:

```bash
npm test -- --run "src/app/(dashboard)/(home)/page.test.tsx"
```

Expected: PASS, including the exact Thursday-through-Saturday query and Sunday service skip.

---

### Task 3: Make the fixed-customer card describe the bounded agenda accurately

**Files:**

- Modify: `src/components/dashboard/fixed-customers-card.test.tsx`
- Modify: `src/components/dashboard/fixed-customers-card.tsx`

- [ ] **Step 1: Update the card tests for its server-bounded input contract**

Remove the `dateFrom`-filtering expectation because the server now supplies the exact range. Keep coverage for chronological order and attendance updates. Change the empty-state expectation to:

```ts
screen.getByText("No hay turnos fijos para el resto de la semana")
```

- [ ] **Step 2: Run the card test and confirm the copy assertion fails**

Run:

```bash
npm test -- --run src/components/dashboard/fixed-customers-card.test.tsx
```

Expected: FAIL because the old empty copy is still rendered.

- [ ] **Step 3: Simplify the card props and update the empty state**

In `src/components/dashboard/fixed-customers-card.tsx`:

- remove the optional `dateFrom` prop and client-side cutoff;
- initialize state by chronologically sorting all supplied occurrences;
- keep attendance transitions unchanged;
- render `No hay turnos fijos para el resto de la semana` when empty.

- [ ] **Step 4: Run all focused agenda tests**

Run:

```bash
npm test -- --run src/lib/dashboard/workweek-range.test.ts "src/app/(dashboard)/(home)/page.test.tsx" src/components/dashboard/fixed-customers-card.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the dashboard integration**

```bash
git add "src/app/(dashboard)/(home)/page.tsx" "src/app/(dashboard)/(home)/page.test.tsx" src/components/dashboard/fixed-customers-card.tsx src/components/dashboard/fixed-customers-card.test.tsx
git commit -m "fix(dashboard): limit agenda to current workweek"
```

---

### Task 4: Update project state and run complete verification

**Files:**

- Modify: `context_snapshot.md`
- Modify: `product.md`
- Modify: `AGENTS.md` only if the durable dashboard invariant is not already captured elsewhere

- [ ] **Step 1: Update project documentation**

Record that:

- `feat/backend-models` contains the integrated commercial-operations work and this agenda correction;
- Inicio shows only fixed appointments remaining in the current Buenos Aires Monday-through-Saturday week;
- Sunday is intentionally empty and the window rotates on Monday;
- no database migration is needed for this correction;
- existing Supabase migrations `010` and `011` from the broader feature remain the database deployment requirement.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0 with no new lint errors.

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected: Next.js production build completes successfully.

- [ ] **Step 5: Check the final diff for whitespace and scope**

Run:

```bash
git diff --check
git status --short
git diff --stat HEAD~2..HEAD
```

Expected: no whitespace errors; only the planned agenda and documentation files are changed.

- [ ] **Step 6: Commit the documentation update**

```bash
git add context_snapshot.md product.md AGENTS.md
git commit -m "docs: record current-workweek agenda behavior"
```

If `AGENTS.md` did not require a change, omit it from `git add`.

- [ ] **Step 7: Perform final completion review**

Confirm all acceptance criteria:

- Thursday shows only Thursday, Friday, and Saturday occurrences.
- No occurrence from the following week appears before Monday.
- Sunday makes no fixed-occurrence service call and shows the bounded empty state.
- Monday automatically rotates to the new Monday-through-Saturday window.
- Income metrics retain their prior seven-day range.
- No SQL file was added because the database model did not change.

