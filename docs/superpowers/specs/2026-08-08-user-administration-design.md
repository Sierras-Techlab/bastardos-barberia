# User Administration Design

**Date:** 2026-08-08
**Status:** Approved

## Objective

Build a complete manager-only user administration module at `/users`. Owners and administrators must be able to list, search, filter, create, edit, activate, deactivate, reset passwords and logically delete application users without exposing Supabase credentials or relying on browser-side authorization.

The module must remain simple enough for daily barbershop operation: dangerous actions are explicit, generated usernames are easy to hand to employees, and every server boundary independently enforces authorization.

## Scope

This increment includes:

- A responsive `/users` page linked from the Administration section of the sidebar.
- Server-side page access restricted to `owner` and `admin`.
- User listing with search, role and status filters plus pagination.
- User creation with an administrator-assigned password.
- Editing first name, last name and role.
- Independent password replacement.
- Activation and deactivation.
- Logical deletion with session revocation and audit metadata.
- Database, API, service, repository and UI tests.
- Updated SQL installation instructions and living project documentation.

This increment does not include:

- Public registration or password recovery.
- Editing usernames.
- Restoring logically deleted users from the interface.
- Viewing deleted users from the normal interface.
- Fine-grained permissions beyond the existing manager/non-manager distinction.
- Bulk user operations.

## Product rules

### Visibility and access

- Only authenticated users with role `owner` or `admin` may open `/users` or call its administrative API endpoints.
- An employee visiting `/users` is redirected to `/`.
- Unauthenticated visitors are redirected to `/login`.
- Client-side visibility is only a convenience. Pages, route handlers, services and database functions enforce their own relevant rules.

### Username behavior

- PostgreSQL continues generating usernames from normalized `first_name.last_name` and adds numeric suffixes for collisions.
- A username is generated once at account creation and remains stable when the first or last name changes.
- Logically deleted users continue reserving their usernames to preserve identity and audit history.
- After creation, the interface prominently shows the generated username so the manager can give it to the employee.

### Password behavior

- A manager assigns the initial password during creation.
- Password replacement is a separate action from profile editing.
- Passwords must satisfy the existing 10-to-128-character validation and are stored only as Argon2id hashes.
- Replacing a password resets login lockout fields and revokes every existing session for the target user.
- Passwords are never returned by the API or shown again after submission.

### Activation and deactivation

- Deactivation is reversible and sets `is_active` to false.
- Deactivation revokes every existing session for the target user.
- Reactivation sets `is_active` to true but does not create a session.
- A manager cannot deactivate their own account.
- The final active owner cannot be deactivated or demoted.

### Logical deletion

- Logical deletion is exposed as `DELETE /api/admin/users/:id`.
- It sets `deleted_at`, records the acting manager in `deleted_by`, sets `is_active` to false and revokes all target sessions.
- A deleted user is excluded from credential lookup, normal detail lookup and normal list results.
- Deletion is idempotent from a data-safety perspective, but the public endpoint returns `404 USER_NOT_FOUND` when the target is already deleted.
- A manager cannot delete their own account.
- The final active owner cannot be deleted.
- A deleted account cannot be reactivated or edited through normal endpoints.
- This release provides no restore endpoint or deleted-user list.

## Architecture

### Database

Add an ordered, copy/paste SQL script `supabase/queries/007_user_soft_deletion.sql` that:

- Adds nullable `users.deleted_at timestamptz`.
- Adds nullable `users.deleted_by uuid` referencing `users(id)` with `on delete set null`.
- Adds an index supporting normal non-deleted user lists.
- Replaces `update_user_profile` so deleted users cannot be changed and its final-owner invariant remains atomic.
- Adds a security-definer `soft_delete_user` function that locks the target and active-owner invariant, rejects self-deletion and final-owner deletion, marks the user deleted/inactive, and revokes sessions in one database transaction.
- Revokes function execution from public browser roles and grants it only to `service_role`.

The SQL files remain the schema source of truth and are manually executed through Supabase SQL Editor.

### Server domain

- Extend database row types and safe user mapping with deletion metadata only where required internally. Normal public `SafeUser` responses do not need to expose `deletedBy`.
- All normal repository reads include `deleted_at is null`.
- Add a repository method that invokes `soft_delete_user` and maps database safety errors to stable application errors.
- Add `deleteUser(actor, targetId)` to the user service.
- The service asserts manager access and translates missing/deleted targets consistently. Atomic self/final-owner enforcement remains authoritative in PostgreSQL.
- Add `DELETE` to the existing dynamic user Route Handler.

### Page authorization

- Add a manager page guard based on the live database session.
- `/users/layout.tsx` owns the authenticated shell and manager-only sidebar.
- `/users/page.tsx` independently repeats the live manager guard so client navigation cannot reuse a stale layout after a session or role change.
- The sidebar renders a working `Usuarios` link only for managers and marks it active on the module page.

### Client data flow

- The page shell is rendered on the server only after manager authorization.
- A focused client view calls `/api/admin/users` and `/api/admin/roles` with same-origin credentials.
- The initial request loads page 1, 20 users per page, all statuses and roles.
- Search input is debounced before issuing list requests. Role, status and page changes issue new list requests immediately.
- Successful mutations close their dialog, display a concise success message and refresh the current list.
- If a mutation changes the visible result set, the list reloads the nearest valid page.
- `401` responses return the browser to `/login`; `403` responses return it to `/`.
- Other API errors remain inside the current dialog or view and use the server-provided Spanish message.

## Interface design

The visual direction is refined industrial utility consistent with the existing Bastardos dashboard: warm gray canvas, dark sidebar, white working surfaces, brand red for primary intent and restrained status colors.

### Desktop

- Header with title `Usuarios`, short operational description and primary `Nuevo usuario` button.
- Compact summary cards for total visible users, active users and inactive users. These describe the current filtered result rather than acting as global analytics.
- A filter bar with search, role, status and clear-filters action.
- A table with user identity, username, role, state, last login and an actions menu.
- Pagination beneath the table with result count.

### Mobile

- The same header and primary action stack vertically.
- Filters remain touch-friendly and wrap without horizontal scrolling.
- Users render as cards with name, username, role, state and a clear actions control.
- All dialogs fit the viewport and keep their primary action reachable.

### Actions

- `Nuevo usuario` opens fields for first name, last name, role and initial password.
- Creation success replaces the form with the generated username and a copy action. Closing it refreshes the list.
- `Editar datos` changes first name, last name and role; username is shown read-only.
- `Cambiar contraseña` uses a dedicated form with password confirmation.
- Active users offer `Desactivar`; inactive users offer `Activar`.
- `Eliminar usuario` uses destructive styling and a confirmation that names the affected user and explains that access ends immediately.
- Self-deactivation and self-deletion controls are disabled in the interface with explanatory text, while the server remains authoritative.

### UI states

- Initial and filter loading uses skeleton rows/cards without removing the surrounding layout.
- Empty filters show `No encontramos usuarios` and a clear-filters action.
- A failed list request shows a retry action.
- Mutation buttons show pending state and prevent duplicate submission.
- Success and error feedback use accessible live regions.

## API contract

Existing endpoints retained:

- `GET /api/admin/users?page=1&pageSize=20&search=&roleId=&status=all`
- `POST /api/admin/users`
- `GET /api/admin/users/:id`
- `PATCH /api/admin/users/:id`
- `PUT /api/admin/users/:id/password`
- `GET /api/admin/roles`

New endpoint:

- `DELETE /api/admin/users/:id`

Successful deletion returns HTTP `200` with `{ data: { id: string } }`. Stable errors include:

- `401 UNAUTHENTICATED`
- `403 FORBIDDEN`
- `404 USER_NOT_FOUND`
- `409 CANNOT_DELETE_SELF`
- `409 LAST_OWNER_REQUIRED`

All request bodies continue using Zod boundary validation and all responses use the existing `{ data }` or `{ error }` envelope.

## Error and concurrency safety

- UI checks reduce accidental actions but never replace server rules.
- PostgreSQL advisory and row locks make final-owner deletion safe under concurrent requests.
- Logical deletion and session revocation occur in the same database transaction.
- User list refreshes tolerate records changing between request and mutation.
- Unknown database errors are logged without sensitive values and return the generic internal error response.

## Testing strategy

- Schema tests cover all accepted list and mutation payloads.
- Repository tests cover deleted-row filtering, deletion RPC parameters and database error mapping.
- Service tests cover manager access, self-deletion, missing targets and successful deletion.
- Route tests cover `DELETE`, authorization and response status.
- Authorization tests cover manager page redirects.
- Sidebar tests cover the manager-only `/users` link and active state.
- View tests cover loading, populated, empty and failed list states; filters; pagination; create success username; edit; password replacement; activation/deactivation; deletion; pending-state duplicate prevention; and server error display.
- Page and layout tests prove live manager authorization at both boundaries.
- Full validation runs focused tests during development, followed by the complete test suite, lint, TypeScript and production build.

## Completion criteria

The module is complete when a manager can perform every supported lifecycle operation from `/users`, an employee cannot access the page or APIs, deleted users cannot authenticate or appear in normal reads, safety invariants survive concurrent database operations, all automated verification passes, the new SQL script is documented for manual execution, and `AGENTS.md`, `product.md` and `context_snapshot.md` accurately describe the delivered state.
