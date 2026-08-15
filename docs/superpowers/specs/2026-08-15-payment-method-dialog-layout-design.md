# Payment method administration dialog layout

**Date:** 2026-08-15  
**Status:** Approved design pending written-spec review

## Problem

The payment-method administration dialog uses horizontal flex rows whose action controls can consume the available width. At constrained widths or increased display scaling, the create input collapses into a narrow pill and method names collapse entirely, leaving only the status and long action labels visible. The dialog remains technically operable but is not understandable.

## Scope

Redesign only the internal layout of `PaymentMethodsDialog`. Preserve the existing payment-method API, state transitions, permissions, confirmation dialog, Sonner messages and active/inactive behavior.

## Approved layout

- The create form uses a stable vertical composition: a full-width named input followed by a full-width `Agregar medio` button.
- The active/inactive heading and its navigation control use separate lines so neither can compress the other.
- Each payment method is rendered as a compact rounded card rather than a shared table-like row.
- The card header always preserves the method name and presents its status as a visible badge.
- A separate action row contains an explicit `Editar` control, a `Desactivar` or `Reactivar` control, and a destructive icon button with an accessible `Eliminar {name}` label.
- Visible action text does not repeat the payment-method name. Accessible names retain the method name where needed to disambiguate controls.
- The same internal composition is used at phone and desktop widths. Width changes may adjust button sizing, but never reorder or hide the name, status or actions.

## Visual hierarchy

1. Dialog title and explanatory copy.
2. Create form.
3. Active/inactive section navigation.
4. Independent payment-method cards.
5. Close action.

The cards use the existing neutral surfaces, red destructive accent, rounded corners and typography. No new dependency or visual system is introduced.

## Error and lifecycle behavior

- Creation, rename, deactivation, reactivation and safe deletion retain their current request flows.
- Pending actions keep their current disabled behavior.
- API failures remain visible through the current inline error or deletion confirmation message.
- Referenced methods remain non-deletable and can be deactivated without losing historical sales.

## Verification

- Component tests must continue to cover create, rename, deactivate, reactivate, delete confirmation, in-use deletion conflicts and empty states.
- Add structural assertions that the create form and method actions use the non-collapsing card composition.
- Validate the authenticated dialog at desktop and 390×844 phone dimensions.
- At both sizes, method names and actions must remain visible, each dialog's `scrollWidth` must equal its `clientWidth`, the document must have no horizontal overflow and the browser console must report no errors.

## Out of scope

- Payment-method SQL or Route Handler changes.
- New lifecycle states or permissions.
- Changes to income entry, history filters or saved sales.
- Executing migration `016` against Supabase.
