# Task 5 Report — verify and document block 019

## Implementation

- Updated durable/product/operational documentation to describe only delivered
  `019` behavior: employee-only, server-authoritative clocking; employee sale
  guard; manager attribution with open-session linkage or an explicit
  `outsideWorkSession` audit flag; reasoned immutable correction audit; and
  exact-session metrics excluding voided incomes.
- Recorded the complete local rollout: migration, domain/repository, authenticated
  no-store API/client, persistent clock, Presentismo workspace and the early
  employee sale-entry guard.
- Kept remote deployment explicitly separate: `019_employee_work_sessions.sql`
  must be applied manually after `018`, followed by its documented object and
  rollback-wrapped acceptance checks.
- Extended the README acceptance transaction to prove that a manager sale
  attributed to an employee with an open session is linked to that session with
  `outside_work_session = false`; its first-session metrics now assert both
  active sales.

## Verification

```text
npm test
164 files passed, 624 tests passed

npm run lint
exit 0

npx next typegen
Types generated successfully

npx tsc --noEmit
exit 0

npm run build -- --webpack
Next.js 16.3.0 Webpack production build passed (31/31 static pages)

git diff --check
exit 0
```

## Self-review

- `context_snapshot.md` no longer says that `019` is unimplemented or that its
  UI has not started. It records the exact branch/base HEAD before this
  documentation commit and separately labels local delivery versus pending
  Supabase application.
- The documentation preserves the actual trigger matrix: employees require
  their own open session; managers do not, but employee attribution uses an
  open session if available and otherwise is auditable as outside-session.
- No migration SQL, remote Supabase state, push, merge, dependency or product
  behavior was changed.

## Pending external validation

- The main agent must validate the implemented UI at desktop and 390×844,
  exercising clock-in/out, manager history/correction and the employee sale
  guard without console errors or horizontal overflow. This task deliberately
  did not open a browser or GUI.
- Remote installation of `019` after `018`, plus the README object/RLS/grant/
  trigger checks and rollback-wrapped acceptance transaction, remains pending
  authorization and execution.

## Fix Round 1 — effective grant acceptance

### Root cause

The migration already revokes inherited `service_role` DML before granting only
table reads, but the README object check inspected only tables, RLS, RPC names
and the income trigger. It therefore did not verify effective table or function
privileges, including grants inherited through `PUBLIC`.

### RED

After adding the focused structural regression, before changing the README:

```text
npm test -- src/lib/work-sessions/migration-019.test.ts
1 failed / 5 passed
documents effective table and RPC grant checks for all browser roles
expected README to match /has_table_privilege\s*\(/i
```

### Implementation and GREEN

- The README now queries `has_table_privilege` for both work-session tables and
  `service_role`, `anon` and `authenticated`, reporting SELECT plus every DML
  privilege.
- It now queries `has_function_privilege` for the five exact canonical
  `regprocedure` signatures and the same roles.
- Expected results state read-only `service_role` table access, server-only RPC
  execution and zero table/RPC privilege for browser roles. Owner/`postgres`
  implicit privileges are intentionally not asserted.
- The migration structural test now covers the manager-open-session acceptance
  sentinel, linkage/audit predicate, exact two-sale first-session metrics and
  the effective-privilege query/role/signature documentation.

```text
npm test -- src/lib/work-sessions/migration-019.test.ts
1 file / 6 tests passed

npx tsc --noEmit
exit 0

npm run lint
exit 0

git diff --check
exit 0

npm test
164 files / 625 tests passed
```

### Concerns

No SQL was run remotely. The effective-grant checks are documented for the
authorized, post-`018` Supabase acceptance run; desktop and 390×844 validation
remain assigned to the main agent.
