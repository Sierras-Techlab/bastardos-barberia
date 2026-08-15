# Payment method sidebar removal

**Date:** 2026-08-15  
**Status:** Approved

## Decision

Payment-method administration is contextual to income management and does not require a standalone navigation destination. Remove the `Medios de pago` item from the manager administration group in `AppSidebar`.

## Preserved access and behavior

- Owner and admin retain `Administrar medios de pago` inside `/incomes`.
- Employees remain unable to administer payment methods.
- Payment-method APIs, SQL, income creation, history filters and saved sale labels remain unchanged.
- No route is removed because the sidebar item is currently a non-navigating placeholder.

## Verification

- A manager sidebar test proves `Medios de pago` is absent while `Ingresos` remains linked.
- Existing sidebar authorization/navigation tests remain green.
- The focused sidebar test, TypeScript, lint and the full verification suite pass.

## Out of scope

- Migration `016` installation, which remains a manual database task.
- Changes to the `/incomes` administration modal.
