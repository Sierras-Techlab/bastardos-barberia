# Services View Design

**Issue:** #23  
**Branch:** `feat/23-services-view`  
**Status:** Approved for implementation

## Objective

Build an authenticated, responsive `/services` frontend prototype for the small and stable Bastardos Barberia service catalog. The screen must favor fast visual consultation over a dense table and must not change backend, API, Supabase or SQL code.

## Catalog model

Each mock service contains:

- `id`: stable string aligned with the income form identifiers.
- `name`: required and unique after normalized comparison.
- `price`: required positive integer in Argentine pesos.
- `isActive`: controls whether the service can be offered.

Duration is excluded because the business has not defined it. The initial fixture contains:

- Corte de pelo y perfilado de cejas — $16.000.
- Barba — $13.000.
- Corte de pelo, perfilado y barba — $19.000.

The fixture is validated at the server boundary before it reaches the client view. Local mutations reset on reload.

## Page and visual structure

`/services` lives inside the persistent authenticated dashboard shell and includes:

1. The existing sticky page header with a demonstration-data badge.
2. Three compact metric cards: active services, average price and price range.
3. A compact toolbar with text search, active-state filter, name/price sorting and clear action.
4. A visual service-card grid: one column on phones and up to three columns on notebook screens.
5. A useful empty state when filters produce no results.

Each service card shows name, formatted price and active state. Cards use the established rounded geometry, red/black/neutral palette, subtle elevation and hover transitions. The service catalog intentionally does not use a desktop table because the business expects a small number of services.

## Permissions and workflows

- Owner and admin see active and inactive services and may create, edit, activate, deactivate and delete them.
- Employee sees active services only and receives no management controls.
- Create and edit use an accessible modal with required name and price fields.
- Duplicate normalized names are rejected.
- Status changes require explicit confirmation.
- Deletion is a separate destructive action and requires explicit confirmation that identifies the service.
- In the mock prototype, deleting removes the service from in-memory state and a reload restores the fixture.
- Backend integration must implement deletion as a logical delete so historical sales keep their service reference.
- Every successful mutation shows the existing accessible temporary feedback pattern.

These permissions are presentation-only for the mock prototype. Persistent server authorization remains mandatory when backend integration is added.

## Isolation from incomes

The catalog fixture uses the same initial IDs, names and prices as the current income form, but this increment does not rewrite or synchronize income mocks. Runtime catalog edits therefore do not affect the income form. A shared persistent service source will replace both mock boundaries during backend integration.

## Testing

Tests cover:

- strict fixture validation;
- metrics, search, filters and sorting;
- visual card rendering and empty results;
- create/edit validation and duplicate-name rejection;
- activation/deactivation confirmation;
- deletion confirmation and removal from the in-memory catalog;
- owner/admin management versus employee read-only behavior;
- authenticated route composition, sidebar navigation and loading state.

Completion requires the focused tests, complete test suite, lint, production build and `git diff --check` to pass.
