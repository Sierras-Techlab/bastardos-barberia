# Product Action Feedback Design

## Goal

Give managers immediate, unobtrusive confirmation after a successful mock product operation in `/products`.

## Scope

The catalog will show a single temporary success notification after:

- creating a product;
- editing a product;
- adjusting stock;
- activating a product; or
- deactivating a product.

This remains frontend-only. It does not call or modify any backend API and notification state resets on reload.

## Interaction and presentation

The notification appears after the dialog closes and the in-memory catalog has updated. It floats at the bottom-right on desktop and centered near the bottom on mobile, without blocking catalog interaction.

It uses the existing visual language: a white rounded container, subtle shadow, green success icon and concise dark text. Messages are:

- `Producto añadido correctamente.`
- `Producto actualizado correctamente.`
- `Stock actualizado correctamente.`
- `Producto activado correctamente.`
- `Producto desactivado correctamente.`

Only one notification is visible at a time. A new successful action replaces the previous message and restarts the three-second timeout. The notification disappears automatically after three seconds and also includes a close button for immediate dismissal.

## Accessibility

The notification container uses `role="status"` and `aria-live="polite"` so successful actions are announced without interrupting the user. The close button has an explicit accessible label. The visual treatment does not rely on color alone because it includes both an icon and text.

## Component boundary

A focused `ProductActionFeedback` presentation component receives the current message and an `onClose` callback. `ProductsView` owns the temporary message and timeout because it already coordinates every successful in-memory mutation.

The component does not know how products are stored and does not trigger mutations. Product dialogs continue to report success through their existing callbacks.

## Testing

Component tests verify the visible message, accessible status semantics and manual dismissal. Integration tests verify that creating a product displays the correct confirmation and that subsequent operations replace the message with the operation-specific text.
