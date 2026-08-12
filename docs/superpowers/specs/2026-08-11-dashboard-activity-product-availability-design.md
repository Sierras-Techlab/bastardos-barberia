# Dashboard activity and inactive-product availability design

Date: 2026-08-11
Status: Approved

## Scope

This increment replaces the misleading customer and income demonstration entries in the dashboard's recent-activity card with persisted data. It also makes an inactive product display `No disponible` regardless of its remaining stock. Expense activity, daily metrics, charts, services and payment summaries remain demonstration data until their corresponding modules are implemented.

## Dashboard data flow

The authenticated dashboard Server Component will retain `requirePageUser()` as its authorization boundary and use the returned user for downstream queries.

Two independent reads will start in parallel:

- The existing role-scoped income service will request the first page with one item. Owner and admin receive the latest sale across all users; an employee receives only their latest sale.
- A focused customer repository read will select the latest non-deleted customer by `created_at desc`, limited to one row. The customer service will expose this read to authenticated server code.

The database timestamps are the source of truth. A small deterministic presentation helper will produce Spanish relative times such as `Ahora`, `Hace 12 min`, `Hace 1 h` or an absolute short date for older records. Tests will inject the current time instead of relying on the machine clock.

The activity card keeps its existing layout and fixed event categories:

- `Ingreso registrado` describes the latest persisted sale using its real service/products and authoritative total.
- `Nuevo cliente` names the latest persisted, non-deleted customer.
- `Gasto registrado` stays unchanged as demonstration content.

If no income or customer exists, its slot shows an honest empty message rather than falling back to a fabricated person or sale. The card does not attempt a cross-category chronological timeline while expenses remain mocked.

## Product availability presentation

Stock condition and commercial availability remain separate concepts. Stock filters and metrics continue to derive only from the exact unit count. For visible manager catalog rows and mobile cards, presentation follows this precedence:

1. If `isActive` is false, show `No disponible` with a neutral/inactive visual treatment.
2. Otherwise show `Disponible`, `Stock bajo` or `Sin stock` from the current quantity.

The existing `Inactivo` identity badge remains visible, the exact stock quantity remains visible for inventory work, managers continue to see inactive products, and employees continue to receive only active products from the server boundary.

## Errors and security

All reads stay server-only and reuse the Supabase secret client through repositories. Income visibility continues to be enforced by the service scope; the browser cannot request another employee's activity. Database errors keep the existing generic public behavior and detailed values are not logged.

No database schema or SQL script changes are required.

## Testing

Tests will be written before implementation and will cover:

- the latest-customer query excludes deleted rows, orders newest first and requests one row;
- the dashboard renders the latest persisted income and customer instead of the fixture values;
- employee income activity uses the existing employee-only scope;
- missing income/customer records produce honest empty activity text;
- desktop and mobile product representations show `No disponible` for an inactive product that still has stock;
- active products retain their quantity-derived availability labels and stock filtering behavior.

Focused tests will be followed by the complete test suite, ESLint, the Next.js production build and `git diff --check`.
