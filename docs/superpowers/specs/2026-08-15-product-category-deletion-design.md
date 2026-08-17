# Product category safe deletion

**Date:** 2026-08-15  
**Status:** Approved

## Goal

Let managers permanently remove product categories created by mistake without allowing historical or current product references to become invalid.

## Lifecycle rules

- A category with no product rows referencing it may be physically deleted.
- A category referenced by any product, active or inactive, cannot be physically deleted.
- A referenced category remains eligible for logical deactivation only after it has no active products, preserving the existing rule.
- Active and inactive categories remain recoverable through their existing update lifecycle.
- Deletion requires explicit confirmation naming the category.
- Manager authorization remains mandatory at the Route Handler, service and PostgreSQL function boundaries.

## API and database contract

- `PATCH /api/product-categories/:id` handles rename, deactivation and reactivation. A false `isActive` value delegates to the canonical `deactivate_product_category` RPC so active-product checks cannot be bypassed.
- `DELETE /api/product-categories/:id` means physical deletion and returns `{ id }`.
- A new incremental migration `017_product_category_deletion.sql` runs after migration `016`.
- Migration `017` removes the unconditional delete-prevention trigger and installs the security-definer `delete_product_category(actor_user_id, target_category_id)` RPC.
- The delete RPC locks the target category, returns `null` when absent, rejects any product reference with `PRODUCT_CATEGORY_HAS_PRODUCTS`, deletes only an unreferenced row and returns its UUID.
- The existing `products.category_id` foreign key remains `ON DELETE RESTRICT` as a final integrity guard.
- No migration rewrites products, categories or historical data.

## Application error behavior

- `PRODUCT_CATEGORY_HAS_PRODUCTS` maps to HTTP 409 with: `Esta categoría tiene productos asociados. Desactivala para conservar el catálogo y el historial.`
- A defensive PostgreSQL foreign-key error maps to the same public conflict.
- Unknown category IDs preserve the existing safe 404.
- Deactivation with active products preserves `PRODUCT_CATEGORY_IN_USE` and its current guidance.

## Manager interface

- The administration modal shows active categories by default.
- `Ver desactivadas (N)` opens a separate inactive view; `Volver a activas` returns to the default.
- Creation uses a full-width vertical form.
- Each category uses the same non-collapsing card language as payment methods: persistent name, green/orange state badge, explicit edit and lifecycle controls, and a destructive delete icon.
- Deletion opens a category-specific confirmation dialog.
- Successful deletion removes the category from modal and parent product state and emits a Sonner success.
- A referenced-category conflict leaves the category and draft state intact and shows the backend guidance.
- Both active and inactive empty states remain readable.

## Concurrency and integrity

PostgreSQL row locks and the existing foreign key serialize deletion against product creation or reassignment. A product transaction that wins first makes deletion conflict; a deletion that wins first makes later product selection fail as category-not-found. There is no window in which an orphaned product can be committed.

## Deployment

After pulling the application changes, execute in Supabase SQL Editor:

1. `016_payment_methods.sql`
2. `017_product_category_deletion.sql`

Migration `014` must not be rerun on an existing project.

## Verification

- Structural migration tests verify trigger removal, RPC authorization, reference guard, grants and schema reload.
- Domain/API/client tests cover PATCH deactivation and DELETE physical removal.
- UI tests cover separated active/inactive views, explicit confirmation, success synchronization and reference conflicts.
- Full tests, lint, TypeScript, production build and diff checks pass.
- Manual database acceptance validates one unused deletion and one referenced conflict after migration installation.
