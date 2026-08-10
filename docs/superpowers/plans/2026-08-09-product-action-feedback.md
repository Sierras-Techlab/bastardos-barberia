# Product Action Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an accessible, temporary success notification after every successful mock product-management action.

**Architecture:** `ProductsView` owns the current feedback message and its three-second lifecycle because it coordinates all mutations. A focused `ProductActionFeedback` component only renders the floating notification and exposes manual dismissal.

**Tech Stack:** React 19, TypeScript strict mode, Tailwind CSS, existing shadcn button primitives, Lucide icons, Vitest and Testing Library.

## Global Constraints

- Do not add a notification dependency.
- Do not touch APIs, Supabase, SQL or other backend code.
- Only one message is visible; a new success replaces it and restarts the timer.
- Auto-dismiss after exactly 3000 milliseconds.
- Use `role="status"`, `aria-live="polite"` and an explicitly labelled close button.
- Use arrow functions for application components and helpers.

---

### Task 1: Product action feedback

**Files:**
- Create: `src/components/products/product-action-feedback.tsx`
- Test: `src/components/products/product-action-feedback.test.tsx`
- Modify: `src/components/products/products-view.tsx`
- Modify: `src/components/products/products-view.test.tsx`
- Modify: `context_snapshot.md`

**Interfaces:**
- Produce `ProductActionFeedback({ message, onClose }: { message: string; onClose: () => void })`.
- `ProductsView` stores `feedback: string | null` and replaces it after each successful create, edit, stock or status mutation.

- [x] **Step 1: Write failing component and integration tests**

Render `ProductActionFeedback` and assert its message, `status` role, polite live region and `Cerrar notificación` button. In `ProductsView`, create `Pomada mate` and assert `Producto añadido correctamente.`. Use fake timers to advance 3000 milliseconds and assert removal. Trigger edit, stock and status actions and assert their operation-specific messages replace the previous message.

- [x] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/components/products/product-action-feedback.test.tsx src/components/products/products-view.test.tsx
```

Expected: FAIL because the feedback component and success messages do not exist.

- [x] **Step 3: Implement the presentation component**

Create a fixed responsive notification with a green `CircleCheck`, white rounded container, shadow, message text and ghost close button. The root must contain:

```tsx
role="status"
aria-live="polite"
```

The close button must use `aria-label="Cerrar notificación"`.

- [x] **Step 4: Integrate feedback lifecycle**

Add `feedback` state in `ProductsView`. A `useEffect` must clear a non-null message after `3000` milliseconds and cancel the previous timer on replacement or unmount.

Set the exact message after each successful operation:

```ts
create: "Producto añadido correctamente."
edit: "Producto actualizado correctamente."
stock: "Stock actualizado correctamente."
activate: "Producto activado correctamente."
deactivate: "Producto desactivado correctamente."
```

Render `ProductActionFeedback` only while `feedback` is non-null and pass `onClose={() => setFeedback(null)}`.

- [x] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/components/products/product-action-feedback.test.tsx src/components/products/products-view.test.tsx
```

Expected: all tests PASS without warnings.

- [x] **Step 6: Update operational context**

Record the accessible action feedback in `context_snapshot.md`, keeping mock reset behavior and backend boundaries unchanged.

- [x] **Step 7: Run complete verification**

Run:

```bash
npm test
npm run lint
npm run build -- --webpack
git diff --check
```

Expected: every command exits with status 0. Webpack is the documented build fallback because Turbopack cannot bind its internal port in the sandbox.

- [ ] **Step 8: Commit implementation**

Stage only the feedback component, its tests, integrations and context update, then commit:

```bash
git commit -m "feat(products): add action feedback (#16)"
```
