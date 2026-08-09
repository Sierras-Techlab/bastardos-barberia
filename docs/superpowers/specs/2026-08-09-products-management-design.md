# Mock Product Management Design

**Date:** 2026-08-09
**Issue:** #16 — products view
**Route:** `/products`
**Scope:** Role-aware frontend management backed by in-memory demonstration data

## Objective

Extend the product catalog prototype so owners and administrators can exercise the complete product-management workflow before backend endpoints exist. Employees retain the same authenticated catalog as a strictly read-only view. All mutations live in React state and reset to the validated fixture after a page reload.

## Authorization boundary

`ProductsPage` obtains the live user from `requirePageUser()` and derives a `canManage` boolean from the fixed `owner` and `admin` roles. The page passes only that capability to the client view. Management controls are absent for employees rather than merely disabled.

This is a frontend prototype, not a security boundary. When persistence is added, every product mutation endpoint and service must independently authorize owner/admin access. The current implementation must not add a product API, database table, Supabase call or browser-side secret.

## Supported management actions

### Create

Managers can create a product with name, category, selling price and initial stock. Name is required after trimming, price and stock are non-negative integers, and duplicate names are rejected case-insensitively. A newly created product is active and receives a collision-safe client-only mock identifier.

### Edit

Managers can edit name, category and selling price. Stock is intentionally excluded from general editing so quantity changes follow the explicit stock-adjustment workflow. Duplicate-name validation ignores the product currently being edited.

### Adjust stock

A dedicated dialog supports `Entrada` and `Salida` movements. The manager enters a positive integer and sees current stock plus the resulting stock before confirmation. An exit cannot exceed the available quantity. Confirming updates the exact units and therefore recalculates `Disponible`, `Stock bajo` or `Sin stock` immediately.

### Activate or deactivate

A confirmation dialog toggles the product's active state. Deactivation never deletes the item. Inactive products remain visible to managers with an `Inactivo` badge so they can be restored; employees do not see inactive products. Future income integration must exclude inactive products from selection.

## Interaction design

The page header gains a `Nuevo producto` button only for managers. Desktop table rows gain an actions menu with `Editar`, `Ajustar stock` and `Desactivar` or `Activar`. Mobile cards expose the same menu with touch-friendly targets.

Creation and editing share a focused shadcn/ui dialog powered by React Hook Form and Zod. Stock adjustment and activation changes use separate dialogs so each interaction has one purpose and a clear confirmation step. Successful operations close their dialog and update the catalog immediately; no network loading state is simulated.

The view continues to support search, category and stock-state filtering. Managers additionally receive an active-state filter; employees never receive inactive data and therefore do not need that control.

## Sorting

The desktop `Stock` and `Precio` column headers are buttons:

- First activation sorts ascending.
- Second activation sorts descending.
- Third activation restores fixture/insertion order.
- The active direction is communicated visually and through accessible text.

Mobile uses an `Ordenar por` selector with original order, lowest/highest stock and lowest/highest price. Search and filters run before sorting. When a manager edits price or adjusts stock, an active sort recalculates immediately.

## State and data model

`ProductsView` initializes local products from the validated fixture. It owns product mutations, filters, sorting and active dialogs. Product records gain an `isActive` boolean; fixture records start active except for at least one inactive demonstration item so manager filtering and employee visibility are testable.

Pure product-domain functions validate form input, normalize duplicate-name comparisons, filter and sort without mutating their input. UI components receive explicit callbacks and capabilities rather than importing session or backend modules.

## Components

- `ProductsView`: in-memory product source of truth and orchestration.
- `ProductEditorDialog`: create/edit form.
- `ProductStockDialog`: validated entry/exit adjustment.
- `ProductStatusDialog`: activate/deactivate confirmation.
- `ProductActions`: shared manager action menu for desktop and mobile.
- `ProductFilters`: search, category, stock state, optional active state and mobile sort.
- `ProductTable`: sortable stock/price headers and manager actions.
- `ProductMobileList`: ordered cards with manager actions.

## Error and validation behavior

- Required name: `Ingresá el nombre del producto.`
- Duplicate name: `Ya existe un producto con ese nombre.`
- Invalid price: `Ingresá un precio válido.`
- Invalid initial stock: `Ingresá un stock válido.`
- Invalid adjustment: `Ingresá una cantidad mayor a cero.`
- Excessive exit: `No podés descontar más unidades que el stock disponible.`

Validation errors remain next to their fields. Closing a dialog without confirmation discards its draft and does not change the catalog.

## Testing

Tests are written before implementation and cover:

- Owner/admin controls present and employee controls absent.
- Employee exclusion of inactive products.
- Creation, duplicate rejection and reload-by-remount reset behavior.
- Editing name/category/price without implicitly changing stock.
- Valid entries/exits and rejected excessive stock exits.
- Deactivation, manager visibility, employee exclusion and reactivation.
- Desktop three-state stock/price sorting and mobile sort choices.
- Re-sorting after a price or stock mutation.
- Existing catalog search, filters, metrics and responsive representations.

The focused tests, complete suite, lint, production build and whitespace check must pass before delivery.

## Deferred work

- Persistent product tables, repositories, APIs and manager authorization at server boundaries.
- Durable stock-movement history and audit identity.
- Purchase cost, suppliers, margins and automated replenishment alerts.
- Product images and physical deletion.
