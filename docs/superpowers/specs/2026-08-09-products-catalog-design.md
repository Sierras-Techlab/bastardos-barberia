# Products Catalog Design

**Date:** 2026-08-09
**Issue:** #16 — products view
**Route:** `/products`
**Scope:** Frontend-only catalog backed by demonstration data

## Objective

Give the barbershop owner and employees a fast way to consult the current product catalog and selling prices from the shop notebook or a phone. This increment is intentionally read-only: inventory quantities, purchasing, product creation, editing, deletion and backend persistence remain outside issue #16.

## Experience

The page keeps the authenticated dashboard shell and Bastardos visual language while avoiding a copy of the income history layout. A compact heading introduces the catalog and labels its values as demonstration data. Three small metrics summarize total products, represented categories and average selling price.

A search field and category/status filters refine the catalog immediately in the browser. Desktop presents a dense table optimized for comparing names and prices. Mobile presents touch-friendly product cards. Both representations expose the same fields: product name, category, selling price and availability. Availability is categorical (`Disponible` or `No disponible`); numeric stock is not shown because inventory management is deferred.

Empty filtered results explain what happened and offer a control to clear the filters. Hover and focus treatments provide feedback without implying unsupported edit actions.

## Data and boundaries

Product demonstration data lives in a products-specific JSON fixture rather than importing data through the income form. The fixture may reuse the product names and prices already used by income mocks, adding presentation-only category and availability fields. A typed product module validates and derives filters and metrics from this fixture so the eventual backend response can replace the source without rewriting the view.

No component imports a Supabase client, calls an API, mutates product data or exposes an add/edit/delete control. The `/products` server page calls `requirePageUser()` so revoking a session still blocks the route at its page boundary.

## Components

- `ProductsPage`: metadata, live session authorization, page heading and demonstration badge.
- `ProductsView`: owns search/filter state and selects table, mobile cards or empty state.
- `ProductMetrics`: compact catalog overview cards.
- `ProductFilters`: accessible search, category and availability controls.
- `ProductTable`: desktop comparison view.
- `ProductMobileList`: mobile catalog cards.
- `products` domain helpers: types, runtime fixture validation, filtering and metric calculation.

The existing sidebar receives `/products` as the href for Productos, allowing its pathname-based logic to mark the item active.

## Responsive and visual rules

- Preserve the current red, black, warm-neutral and white palette.
- Keep controls reachable and at least comfortably touch-sized on phones.
- Avoid horizontal page scrolling.
- Use compact rounded cards rather than tall dashboard tiles.
- Prefer price hierarchy and fast scanning over decorative imagery.
- Keep the persistent sidebar and sticky page header behavior used by the current dashboard shell.

## Testing

Tests are written before implementation and cover:

- Product fixture validation and derived metric/filter behavior.
- Search, category and availability filtering, including the clear-filters empty state.
- Desktop and mobile product representation.
- Sidebar linking and active state for `/products`.
- Page metadata, authenticated composition and rejection after session revocation.

The complete test suite, lint and production build must pass before the feature is considered ready.

## Deferred work

- Product creation, editing and deletion.
- Purchase cost and profit margin.
- Numeric stock, stock movements and low-stock alerts.
- Product images.
- Backend endpoints and database persistence.
