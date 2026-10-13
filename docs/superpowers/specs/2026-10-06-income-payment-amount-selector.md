# Income payment amount selector

**Approved:** 2026-10-06

## Decision

The normal sale form uses integer ARS payment amounts for owners, admins and employees. Percentages are removed from this form.

When one method is selected, it receives the complete calculated sale total. With multiple methods, every row except the final one is editable and the final row receives the remaining amount automatically. The UI clamps editable amounts to the sale total and offers a `Mitad y mitad` action when exactly two methods are selected.

To calculate the exact total in the employee browser, the employee sale-entry catalog includes service and product unit prices. The employee may submit only positive integer amount allocations. Existing server authorization still determines the actor, selected catalog records, charged total, commission snapshots and final payment validity.

## Boundaries

- No SQL, table, RPC or migration changes are required. The canonical sale RPC already accepts amount allocations for employees.
- Employee income history and created-income responses remain sanitized and do not expose stored payment allocations, total, barbershop net or registrant identity.
- Product price overrides remain manager-only. The employee receives the catalog product price for total calculation but cannot submit a product override.
- Fixed-customer monthly collection keeps its existing role-specific payment contract and is outside this change.
