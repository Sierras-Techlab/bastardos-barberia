# Income Commissions Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the role-aware frontend, V2 browser contracts and backend handoff for responsible-employee attribution, split payments and accrued commissions without changing backend or SQL behavior.

**Architecture:** Keep V2 browser-only contracts isolated from current server contracts so the branch documents the future boundary without rewriting repositories, Route Handlers or SQL. Pure helpers calculate previews and payment allocation; the form composes focused employee, payment and commission components; history presentation accepts explicit frontend V2 view models in tests while retaining a clear unavailable state for legacy responses.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, React Hook Form, Zod 4, Tailwind CSS, existing shadcn/base-ui primitives, Sonner, Vitest and Testing Library.

## Global Constraints

- Do not modify `src/app/api`, server services/repositories, `supabase/queries` or the configured Supabase database.
- Do not execute SQL or store the test credentials supplied in chat.
- Frontend calculations are previews; the handoff requires the backend to calculate and authorize all persisted totals and commissions.
- Commission rates and monetary amounts are integers; rates are within 0 through 100 and money uses whole Argentine pesos.
- One sale has exactly one responsible employee.
- Employees are fixed to themselves; owner/admin may choose any active eligible user.
- The 100% exception applies only to the service, never automatically to products.
- Voided sales retain snapshots but contribute zero to active metrics.
- Use arrow functions for application components and helpers.

---

### Task 1: Browser-only V2 contracts and pure calculations

**Files:**
- Create: `src/types/income-commissions.ts`
- Create: `src/lib/incomes/income-commissions.ts`
- Create: `src/lib/incomes/income-commissions.test.ts`
- Create: `src/lib/incomes/frontend-contracts.ts`
- Create: `src/lib/incomes/frontend-contracts.test.ts`

**Interfaces:**
- `CommissionUser` contains safe identity, role, active state, `serviceCommissionRate` and `productCommissionRate`.
- `IncomePayment` contains `method: "cash" | "transfer"` and positive integer `amount`.
- `IncomeCommissionSnapshot` contains service/product bases, rate snapshots, component amounts, total, barbershop net, `fullServiceCommission` and optional authorizer.
- `CreateIncomeV2Input` contains `requestId`, `employeeId`, optional customer/service IDs, product quantities, `payments` and `grantFullServiceCommission` only.
- `calculateCommissionPreview(input)` rounds each component with `Math.round(base * rate / 100)` and returns component amounts, total and net.
- `calculatePaymentBalance(total, payments)` returns allocated, remaining and excess amounts.
- `createIncomeV2InputSchema` and response view-model schemas reject authoritative browser fields and malformed rates/payments.

- [ ] Write failing pure tests for 45% service, 10% products, zero defaults, 100%-service override, product-only behavior, whole-peso rounding, active/voided contribution, exact/short/excess payment allocation and payload omission of registrator/totals/commission amounts.
- [ ] Run `npm test -- src/lib/incomes/income-commissions.test.ts src/lib/incomes/frontend-contracts.test.ts` and verify RED because the frontend domain does not exist.
- [ ] Implement the browser-only types, helpers and strict Zod boundary without importing server repositories or schemas.
- [ ] Run the focused tests and verify GREEN.

### Task 2: Commission fields in user administration UI

**Files:**
- Create: `src/types/user-commissions.ts`
- Create: `src/lib/users/frontend-user-contracts.ts`
- Create: `src/lib/users/frontend-user-contracts.test.ts`
- Modify: `src/components/users/user-editor-dialog.tsx`
- Modify: `src/components/users/user-editor-dialog.test.tsx`
- Modify: `src/components/users/users-view.tsx`
- Modify: `src/components/users/users-view.test.tsx`
- Modify: `src/lib/users/client.ts`
- Modify: `src/lib/users/client.test.ts`

**Interfaces:**
- `FrontendCreateUserInput` extends the current browser create input with required `serviceCommissionRate` and `productCommissionRate`.
- `FrontendUpdateUserInput` permits either rate alongside current editable profile fields.
- `CommissionSafeUser` extends safe response presentation with the two rates, defaulting missing legacy fields to 0 only at the frontend adapter boundary.
- `normalizeCommissionUser(user)` supplies legacy-safe zero defaults until backend handoff is implemented.

- [ ] Write failing tests for zero defaults, integer 0–100 validation, create payload inclusion, editing either rate, explanatory future-sales copy and no false change submission.
- [ ] Run the user contract, dialog, client and view tests and verify RED.
- [ ] Implement frontend-only commission input schemas/adapters, add two percentage controls to create/edit dialogs and send both fields through browser API calls.
- [ ] Keep API/server validation errors contextual and preserve all existing user lifecycle behavior.
- [ ] Run the focused tests and verify GREEN.

### Task 3: Responsible employee selection

**Files:**
- Create: `src/components/incomes/employee-selector.tsx`
- Create: `src/components/incomes/employee-selector.test.tsx`
- Modify: `src/types/income.ts`
- Modify: `src/app/(dashboard)/incomes/new/page.tsx`
- Modify: `src/app/(dashboard)/incomes/new/page.test.tsx`
- Modify: `src/components/incomes/income-form.tsx`
- Modify: `src/components/incomes/income-form.test.tsx`
- Modify: `src/lib/incomes/income-schema.ts`
- Modify: `src/lib/incomes/income-schema.test.ts`

**Interfaces:**
- `IncomeFormData.employees` is a required `CommissionUser[]` presentation collection.
- `IncomeFormValues.employeeId` is a required UUID initialized to the current user.
- `EmployeeSelector({ currentUser, employees, value, onChange })` renders a select for owner/admin and a locked identity surface for employee.
- The server page may compose active users from existing read capabilities but must not change repository behavior; missing legacy rates normalize to zero.

- [ ] Write failing tests proving managers default to self and can select another active user, employees remain fixed to self, inactive users are excluded, reset restores self and the selected user flows into the review draft.
- [ ] Run the focused page, selector, schema and form tests and verify RED.
- [ ] Implement the selector and form field, supply eligible active presentation users to the page using existing read paths, and reset the special commission flag whenever its eligibility disappears.
- [ ] Run the focused tests and verify GREEN.

### Task 4: Split-payment allocation UI

**Files:**
- Modify: `src/components/incomes/payment-method-selector.tsx`
- Modify: `src/components/incomes/payment-method-selector.test.tsx`
- Modify: `src/components/incomes/income-form.tsx`
- Modify: `src/components/incomes/income-form.test.tsx`
- Modify: `src/lib/incomes/income-schema.ts`
- Modify: `src/lib/incomes/income-schema.test.ts`

**Interfaces:**
- Presentation mode is `"cash" | "transfer" | "combined"`; persisted V2 payments remain only `cash` and `transfer` rows.
- `PaymentMethodSelector` receives total and payment rows and emits a complete payment allocation.
- Entering initial cash in combined mode auto-fills transfer with `max(total - cash, 0)`; subsequent direct edits retain both values and expose balance feedback.

- [ ] Write failing tests for simple one-row payments, combined-mode reveal, automatic remainder, manual adjustment, positive integer validation, exact balance, missing/excess copy and blocked review while unbalanced.
- [ ] Run the selector, schema and form tests and verify RED.
- [ ] Implement the three-option selector, responsive amount inputs, accessible balance feedback and V2 payment rows in form state.
- [ ] Run the focused tests and verify GREEN.

### Task 5: Commission preview and 100%-service interaction

**Files:**
- Create: `src/components/incomes/commission-preview.tsx`
- Create: `src/components/incomes/commission-preview.test.tsx`
- Modify: `src/components/incomes/income-summary.tsx`
- Modify: `src/components/incomes/income-summary.test.tsx`
- Modify: `src/components/incomes/income-confirmation-dialog.tsx`
- Modify: `src/components/incomes/income-confirmation-dialog.test.tsx`
- Modify: `src/components/incomes/income-form.tsx`
- Modify: `src/components/incomes/income-form.test.tsx`

**Interfaces:**
- `CommissionPreview` consumes selected employee, service/product bases and override eligibility and renders service, products, accrued total and barbershop net.
- `grantFullServiceCommission` is visible only to owner/admin selecting another user with a service in the draft.
- Confirmation renders responsible employee, payment rows and presentational commission breakdown before dispatch.

- [ ] Write failing tests for normal separate rates, zero commission, product-only commission, eligible 100%-service copy containing the employee name, hidden override branches, product-rate preservation and confirmation breakdown.
- [ ] Run the focused preview, summary, confirmation and form tests and verify RED.
- [ ] Implement the compact commission preview, exceptional checkbox, eligibility reset and shared summary formatting.
- [ ] Run the focused tests and verify GREEN.

### Task 6: Submit V2 browser payload

**Files:**
- Modify: `src/lib/incomes/client.ts`
- Modify: `src/lib/incomes/client.test.ts`
- Modify: `src/components/incomes/income-form.tsx`
- Modify: `src/components/incomes/income-form.test.tsx`

**Interfaces:**
- `IncomeClient.createV2(input: CreateIncomeV2Input)` posts to `/api/incomes` and validates the future V2 response contract.
- The form sends `employeeId`, product quantities, payment rows and the exceptional flag, while omitting registrator, authoritative total, dates, rate snapshots and commission amounts.
- Backend incompatibility appears through the existing contextual submission error and never advances to success state.

- [ ] Write failing tests that inspect the exact JSON request, reject accidental authoritative fields, preserve the stable request ID across retries and show current-backend incompatibility without false success.
- [ ] Run the client and form tests and verify RED.
- [ ] Implement the V2 client boundary and switch the form submission to it without modifying any Route Handler.
- [ ] Run the focused tests and verify GREEN.

### Task 7: Income history metrics, rows and detail V2 presentation

**Files:**
- Modify: `src/components/incomes/income-metrics.tsx`
- Modify: `src/components/incomes/income-metrics.test.tsx`
- Modify: `src/components/incomes/income-table.tsx`
- Modify: `src/components/incomes/income-table.test.tsx`
- Modify: `src/components/incomes/income-mobile-list.tsx`
- Modify: `src/components/incomes/income-mobile-list.test.tsx`
- Modify: `src/components/incomes/income-detail-sheet.tsx`
- Modify: `src/components/incomes/income-detail-sheet.test.tsx`
- Modify: `src/components/incomes/incomes-view.tsx`
- Modify: `src/components/incomes/incomes-view.test.tsx`

**Interfaces:**
- V2 metrics expose `grossTotal`, `commissionTotal` and `barbershopNet` for active filtered sales.
- Legacy responses without commission fields render an explicit `Pendiente de backend` state instead of fabricating zero commission.
- Rows distinguish responsible employee from registering user and label split payments as `Combinado`.
- Detail renders every payment and commission snapshot and visually excludes voided economics.

- [ ] Write failing tests for the three monthly metrics, legacy unavailable state, responsible/registrator identities, simple/split payments, normal/special commission detail and voided exclusion.
- [ ] Run all focused income-history component tests and verify RED.
- [ ] Implement the V2 presentation with responsive density matching the current history view and explicit legacy fallbacks.
- [ ] Run the focused tests and verify GREEN.

### Task 8: Backend handoff and durable documentation

**Files:**
- Create: `docs/backend-handoffs/2026-08-12-income-commissions-and-split-payments.md`
- Modify: `context_snapshot.md`
- Modify: `product.md`
- Modify: `docs/superpowers/plans/2026-08-12-income-commissions-frontend.md`

**Interfaces:**
- The handoff is a self-contained Spanish message ready to send to the backend developer and their Codex session.

- [ ] Write the backend handoff with the additive `010` migration recommendation, `income_payments`, registering/responsible identities, user rates, historical snapshots, backfill, authorization, atomic calculations, void semantics, V2 JSON examples, public error codes and required backend tests.
- [ ] State explicitly that this frontend branch executes no SQL and that switching Git branches does not revert an applied Supabase migration.
- [ ] Update product/context state to mark frontend V2 prepared and backend integration pending.
- [ ] Mark every completed plan checkbox and scan all documents for placeholders or contradictory legacy claims.

### Task 9: Complete verification

**Files:**
- Review all files changed by Tasks 1 through 8.

- [ ] Run all new and modified focused tests and require zero failures.
- [ ] Run `npm test` and require zero failures.
- [ ] Run `npm run lint` and require zero errors or warnings.
- [ ] Run `npm run build -- --webpack` and require a successful production build.
- [ ] Run `git diff --check` and require no whitespace errors.
- [ ] Run `git diff --name-only origin/dev...HEAD` plus `git status --short` and confirm no `src/app/api`, server repository/service or `supabase/queries` file changed.
- [ ] Review the final implementation line by line against `docs/superpowers/specs/2026-08-12-income-commissions-frontend-design.md`.
