# Dashboard Toasts Design

**Status:** Approved for implementation

## Objective

Unify dashboard action feedback with one Sonner-based notification system so Products, Customers, Services and Users present the same accessible visual and behavioral pattern.

## Scope

- Install `sonner` and render one globally configured toaster inside the authenticated dashboard layout.
- Use the existing Bastardos visual language: white rounded surface, restrained shadow, neutral text and semantic success/error/warning/info accents.
- Position notifications at the bottom-right on desktop and keep them safely inset on mobile.
- Show a close control and dismiss success notifications automatically after three seconds.
- Replace the product-specific feedback component and the inline Users success notice with Sonner calls.
- Migrate successful create, edit, stock, status and deletion actions in Products, Customers, Services and Users.

## Boundaries

- Field validation remains next to its form fields or inside its dialog.
- Errors that block a whole view remain inside that view with their retry action.
- Confirmation dialogs remain dialogs and are not replaced by notifications.
- Backend, API, Supabase and SQL behavior does not change.

## Architecture

`DashboardToaster` owns Sonner presentation defaults and is mounted once in the persistent authenticated layout. Feature components call Sonner's imperative `toast.success` API after confirmed successful mutations. This removes repeated feedback state, timers and feature-specific notification markup.

## Testing

- Test the shared toaster configuration and accessible close behavior.
- Update feature tests to assert Sonner notifications after successful actions.
- Verify no feature-specific success banner or feedback component remains.
- Run the complete test suite, lint, production build and `git diff --check`.
