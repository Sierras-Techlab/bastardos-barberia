# Payment method deletion design

Date: 2026-08-15
Status: approved for planning

## Goal

Let managers permanently remove payment methods that were created by mistake without allowing unused or inactive entries to fill the administration screen. Payment methods already referenced by sales must remain available to historical receipts and filters.

## Product rules

- The administration dialog shows active methods by default.
- A secondary `Ver desactivados` control reveals inactive methods and allows reactivation.
- Managers may rename, deactivate or request permanent deletion of a method.
- Permanent deletion succeeds only when no `income_payments` row references the method.
- A referenced method cannot be deleted. The UI explains that it can be deactivated to hide it without losing sale history.
- The last active payment method can be neither deactivated nor deleted.
- Deleted unused methods disappear from local state immediately after server confirmation.
- Historical payment snapshots and filters remain unchanged.

## API semantics

- `PATCH /api/payment-methods/:id` remains the update boundary and accepts name or active-state changes. Deactivation and reactivation use this endpoint.
- `DELETE /api/payment-methods/:id` becomes a real permanent deletion boundary instead of an alias for deactivation.
- Browser code never decides whether a method is in use. The database is authoritative.
- The existing manager authorization runs before path or body validation.

## Domain and persistence

The payment-method repository gains a `delete` operation backed by a new `delete_payment_method` RPC in migration `016`.

The RPC:

1. authorizes an active owner or admin;
2. locks the target method;
3. returns `PAYMENT_METHOD_NOT_FOUND` when absent;
4. rejects deletion of the last active method with `LAST_ACTIVE_PAYMENT_METHOD`;
5. rejects referenced methods with `PAYMENT_METHOD_IN_USE`;
6. physically deletes an unused method and returns its UUID.

The foreign key from `income_payments.payment_method_id` continues using restrictive deletion as defense in depth. No sale, payment allocation or snapshot is cascaded or rewritten.

## Interface behavior

Each active row keeps rename and deactivate actions and gains a destructive delete action. Delete opens a confirmation dialog naming the method and explaining that the action is permanent when the method has no sales.

The default list contains active methods only. `Ver desactivados` reveals inactive rows in the same dialog; those rows offer reactivation and deletion. Empty states distinguish between no active methods matching the current view and no deactivated methods.

On success, Sonner confirms deletion and the method is removed from the dialog and parent form state. On `PAYMENT_METHOD_IN_USE`, the confirmation closes and the dialog shows that the method must be deactivated instead. Other domain errors retain their existing public messages.

## Concurrency and integrity

Deletion and active-count checks execute inside one database transaction. Both active-state updates and deletion acquire the same transaction-scoped advisory lock before counting active methods or locking the target row. This closes the existing race in which two concurrent lifecycle operations could each observe another active option and remove the final two together. The restrictive foreign key remains the final protection against a sale being attached concurrently.

## Tests

- Schema and service tests cover update-based deactivation and real deletion.
- Route tests cover manager authorization, invalid IDs, successful deletion, not found and in-use conflicts.
- Repository tests cover the new RPC and stable error mappings.
- Migration tests cover grants, last-active protection, reference protection and physical deletion.
- Dialog tests cover active-only default rendering, toggling inactive methods, confirmation, successful removal, in-use guidance and reactivation.
- The complete suite, lint and production build must pass before integration.

## Out of scope

- Bulk deletion.
- Automatic purging by age.
- Deleting historical payment snapshots.
- Adding a separate archived/deleted database state.
