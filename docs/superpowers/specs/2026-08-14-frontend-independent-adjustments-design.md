# Frontend-independent adjustments design

Date: 2026-08-14

## Objective

Improve access to commission and fixed-customer information using only data already exposed by the current backend. Preserve the existing responsive visual language and avoid changing Route Handler contracts, SQL functions, database tables or persisted behavior.

## Scope

### User administration

- The desktop user table shows `Comisión servicios` and `Comisión productos` as separate values for every user.
- The responsive/mobile user presentation exposes the same two percentages without requiring the edit dialog.
- Commission controls allow the operator to clear an existing `0`, type a new integer and submit it normally.
- A temporarily empty commission field is valid only while editing. Submission requires an integer from 0 through 100 and retains the current Spanish validation message.
- Submitted payloads remain numeric and keep the current API contract unchanged.

### Customer directory

- Customer filters add a fixed-schedule selector with three options: `Todos`, `Clientes fijos` and `Sin horario fijo`.
- `Clientes fijos` includes customers whose `fixedSchedule` is non-null.
- `Sin horario fijo` includes customers whose `fixedSchedule` is null.
- The new filter composes with the current text and sorting controls and participates in the existing clear-filters behavior.
- Filtering remains client-side because `fixedSchedule` is already present in the customer response.

### Dashboard role scoping

- No production behavior changes are planned: the dashboard already calls the role-scoped income service.
- Regression coverage must prove that an employee requests and derives only their own income data, while owner/admin retain the aggregate business view.
- Presentation may be adjusted only if a test reveals incorrect role-specific wording; the income authorization and API contracts remain unchanged.

## Architecture and data flow

- Existing user and customer components remain the owners of their local UI state.
- User commission fields keep raw string state at the input boundary and convert to numbers only during validation/submission.
- User list components render the existing `serviceCommissionRate` and `productCommissionRate` properties from `SafeUser`.
- Customer filtering extends the existing filter value and catalog filtering helpers rather than introducing a new API request.
- Dashboard tests exercise the current server-page composition and service scoping without duplicating authorization logic in the client.

## Error handling

- Empty, fractional, negative or greater-than-100 commission values block submission with an explicit validation message.
- Customer filtering has no network failure mode because it operates on the already loaded directory.
- Existing loading, empty and API-error states remain unchanged.

## Testing

- Add a failing user-dialog test that clears `0`, types a new product commission and verifies the numeric payload.
- Extend desktop/mobile user list tests to cover both commission percentages.
- Add customer catalog/filter tests for fixed, non-fixed and combined filtering behavior.
- Add dashboard page/service tests proving employee and manager income scoping.
- Run focused tests first, then the full test suite, ESLint, the Next.js webpack production build and `git diff --check`.

## Explicitly out of scope

- Financial amounts in customer visit history.
- Dynamic product categories.
- Dynamic payment-method catalogs or combined-payment filtering.
- A 100% product commission exception.
- Any SQL migration, Supabase mutation or API contract change.

