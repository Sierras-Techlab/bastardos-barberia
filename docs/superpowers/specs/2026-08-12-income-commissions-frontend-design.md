# Income Commissions Frontend Design

**Issue:** #27  
**Branch:** `feat/27-income-commissions`  
**Status:** Approved for implementation planning

## Objective

Prepare the complete frontend experience and versioned browser contract for responsible-employee attribution, split payments and accrued commissions. This increment intentionally does not modify Route Handlers, server services, repositories, SQL or the configured Supabase database. The new submission contract may remain incompatible with the current backend until the backend handoff is implemented.

## Scope and boundaries

This increment changes `/users`, `/incomes/new`, `/incomes` and income detail presentation. It adds frontend validation, role-aware controls, commission calculations for immediate feedback, V2 request/response schemas and focused tests.

The browser calculation is presentational only. The future backend remains authoritative for the registering user, eligible responsible employee, catalog prices, sale total, commission rates and amounts, timestamps and authorization of exceptional commission treatment.

Commission settlement is excluded. The frontend shows accrued commission only and does not mark it paid, create settlement periods, record advances or support partial payouts. Dashboard-level commission metrics are excluded; monthly commission metrics live in `/incomes`.

## User commission configuration

Manager create/edit user forms gain:

- `serviceCommissionRate`: integer percentage from 0 through 100.
- `productCommissionRate`: integer percentage from 0 through 100.

Both default to 0 and may be configured for owner, admin or employee accounts. The interface explains that changes apply to future sales and do not rewrite historical commission snapshots. Employees cannot access user administration or change commission configuration.

## Responsible employee attribution

The sale distinguishes:

- `registeredBy`: authenticated account that submitted the sale; never selected or supplied as browser authority.
- `employee`: active account responsible for the sale and its accrued commission.

Owner/admin may select any eligible active user and initially see themselves selected. An employee is fixed to their own active account and cannot choose or submit another employee. One sale has exactly one responsible employee even when it combines a service and products. Historical responses retain both identities if either account is later deactivated or logically deleted.

## Payment experience

The form offers `Efectivo`, `Transferencia` and `Combinado`. Combined is a presentation choice, not a persisted payment method.

For a combined payment:

- The UI renders separate cash and transfer amounts.
- Both amounts must be positive integers in Argentine pesos.
- Entering the first cash amount fills transfer with the remaining sale total.
- The user may adjust either amount afterward.
- The form displays the exact missing or excess amount.
- Submission is blocked until the payment sum equals the displayed sale total.

The V2 request always sends a `payments` array. Simple payments contain one entry equal to the total; combined payments contain cash and transfer entries. The future backend must calculate its own authoritative total and reject any payment sum that differs.

## Commission calculation and exceptional service benefit

Normal accrued commission is separated by component:

```text
service commission = authoritative service subtotal × service rate snapshot
product commission = authoritative product subtotal × product rate snapshot
commission total = service commission + product commission
barbershop net = active sale total - commission total
```

Percent calculations round to the nearest whole peso using the same server-defined rule that the backend handoff must implement. The frontend mirrors the rule for preview only.

When an owner/admin selects a different responsible user and the draft contains a service, the UI offers `Darle el 100% del servicio a {name}`. It is absent for employees, self-selection and product-only sales. When enabled, the service rate for that sale becomes 100%; products retain the responsible user's normal product rate. The request sends only `grantFullServiceCommission: true`; the browser does not send authoritative commission amounts or an authorizer ID.

## Income form and summary

The sale form displays:

- Responsible employee selection or locked self-attribution.
- Simple/combined payment allocation.
- Service commission, product commission, accrued total and estimated barbershop net.
- Clear exceptional-service treatment when enabled.
- Final confirmation containing the responsible employee and complete payment/commission breakdown.

The frontend must preserve the current customer, service, product, stock and idempotent request-ID interactions. Backend incompatibility is surfaced as an error; the UI must not falsely report persistence.

## Income history and detail

Monthly `/incomes` metrics become:

- Active gross income.
- Active accrued commissions.
- Estimated active net for the barbershop.

Voided sales retain stored identities, payments and commission snapshots but contribute zero to active metrics. Desktop/mobile income representations show responsible employee and commission total. Income detail shows registering user, responsible employee, payment rows, service/product bases, rate snapshots, commission amounts, exceptional service benefit and barbershop net.

## Frontend V2 contracts

The expected create request is:

```ts
type CreateIncomeV2Input = {
  requestId: string;
  employeeId: string;
  customerId?: string;
  serviceId?: string;
  products: Array<{ productId: string; quantity: number }>;
  payments: Array<{
    method: "cash" | "transfer";
    amount: number;
  }>;
  grantFullServiceCommission: boolean;
};
```

The browser does not submit `registeredBy`, catalog prices, sale total, commission rates/amounts, authorizer or timestamps.

Income responses must include:

- `registeredBy` and `employee` safe identity snapshots.
- `payments` with method and amount.
- `commission` with service/product bases, rate snapshots, component amounts, total, barbershop net, exceptional-service flag and optional authorizer identity.

User administration responses and create/update inputs include the two commission-rate fields.

## Backend handoff document

The implementation adds a standalone backend handoff message under `docs/backend-handoffs`. It must be copy/paste ready for the backend developer and their Codex session and include:

- Required additive migration and historical backfill.
- Recommended normalized `income_payments` model.
- Separation of registering and responsible users.
- Historical commission snapshots.
- Manager versus employee authorization rules.
- Atomic server calculation and validation.
- Idempotency, inventory, customer-visit and void behavior.
- Expected V2 request/response contracts and public errors.
- Required repository, service, Route Handler, SQL and integration tests.
- Warning that checking out `dev` does not revert an applied Supabase migration.

## Testing and completion

Tests cover commission rate validation, role-aware employee selection, combined-payment allocation, exact sum enforcement, normal and 100%-service previews, V2 payload omission of authoritative fields, response rendering, active versus voided metrics and preservation of existing income-form workflows.

Completion requires focused tests, the full test suite, lint, production build and `git diff --check`. No SQL is executed and no backend file is modified in this frontend increment.
