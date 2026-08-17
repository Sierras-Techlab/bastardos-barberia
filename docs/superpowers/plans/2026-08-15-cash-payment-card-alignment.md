# Cash Payment Card Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the payment-method card with the sales table at desktop widths without changing mobile stacking.

**Architecture:** Keep the existing audit grid and apply a responsive top offset to its right column. Cover the layout contract in the existing cash view test.

**Tech Stack:** React 19, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Use `lg:pt-[3.75rem]` only on the payment/adjustment column.
- Do not restructure cash components or change mobile layout.

---

### Task 1: Align the payment column

**Files:**
- Modify: `src/components/cash/cash-view.test.tsx`
- Modify: `src/components/cash/cash-view.tsx`
- Modify: `context_snapshot.md`

**Interfaces:**
- Consumes: the existing two-column audit grid.
- Produces: a right column aligned with the sales table at `lg` and above.

- [ ] **Step 1: Add the failing layout assertion**

Assert that the parent of the payment card has `lg:pt-[3.75rem]`.

- [ ] **Step 2: Verify RED**

Run `npm test -- src/components/cash/cash-view.test.tsx --reporter=dot` and expect the class assertion to fail.

- [ ] **Step 3: Add the responsive offset**

Change the right wrapper to:

```tsx
<div className="space-y-5 lg:pt-[3.75rem]">
```

- [ ] **Step 4: Verify GREEN and layout**

Run the focused test, then validate desktop alignment and 390×844 stacking in the local browser.

- [ ] **Step 5: Complete verification and commit**

Run `npm test`, `npm run lint`, `npm run build -- --webpack` and `git diff --check`. Update `context_snapshot.md` and commit as `fix(cash): align payment breakdown with sales`.
