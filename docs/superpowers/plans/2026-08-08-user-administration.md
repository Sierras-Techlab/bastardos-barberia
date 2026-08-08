# User Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a manager-only `/users` module backed by the existing administrative API, including safe logical deletion and every user lifecycle operation.

**Architecture:** Next.js Server Components guard the route with a live database session and render the existing application shell. A focused Client Component consumes same-origin Route Handlers for interactive listing and mutations. The service/repository boundary owns lifecycle rules, while a PostgreSQL RPC makes logical deletion, final-owner protection and session revocation atomic.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript strict mode, Supabase PostgreSQL, Zod 4, React Hook Form, Tailwind CSS, existing shadcn/base-ui components, Vitest and Testing Library.

## Global Constraints

- Supabase remains database-only; browser code must never import the server client or receive `SUPABASE_SECRET_KEY`.
- Only `owner` and `admin` may access `/users` or its APIs.
- Passwords use the existing Argon2id service and are never returned or logged.
- Usernames are immutable after database generation and deleted rows continue reserving them.
- Deactivation is reversible; logical deletion is hidden and has no restore UI in this release.
- Self-deactivation and self-deletion are forbidden; at least one active owner must remain.
- Deletion and target-session revocation must be one PostgreSQL transaction.
- Every private layout and leaf page must independently verify a live session because Next.js layouts persist across navigation.
- SQL remains ordered and manually copy/pasted through Supabase SQL Editor.
- Follow red-green-refactor for every production behavior.

---

### Task 1: Logical-deletion domain contract and service

**Files:**
- Modify: `src/lib/auth/repository-contracts.ts`
- Modify: `src/lib/users/service.ts`
- Modify: `src/lib/users/service.test.ts`

**Interfaces:**
- Consumes: existing `SafeUser`, `assertManager`, `AppError` and dependency-injected `UserServiceDependencies`.
- Produces: `UserRepository.softDelete(id: string, actorId: string, at: string): Promise<string | null>` and `deleteUser(actor: SafeUser, id: string, dependencies?, now?): Promise<{ id: string }>`.

- [ ] **Step 1: Write failing service tests**

Add focused tests proving the intended service contract:

```ts
it("prevents self-deletion before touching persistence", async () => {
  const deps = dependencies();
  await expect(deleteUser(owner, owner.id, deps))
    .rejects.toMatchObject({ code: "CANNOT_DELETE_SELF", status: 409 });
  expect(deps.users.softDelete).not.toHaveBeenCalled();
});

it("logically deletes through the atomic repository operation", async () => {
  const deps = dependencies();
  deps.users.findById.mockResolvedValue({ ...owner, id: "target-id" });
  deps.users.softDelete.mockResolvedValue("target-id");
  await expect(deleteUser(owner, "target-id", deps, new Date("2026-08-08T12:00:00.000Z")))
    .resolves.toEqual({ id: "target-id" });
  expect(deps.users.softDelete).toHaveBeenCalledWith(
    "target-id",
    owner.id,
    "2026-08-08T12:00:00.000Z",
  );
});

it("reports a missing or already deleted target", async () => {
  const deps = dependencies();
  deps.users.findById.mockResolvedValue(null);
  await expect(deleteUser(owner, "missing-id", deps))
    .rejects.toMatchObject({ code: "USER_NOT_FOUND", status: 404 });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/users/service.test.ts`

Expected: FAIL because `deleteUser` and `softDelete` do not exist.

- [ ] **Step 3: Add the minimal contract and service implementation**

Extend `UserRepository`:

```ts
softDelete(id: string, actorId: string, at: string): Promise<string | null>;
```

Implement the service without separately revoking sessions, because the repository RPC will do that atomically:

```ts
export const deleteUser = async (
  actor: SafeUser,
  id: string,
  dependencies = defaultDependencies,
  now = new Date(),
) => {
  assertManager(actor);
  await requireTarget(id, dependencies);
  if (actor.id === id) {
    throw new AppError("CANNOT_DELETE_SELF", "No podés eliminar tu propia cuenta.", 409);
  }
  const deletedId = await dependencies.users.softDelete(id, actor.id, now.toISOString());
  if (!deletedId) throw new AppError("USER_NOT_FOUND", "Usuario no encontrado.", 404);
  return { id: deletedId };
};
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/lib/users/service.test.ts`

Expected: all user service tests PASS.

- [ ] **Step 5: Commit the domain increment**

```bash
git add src/lib/auth/repository-contracts.ts src/lib/users/service.ts src/lib/users/service.test.ts
git commit -m "feat(users): define logical deletion lifecycle"
```

---

### Task 2: Atomic Supabase logical deletion and filtered repositories

**Files:**
- Create: `supabase/queries/007_user_soft_deletion.sql`
- Modify: `supabase/queries/README.md`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `src/lib/users/repository.ts`
- Modify: `src/lib/users/repository.test.ts`
- Modify: `src/lib/sessions/repository.ts`
- Test: `src/lib/sessions/repository.test.ts`

**Interfaces:**
- Consumes: Task 1 `UserRepository.softDelete` contract and current Supabase admin client.
- Produces: database RPC `soft_delete_user(target_user_id uuid, actor_user_id uuid, deletion_time timestamptz) returns uuid` plus repository reads that ignore `deleted_at is not null`.

- [ ] **Step 1: Write failing mapper/error tests**

Extend the typed row fixture with:

```ts
deleted_at: null,
deleted_by: null,
```

Add repository error behavior:

```ts
it("maps authoritative self-deletion failures to a safe conflict", () => {
  expect(() => userMutationFailure("delete user", {
    code: "P0001",
    message: "CANNOT_DELETE_SELF",
  })).toThrowError(expect.objectContaining({
    code: "CANNOT_DELETE_SELF",
    status: 409,
  }));
});
```

Add a session repository query test using the existing Supabase mock style, asserting credential and live-session reads apply `.is("deleted_at", null)` to the related user selection or an equivalent non-deleted predicate.

- [ ] **Step 2: Run repository tests and verify RED**

Run: `npm test -- src/lib/users/repository.test.ts src/lib/sessions/repository.test.ts`

Expected: FAIL because row types, deletion error mapping and deleted-user predicates are absent.

- [ ] **Step 3: Add typed fields, query filters and the repository RPC**

Extend `UserRow`:

```ts
deleted_at: string | null;
deleted_by: string | null;
```

Apply `.is("deleted_at", null)` to credential lookup, safe detail lookup and list queries. Ensure session lookup rejects a session whose joined user has been deleted. Map database messages exactly:

```ts
if (error.code === "P0001" && error.message === "CANNOT_DELETE_SELF") {
  throw new AppError("CANNOT_DELETE_SELF", "No podés eliminar tu propia cuenta.", 409);
}
```

Implement the repository operation:

```ts
async softDelete(id, actorId, at) {
  const { data, error } = await getSupabaseAdmin().rpc("soft_delete_user", {
    target_user_id: id,
    actor_user_id: actorId,
    deletion_time: at,
  });
  if (error) userMutationFailure("delete user", error);
  return typeof data === "string" ? data : null;
},
```

- [ ] **Step 4: Add the ordered SQL migration**

The script must add columns/indexes idempotently and define this transactional shape:

```sql
alter table public.users
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null;

create index if not exists users_not_deleted_created_at_idx
  on public.users(created_at desc)
  where deleted_at is null;

create or replace function public.soft_delete_user(
  target_user_id uuid,
  actor_user_id uuid,
  deletion_time timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role_id smallint;
  target_is_active boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('bastardos_active_owner', 0)
  );
  select role_id, is_active into target_role_id, target_is_active
  from public.users
  where id = target_user_id and deleted_at is null
  for update;
  if not found then return null; end if;
  if target_user_id = actor_user_id then
    raise exception using errcode = 'P0001', message = 'CANNOT_DELETE_SELF';
  end if;
  if target_role_id = 1 and target_is_active
    and (select count(*) from public.users where role_id = 1 and is_active and deleted_at is null) <= 1
  then
    raise exception using errcode = 'P0001', message = 'LAST_OWNER_REQUIRED';
  end if;
  update public.users
  set is_active = false, deleted_at = deletion_time,
      deleted_by = actor_user_id, updated_at = deletion_time
  where id = target_user_id;
  update public.sessions
  set revoked_at = coalesce(revoked_at, deletion_time)
  where user_id = target_user_id;
  return target_user_id;
end;
$$;
```

Also replace `update_user_profile` with the existing function body plus `deleted_at is null` in both target selection and update, then revoke public/anon/authenticated execution and grant only `service_role` execution for `soft_delete_user`.

- [ ] **Step 5: Update SQL installation instructions**

Add `007_user_soft_deletion.sql` as step 7 and add this verification query:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'users'
  and column_name in ('deleted_at', 'deleted_by')
order by column_name;
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm test -- src/lib/users/repository.test.ts src/lib/sessions/repository.test.ts src/lib/users/service.test.ts`

Expected: all focused repository/service tests PASS.

- [ ] **Step 7: Commit the persistence increment**

```bash
git add supabase/queries src/lib/supabase/database.types.ts src/lib/users/repository.ts src/lib/users/repository.test.ts src/lib/sessions/repository.ts src/lib/sessions/repository.test.ts
git commit -m "feat(users): persist atomic logical deletion"
```

---

### Task 3: DELETE API and manager page authorization

**Files:**
- Modify: `src/app/api/admin/users/[id]/route.ts`
- Create: `src/app/api/admin/users/[id]/route.test.ts`
- Modify: `src/lib/auth/authorization.ts`
- Modify: `src/lib/auth/authorization.test.ts`

**Interfaces:**
- Consumes: Task 1 `deleteUser` and existing `requireManager`/response envelope.
- Produces: `DELETE /api/admin/users/:id` and `requireManagerPage(): Promise<AuthenticatedSession>`.

- [ ] **Step 1: Write failing route and authorization tests**

Route test:

```ts
it("deletes a validated user as a manager", async () => {
  requireManager.mockResolvedValue({ user: { id: "manager-id" } });
  deleteUser.mockResolvedValue({ id: targetId });
  const response = await DELETE(new Request(`http://localhost/api/admin/users/${targetId}`, {
    method: "DELETE",
  }), { params: Promise.resolve({ id: targetId }) });
  expect(deleteUser).toHaveBeenCalledWith({ id: "manager-id" }, targetId);
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ data: { id: targetId } });
});
```

Authorization tests mock `redirect` and prove `requireManagerPage` redirects unauthenticated errors to `/login`, forbidden errors to `/`, and returns owner/admin sessions.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/app/api/admin/users/[id]/route.test.ts src/lib/auth/authorization.test.ts`

Expected: FAIL because `DELETE` and `requireManagerPage` are absent.

- [ ] **Step 3: Implement the Route Handler and page guard**

Add:

```ts
export async function DELETE(_request: Request, context: UserRouteContext) {
  try {
    const { user } = await requireManager();
    const id = userIdSchema.parse((await context.params).id);
    return successResponse(await deleteUser(user, id));
  } catch (error) {
    return errorResponse(error);
  }
}
```

Add a guard that handles only known authorization errors and rethrows everything else:

```ts
export const requireManagerPage = async () => {
  try {
    return await requireManager();
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/login");
    if (error instanceof AppError && error.status === 403) redirect("/");
    throw error;
  }
};
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/app/api/admin/users/[id]/route.test.ts src/lib/auth/authorization.test.ts`

Expected: all focused tests PASS.

- [ ] **Step 5: Commit the API increment**

```bash
git add src/app/api/admin/users/[id]/route.ts src/app/api/admin/users/[id]/route.test.ts src/lib/auth/authorization.ts src/lib/auth/authorization.test.ts
git commit -m "feat(users): expose logical deletion API"
```

---

### Task 4: Browser API client and user presentation helpers

**Files:**
- Create: `src/lib/users/client.ts`
- Create: `src/lib/users/client.test.ts`
- Create: `src/lib/users/presentation.ts`
- Create: `src/lib/users/presentation.test.ts`

**Interfaces:**
- Consumes: existing `{ data }`/`{ error }` envelopes, `SafeUser`, `PaginatedUsers`, `Role`, `CreateUserInput`, `UpdateUserInput`.
- Produces: typed client functions `listAdminUsers`, `listAdminRoles`, `createAdminUser`, `updateAdminUser`, `resetAdminUserPassword`, `setAdminUserActive`, `deleteAdminUser`; `AdminApiError`; role/date/page-summary presentation helpers.

- [ ] **Step 1: Write failing client tests**

Use `vi.stubGlobal("fetch", vi.fn())` and verify one read plus every HTTP method. Representative assertions:

```ts
it("serializes only populated user filters", async () => {
  fetchMock.mockResolvedValue(Response.json({ data: emptyPage }));
  await listAdminUsers({ page: 2, pageSize: 20, search: " Ana ", status: "active" });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/admin/users?page=2&pageSize=20&search=Ana&status=active",
    expect.objectContaining({ signal: undefined }),
  );
});

it("preserves the server error contract", async () => {
  fetchMock.mockResolvedValue(Response.json({
    error: { code: "LAST_OWNER_REQUIRED", message: "Debe quedar al menos un owner activo." },
  }, { status: 409 }));
  await expect(deleteAdminUser(targetId)).rejects.toMatchObject({
    status: 409,
    code: "LAST_OWNER_REQUIRED",
  });
});
```

Presentation tests cover Spanish role labels, `Nunca` for null last login, formatted dates and current-page active/inactive counts.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/lib/users/client.test.ts src/lib/users/presentation.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the minimal typed client**

Use a shared request helper:

```ts
export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) {
    throw new AdminApiError(response.status, body.error.code, body.error.message, body.error.fields);
  }
  return body.data as T;
};
```

All JSON mutations set `Content-Type: application/json`; delete uses `{ method: "DELETE" }`; activation calls the existing PATCH endpoint with `{ isActive }`.

- [ ] **Step 4: Implement presentation helpers**

Export immutable role labels and helpers whose outputs match the tests:

```ts
export const ROLE_LABELS = { owner: "Dueño", admin: "Administrador", employee: "Empleado" } as const;

export const summarizeUserPage = (items: SafeUser[]) => ({
  total: items.length,
  active: items.filter((user) => user.isActive).length,
  inactive: items.filter((user) => !user.isActive).length,
});
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/lib/users/client.test.ts src/lib/users/presentation.test.ts`

Expected: all focused client/helper tests PASS.

- [ ] **Step 6: Commit the browser data layer**

```bash
git add src/lib/users/client.ts src/lib/users/client.test.ts src/lib/users/presentation.ts src/lib/users/presentation.test.ts
git commit -m "feat(users): add typed admin API client"
```

---

### Task 5: Responsive user administration interface

**Files:**
- Create: `src/components/users/user-filters.tsx`
- Create: `src/components/users/user-list.tsx`
- Create: `src/components/users/user-editor-dialog.tsx`
- Create: `src/components/users/user-password-dialog.tsx`
- Create: `src/components/users/user-confirm-dialog.tsx`
- Create: `src/components/users/users-view.tsx`
- Create: `src/components/users/users-view.test.tsx`

**Interfaces:**
- Consumes: Task 4 API client/helpers, existing Button/Input/Badge/Card/Dialog/Dropdown components, authenticated `currentUser: SafeUser`.
- Produces: `<UsersView currentUser={user} />`, a self-contained client administration surface.

- [ ] **Step 1: Write the failing populated/list/filter test**

Mock only the Task 4 client boundary. Render a page containing one active employee and assert real user-visible behavior:

```tsx
it("loads users and applies manager filters", async () => {
  listAdminRoles.mockResolvedValue(roles);
  listAdminUsers.mockResolvedValue(pageWithEmployee);
  render(<UsersView currentUser={owner} />);
  expect(await screen.findByText("lucia.ferreyra")).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText("Estado"), "inactive");
  await waitFor(() => expect(listAdminUsers).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: "inactive", page: 1 }),
    expect.anything(),
  ));
});
```

Also assert the desktop table and mobile-card containers use responsive classes without duplicating action semantics.

- [ ] **Step 2: Run the view test and verify RED**

Run: `npm test -- src/components/users/users-view.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement loading, filters, responsive list and pagination**

Build a refined industrial interface consistent with the existing warm canvas/dark sidebar/red accent. The orchestrator owns:

```ts
type Filters = {
  search: string;
  roleId: "all" | "1" | "2" | "3";
  status: "all" | "active" | "inactive";
  page: number;
};
```

Debounce only `search` by 300 ms; abort stale list requests; load roles once; reset `page` to 1 for any filter change. Render accessible skeleton, retry and empty states. Use the API page metadata for `Anterior`/`Siguiente` controls.

- [ ] **Step 4: Write failing create/edit/password tests**

Add tests that open controls by accessible name and submit real form fields:

```tsx
it("creates a user and reveals the generated username", async () => {
  createAdminUser.mockResolvedValue({ ...employee, username: "lucia.ferreyra2" });
  render(<UsersView currentUser={owner} />);
  await userEvent.click(await screen.findByRole("button", { name: "Nuevo usuario" }));
  await userEvent.type(screen.getByLabelText("Nombre"), "Lucía");
  await userEvent.type(screen.getByLabelText("Apellido"), "Ferreyra");
  await userEvent.type(screen.getByLabelText("Contraseña inicial"), "Bastardos-2026");
  await userEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
  expect(await screen.findByText("lucia.ferreyra2")).toBeVisible();
});
```

Edit tests prove username is read-only and only changed profile fields are PATCHed. Password tests prove mismatched confirmation blocks submission and a successful request refreshes the list.

- [ ] **Step 5: Run the mutation tests and verify RED**

Run: `npm test -- src/components/users/users-view.test.tsx`

Expected: new tests FAIL because dialogs and mutations are absent.

- [ ] **Step 6: Implement create/edit/password dialogs**

Use Zod-backed form validation and explicit labels. Creation success changes the dialog body to:

```tsx
<div role="status" aria-live="polite">
  <p>Usuario creado</p>
  <code>{createdUser.username}</code>
  <Button type="button" onClick={() => navigator.clipboard.writeText(createdUser.username)}>
    Copiar usuario
  </Button>
</div>
```

Never retain password fields after close/success. Disable submit while pending and show server field/form errors in an accessible live region.

- [ ] **Step 7: Write failing activate/deactivate/delete tests**

Add tests proving:

- Active target opens `Desactivar usuario` and calls PATCH `{ isActive: false }` only after confirmation.
- Inactive target offers `Activar usuario`.
- Delete confirmation contains the target full name and calls DELETE once.
- Current-user destructive controls are disabled and explain why.
- A `LAST_OWNER_REQUIRED` server error remains visible in the dialog.

- [ ] **Step 8: Run destructive-action tests and verify RED**

Run: `npm test -- src/components/users/users-view.test.tsx`

Expected: new tests FAIL because confirmation actions are absent.

- [ ] **Step 9: Implement lifecycle confirmations and error routing**

Use a shared confirm dialog with explicit `variant: "deactivate" | "activate" | "delete"`. Delete requires the destructive label `Eliminar usuario`; deactivation explains session closure. On `AdminApiError` status 401 call `router.replace("/login")`; on 403 call `router.replace("/")`; otherwise preserve `error.message` in the active surface. Reload the nearest valid page after success.

- [ ] **Step 10: Run focused view tests and verify GREEN**

Run: `npm test -- src/components/users/users-view.test.tsx`

Expected: all user view tests PASS with no React `act` or accessibility warnings.

- [ ] **Step 11: Commit the interface increment**

```bash
git add src/components/users src/lib/users
git commit -m "feat(users): build administration workspace"
```

---

### Task 6: Route shell, sidebar navigation and live authorization

**Files:**
- Create: `src/app/users/layout.tsx`
- Create: `src/app/users/layout.test.tsx`
- Create: `src/app/users/page.tsx`
- Create: `src/app/users/page.test.tsx`
- Modify: `src/components/app-sidebar.tsx`
- Modify: `src/components/app-sidebar.test.tsx`

**Interfaces:**
- Consumes: Task 3 `requireManagerPage`, Task 5 `UsersView`, existing `AppSidebar` shell.
- Produces: navigable, manager-only `/users` page with `activeItem="Usuarios"`.

- [ ] **Step 1: Write failing sidebar and route-boundary tests**

Extend sidebar tests:

```tsx
it("links managers to the active user administration page", () => {
  renderSidebar(owner, "Usuarios");
  const link = screen.getByRole("link", { name: "Usuarios" });
  expect(link).toHaveAttribute("href", "/users");
  expect(link.closest("[data-sidebar='menu-button']")).toHaveAttribute("data-active", "true");
});
```

Layout/page tests call async components directly. Both must call `requireManagerPage`; the page must not render `UsersView` when the guard rejects.

- [ ] **Step 2: Run route-shell tests and verify RED**

Run: `npm test -- src/components/app-sidebar.test.tsx src/app/users/layout.test.tsx src/app/users/page.test.tsx`

Expected: FAIL because navigation and `/users` files are absent.

- [ ] **Step 3: Implement sidebar link and manager route shell**

Change administration navigation to include:

```ts
{ label: "Usuarios", icon: UserCog, href: "/users" },
```

Render manager navigation with the same Link/isActive branch already used by operational items. The layout mirrors the incomes shell but calls `requireManagerPage` and passes its user to `AppSidebar`.

The leaf page repeats the guard and renders:

```tsx
const UsersPage = async () => {
  const { user } = await requireManagerPage();
  return (
    <main className="min-h-full px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <UsersView currentUser={user} />
    </main>
  );
};
```

- [ ] **Step 4: Run route-shell tests and verify GREEN**

Run: `npm test -- src/components/app-sidebar.test.tsx src/app/users/layout.test.tsx src/app/users/page.test.tsx`

Expected: all sidebar/page/layout tests PASS.

- [ ] **Step 5: Commit the route increment**

```bash
git add src/app/users src/components/app-sidebar.tsx src/components/app-sidebar.test.tsx
git commit -m "feat(users): publish protected administration page"
```

---

### Task 7: Living documentation and complete verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `product.md`
- Modify: `context_snapshot.md`

**Interfaces:**
- Consumes: completed behavior from Tasks 1-6.
- Produces: accurate durable architecture, product status and operational snapshot.

- [ ] **Step 1: Update durable project context**

Add these facts without duplicating transient implementation detail:

- `AGENTS.md`: logical deletion is audit-preserving, atomic with session revocation, and normal reads exclude deleted accounts; `/users` is a manager-only module.
- `product.md`: mark User administration UI `Implemented`, describe supported lifecycle actions, and set the next product objective to defining the persistent sales domain.
- `context_snapshot.md`: record current branch/branch counts, migration `007`, delivered UI/API behavior, required manual SQL action and the single recommended next task.

- [ ] **Step 2: Run focused feature verification**

Run:

```bash
npm test -- src/lib/users src/lib/auth/authorization.test.ts src/app/api/admin/users src/components/users src/components/app-sidebar.test.tsx src/app/users
```

Expected: all focused feature tests PASS without warnings.

- [ ] **Step 3: Run complete automated verification**

Run each command independently:

```bash
npm test
npm run lint
npx next typegen
npx tsc --noEmit
npm run build
git diff --check
```

Expected: every command exits 0; production build includes `/users` and `DELETE` remains part of the dynamic `/api/admin/users/[id]` handler.

- [ ] **Step 4: Inspect the final repository state**

Run:

```bash
git status --short
git diff --stat
git log -8 --oneline --decorate
```

Expected: only intended documentation changes remain before the final documentation commit; no `.env` file is tracked.

- [ ] **Step 5: Commit the completed module context**

```bash
git add AGENTS.md product.md context_snapshot.md
git commit -m "docs: record user administration delivery"
```

- [ ] **Step 6: Re-run final status and smoke verification**

Run:

```bash
npm test
git status --short
git log -3 --oneline --decorate
```

Expected: all tests PASS and the worktree is clean. Do not push unless the user explicitly requests it.
