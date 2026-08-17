# Income Form Design

**Date:** 2026-08-07
**Issue:** #9 — `feat(incomes): build income creation interface`
**Route:** `/incomes/new`
**Scope:** Frontend-only implementation backed by mock data

## 1. Objective

Build a fast, responsive interface for registering Bastardos income entries. An entry may contain one service, one or more products, or both. The first version uses mock data and a mock service so the UI can be completed without the backend and later connected without rewriting the presentation layer.

The primary device is the notebook used at the barbershop. The complete flow must also remain comfortable and usable from each employee's phone.

## 2. Scope

This issue implements only `/incomes/new`.

The following navigation work is deliberately separate:

- `/incomes`: future income history and table.
- Dashboard quick action: future link to `/incomes/new`.
- Sidebar entry: future link to `/incomes`.
- `/incomes/[id]`: possible future income detail page.

Backend integration, real persistence, authentication, stock mutations, commissions, cash closing, split payments, discounts, and editable sale prices are outside this issue.

## 3. Confirmed Business Rules

### Services

Only one service may be selected per income entry, and selecting a service is optional.

- Haircut and eyebrow shaping: ARS 16,000.
- Beard: ARS 13,000.
- Haircut, eyebrow shaping, and beard: ARS 19,000.

### Products

- Zero or more products may be added.
- A product has a positive integer quantity.
- Adding the same product again increments its quantity.
- Product prices come from the catalog and cannot be edited in this form.
- A historical entry must retain the price applied at the time of sale.

### Required composition

An entry must contain at least one service or one product. Empty entries are invalid.

### Employee

- The responsible employee defaults to the authenticated user.
- Employees cannot change the responsible employee.
- The owner may select another employee and register the entry on their behalf.
- The mock state must make both permission variants testable.
- The backend must eventually enforce this authorization rule; hiding the control in the frontend is not a security boundary.

### Customer

- Associating a customer is optional in this version.
- The default value is "No customer associated."
- A searchable selector allows an existing customer to be chosen.
- Creating a customer inside this flow is out of scope.
- Validation remains centralized so customer association can become mandatory later without restructuring the UI.

### Payment

- Exactly one payment method is required: cash or bank transfer.
- Split payment is a future backlog item.

### Prices and totals

- Monetary values are represented as integer Argentine pesos.
- The frontend calculates subtotals and the displayed total.
- The future backend must resolve current catalog prices and calculate the authoritative total. It must not trust a total supplied by the browser.

## 4. User Experience

### Desktop structure

The existing application sidebar remains visible and may collapse. The page uses a two-column workspace:

- Left, approximately two thirds: entry details, service, products, and payment.
- Right, approximately one third: a sticky sale summary and primary action.

The header includes a back action, the title "Cargar ingreso," and a short "Venta nueva" description. The content uses the warm dashboard background, white rounded cards, black structural surfaces, and Bastardos red for selected states and primary actions.

### Mobile structure

Sections stack in this order:

1. Compact header.
2. Entry details.
3. Service.
4. Products.
5. Payment method.
6. Summary.

A bottom action bar displays the total and a continue action without covering form content. Sidebar navigation opens as a sheet. Touch targets are at least 44 pixels high, and no required behavior depends on hover.

### Interaction styling

- White cards with large but compact rounded corners.
- Warm light-gray page background.
- Black for hierarchy and the summary surface.
- Bastardos red for selection, focus, and the main action.
- Soft elevation and short transitions.
- Clear focus-visible styles and keyboard operation.
- Hover enhancement on pointer devices only; all state remains visible without hover.

## 5. Form Sections

### Entry details

- Current date and time are visible and initially read-only.
- Responsible employee is derived from the mock authenticated user.
- The employee selector is rendered only when the mock user has owner permission.
- Customer uses an optional searchable selector.

### Service selector

The three services appear as selectable cards with name and formatted price.

- Selection is exclusive.
- The selected card has a strong visual state and accessible selected semantics.
- The user can clear a selected service.

### Product selector

- Search products by name.
- Add a product from a compact catalog.
- Display selected products as rows containing name, quantity controls, unit price, subtotal, and remove action.
- Increasing or decreasing quantity updates totals immediately.
- Decreasing from one removes the product only through an explicit remove action, avoiding accidental deletion.

### Payment selector

Two large exclusive controls represent cash and bank transfer. A payment method is required before review.

### Sticky summary

The summary displays:

- Employee.
- Customer when selected, otherwise "Sin cliente asociado."
- Selected service and price.
- Each selected product, quantity, and subtotal.
- Total.
- Payment method.

The primary action is "Revisar ingreso." It validates the draft and opens final confirmation; it does not immediately submit.

## 6. Validation

The draft is valid only when:

- A responsible employee exists.
- A service or at least one product is selected.
- Every product quantity is a positive integer.
- One payment method is selected.
- The calculated total is greater than zero.

Errors appear next to the relevant section. On mobile, an invalid submission scrolls or focuses the first invalid section. While submission is pending, the confirm action is disabled to prevent duplicate entries.

## 7. Confirmation and Result States

### Confirmation

"Revisar ingreso" opens a confirmation dialog containing employee, optional customer, itemized service and products, payment method, and total.

- Desktop: centered dialog.
- Mobile: near-full-screen dialog or bottom sheet behavior, depending on the selected shadcn/Base UI primitive.
- Actions: "Volver y editar" and "Confirmar ingreso."

### Pending

The confirm button shows a loading state and all submit paths are disabled while `create` is pending.

### Success

After successful mock creation, show a dedicated success state containing the registered amount and actions to:

- Reset the form and load another entry.
- Return to the dashboard.

A short success toast may reinforce the result, but the persistent success state is the primary feedback.

### Error

If mock creation fails:

- Preserve the entire draft.
- Exit the pending state.
- Present a clear error message.
- Allow retry without rebuilding the sale.

The mock should not add an artificial delay beyond what is useful for exercising pending behavior in tests and development.

## 8. Frontend Architecture

The UI depends on an income service boundary rather than importing JSON directly:

```text
/incomes/new
      -> IncomeForm
      -> IncomeService
      -> Mock implementation now / API implementation later
```

Suggested organization:

```text
src/
├── app/incomes/new/page.tsx
├── components/incomes/
│   ├── income-form.tsx
│   ├── service-selector.tsx
│   ├── product-selector.tsx
│   ├── selected-products.tsx
│   ├── payment-method-selector.tsx
│   ├── income-summary.tsx
│   ├── income-confirmation-dialog.tsx
│   └── income-success-state.tsx
├── data/income-form.mock.json
├── lib/services/mock-income-service.ts
├── lib/validations/income-schema.ts
└── types/income.ts
```

Small components may remain colocated when extracting them would add indirection without reuse or readability benefits.

### Form model

```ts
type IncomeFormValues = {
  employeeId: string;
  customerId: string | null;
  serviceId: string | null;
  products: Array<{
    productId: string;
    quantity: number;
  }>;
  paymentMethod: "cash" | "transfer";
};
```

The runtime schema is the source of validation truth, with the TypeScript form type inferred from it where practical.

### Service boundary

```ts
type IncomeService = {
  create: (input: CreateIncomeInput) => Promise<Income>;
};
```

The form receives or imports the mock implementation through a narrow boundary. A future API implementation must preserve this behavior-oriented contract while adapting request and response DTOs internally.

## 9. Libraries and Components

Use:

- React Hook Form for form state and dynamic product fields.
- Zod for runtime validation and inferred TypeScript types.
- `@hookform/resolvers` for integration.
- shadcn/ui with the installed Base UI preset for accessible controls.
- Tailwind CSS for layout, responsiveness, and Bastardos styling.
- Lucide React for icons.
- Native `Intl.NumberFormat` for ARS display.

Likely shadcn components include Field, Select or Combobox, Radio Group, Dialog, Button, Input, Card, Separator, and toast/Sonner. Only add components actually used by the approved implementation.

Do not introduce global state management, a currency library, a table library, a wizard library, or an animation library for this page.

## 10. Testing Strategy

Use Vitest, React Testing Library, User Event, and jsdom. Implement behavior test-first.

Required behavior coverage:

- Reject an empty entry.
- Select and clear a service.
- Add, increment, decrement, and remove products.
- Avoid duplicate product rows.
- Calculate service, product, and combined totals.
- Require a payment method.
- Default employee from the session mock.
- Restrict employee selection for non-owner users.
- Allow owner employee selection.
- Keep customer optional.
- Open confirmation with the exact draft summary.
- Prevent duplicate submission while pending.
- Preserve the draft after service failure.
- Reset after successful creation.

Responsive layout, focus behavior, accessible labels, and selected semantics should receive targeted component assertions plus manual browser verification at notebook and phone widths.

## 11. Acceptance Boundary

This design is complete when `/incomes/new` can exercise the full entry flow with mock data, including validation, confirmation, pending, success, error, desktop, and mobile states. It does not claim persistence or security until the backend integration is implemented.
