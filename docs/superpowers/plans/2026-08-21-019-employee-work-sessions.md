# Employee Work Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let employees clock in/out, require an open session for employee-entered sales, audit manager corrections and report production per completed or open session.

**Architecture:** A focused `work-sessions` domain owns strict contracts and role-scoped APIs. Migration `019` adds append-only correction audit plus a before-insert income trigger that attaches the responsible employee's open session or rejects an employee actor without one, avoiding any browser-selected session ID and avoiding a rewrite of canonical `create_income`.

**Tech Stack:** PostgreSQL/Supabase SQL, Next.js 16 App Router and Route Handlers, React 19, TypeScript strict mode, Zod, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-21-operational-control-and-employee-privacy-design.md`

## Global Constraints

- Only current-role `employee` users clock themselves in or out; owner/admin never require a work session for their own sales.
- An employee-created normal or subscription income requires that employee's open session.
- Manager-created income for an employee links the open session when present and otherwise records `outsideWorkSession: true`.
- Server/database time in `America/Argentina/Buenos_Aires` is authoritative; the browser never submits clock timestamps or actor IDs.
- Corrections are manager-only, require a non-empty reason and append prior/new values.
- Active-income metrics are per exact session; voids do not contribute.
- Run migration `019` after `018`; do not create `_v2` functions or tables.
- Add no npm dependency and keep Supabase access server-only.

---

### Task 1: Define the work-session domain with TDD

**Files:**
- Create: `src/types/work-session.ts`
- Create: `src/lib/work-sessions/contracts.ts`
- Create: `src/lib/work-sessions/schemas.ts`
- Create: `src/lib/work-sessions/schemas.test.ts`
- Create: `src/lib/work-sessions/service.ts`
- Create: `src/lib/work-sessions/service.test.ts`

**Interfaces:**
- Produces `WorkSession`, `WorkSessionMetrics`, `WorkSessionCorrectionInput`, `WorkSessionListQuery` and `WorkSessionRepository`.
- Produces `getCurrentWorkSession`, `startWorkSession`, `endWorkSession`, `listWorkSessions` and `correctWorkSession`.

- [ ] **Step 1: Write strict failing schema tests**

Use separate public shapes so manager money cannot enter an employee value:

```ts
type WorkSessionBase = {
  id: string;
  employee: { id: string; firstName: string; lastName: string };
  businessDate: string;
  startedAt: string;
  endedAt: string | null;
  state: "open" | "closed";
};

export type EmployeeWorkSession = WorkSessionBase & {
  metrics: {
    workedMinutes: number;
    saleCount: number;
    employeeCommission: number;
  };
};

export type ManagerWorkSession = WorkSessionBase & {
  metrics: EmployeeWorkSession["metrics"] & {
    grossTotal: number;
    barbershopNet: number;
  };
};

export type WorkSessionCorrectionInput = {
  startedAt: string;
  endedAt: string | null;
  reason: string;
};
```

Tests reject unknown fields, offset-less timestamps, negative money/minutes, a closed session without `endedAt`, an open session with `endedAt`, whitespace-only reason and an employee payload containing manager-only metrics.

- [ ] **Step 2: Run RED**

Run `npm test -- src/lib/work-sessions/schemas.test.ts src/lib/work-sessions/service.test.ts`.

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement schemas, repository interface and services**

Service authorization must be explicit:

```ts
const assertEmployee = (actor: SafeUser) => {
  if (actor.role.name !== "employee") {
    throw new AppError("EMPLOYEE_REQUIRED", "Esta acción corresponde a empleados.", 403);
  }
};

export const startWorkSession = (actor: SafeUser, deps = defaults) => {
  assertEmployee(actor);
  return deps.workSessions.start(actor.id);
};

export const correctWorkSession = (actor: SafeUser, id: string, input: WorkSessionCorrectionInput, deps = defaults) => {
  assertManager(actor);
  return deps.workSessions.correct(actor.id, id, input);
};
```

Manager list results retain gross/net; employee results use a separate schema that omits those keys.

- [ ] **Step 4: Run GREEN and commit**

Run focused tests and `npx tsc --noEmit`.

Commit: `feat(presentism): add work session domain`

---

### Task 2: Add migration 019 and strict repository adapters

**Files:**
- Create: `supabase/queries/019_employee_work_sessions.sql`
- Create: `src/lib/work-sessions/migration-019.test.ts`
- Create: `src/lib/work-sessions/repository.ts`
- Create: `src/lib/work-sessions/repository.test.ts`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `supabase/queries/README.md`

**Interfaces:**
- Produces tables `employee_work_sessions`, `employee_work_session_corrections`.
- Adds `incomes.work_session_id` and `incomes.outside_work_session`.
- Produces canonical RPCs `start_work_session(uuid)`, `end_work_session(uuid)`, `correct_work_session(uuid,uuid,timestamptz,timestamptz,text)`, `get_current_work_session(uuid)` and `list_work_sessions(uuid,uuid,date,date,integer,integer)`.

- [ ] **Step 1: Write failing structural and repository tests**

```ts
expect(sql).toMatch(/create table public\.employee_work_sessions/i);
expect(sql).toMatch(/where ended_at is null/i);
expect(sql).toMatch(/create table public\.employee_work_session_corrections/i);
expect(sql).toMatch(/alter table public\.incomes[\s\S]*work_session_id/i);
expect(sql).toMatch(/create trigger attach_income_work_session/i);
expect(sql).toContain("EMPLOYEE_WORK_SESSION_REQUIRED");
expect(sql).toMatch(/enable row level security/i);
expect(sql).not.toMatch(/_v2/i);
```

Repository tests assert exact RPC names/arguments and map `WORK_SESSION_ALREADY_OPEN`, `WORK_SESSION_NOT_OPEN`, `WORK_SESSION_CONFLICT`, `INVALID_WORK_SESSION_RANGE` and `EMPLOYEE_WORK_SESSION_REQUIRED` to stable `AppError` values.

- [ ] **Step 2: Run RED**

Run `npm test -- src/lib/work-sessions/migration-019.test.ts src/lib/work-sessions/repository.test.ts`.

- [ ] **Step 3: Implement tables, RPCs and trigger**

The trigger must lock the actor and applicable open-session row, never accept a browser session ID, and apply:

```sql
if actor_role = 'employee' then
  if new.registered_by <> new.employee_id or open_session_id is null then
    raise exception 'EMPLOYEE_WORK_SESSION_REQUIRED';
  end if;
  new.work_session_id := open_session_id;
  new.outside_work_session := false;
elsif responsible_role = 'employee' and open_session_id is not null then
  new.work_session_id := open_session_id;
  new.outside_work_session := false;
else
  new.work_session_id := null;
  new.outside_work_session := responsible_role = 'employee';
end if;
```

RPC list JSON branches by requesting role so employee JSON has no gross/net keys. Correction inserts the immutable audit row before updating the session.

- [ ] **Step 4: Add rollback-wrapped acceptance checks**

Cover clock-in, duplicate clock-in, employee sale rejection without session, linked employee sale, manager outside-session sale, manager correction with prior/new timestamps, clock-out, second same-day session and void-excluded metrics.

- [ ] **Step 5: Implement repository parsing and run GREEN**

Run focused tests, `npx tsc --noEmit` and `git diff --check`.

Commit: `feat(presentism): persist audited work sessions`

---

### Task 3: Expose Route Handlers and browser client

**Files:**
- Create: `src/lib/work-sessions/client.ts`
- Create: `src/lib/work-sessions/client.test.ts`
- Create: `src/app/api/work-sessions/route.ts`
- Create: `src/app/api/work-sessions/route.test.ts`
- Create: `src/app/api/work-sessions/current/route.ts`
- Create: `src/app/api/work-sessions/current/route.test.ts`
- Create: `src/app/api/work-sessions/start/route.ts`
- Create: `src/app/api/work-sessions/start/route.test.ts`
- Create: `src/app/api/work-sessions/end/route.ts`
- Create: `src/app/api/work-sessions/end/route.test.ts`
- Create: `src/app/api/work-sessions/[id]/route.ts`
- Create: `src/app/api/work-sessions/[id]/route.test.ts`

**Interfaces:**
- Produces no-store `workSessionClient.current/list`, mutation methods `start/end/correct`, and the five API boundaries from the spec.

- [ ] **Step 1: Read the local Next.js 16 guides and write failing route tests**

Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and the dynamic-route parameter guide under `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions` before editing routes.

Assert `requireUser()` or `requireManager()` runs before body/query/path validation, timestamps are absent from start/end browser bodies, dynamic params are awaited, and clients send `cache: "no-store"`.

- [ ] **Step 2: Run RED**

Run `npm test -- src/app/api/work-sessions src/lib/work-sessions/client.test.ts`.

- [ ] **Step 3: Implement minimal handlers and client**

`POST /start` and `/end` accept no JSON body. `PATCH /[id]` accepts only the strict correction input. `GET /work-sessions` scopes managers by optional `employeeId`; employees are forced to self in the service.

- [ ] **Step 4: Run GREEN and commit**

Run the focused slice and TypeScript.

Commit: `feat(presentism): expose work session API`

---

### Task 4: Add clock control, history and sale-entry guard

**Files:**
- Create: `src/components/work-sessions/work-session-control.tsx`
- Create: `src/components/work-sessions/work-session-control.test.tsx`
- Create: `src/components/work-sessions/work-session-history.tsx`
- Create: `src/components/work-sessions/work-session-history.test.tsx`
- Create: `src/components/work-sessions/work-session-correction-dialog.tsx`
- Create: `src/components/work-sessions/work-session-correction-dialog.test.tsx`
- Create: `src/app/(dashboard)/work-sessions/page.tsx`
- Create: `src/app/(dashboard)/work-sessions/page.test.tsx`
- Modify: `src/components/app-sidebar.tsx`
- Modify: `src/components/app-sidebar.test.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(dashboard)/layout.test.tsx`
- Modify: `src/app/(dashboard)/incomes/new/page.tsx`
- Modify: `src/app/(dashboard)/incomes/new/page.test.tsx`

**Interfaces:**
- Employees receive a persistent start/end control and their sanitized history.
- Managers receive a Presentismo navigation page with employee filtering, gross/net metrics and correction dialog.
- The income page receives `currentWorkSession` and blocks employee submission before loading the full editor when none is open.

- [ ] **Step 1: Write failing UI tests**

Cover employee `Marcar entrada`, live elapsed state, `Marcar salida`, no control for manager, employee history without gross/net labels, manager correction reason required, manager financial metrics and employee sale-entry CTA `Iniciá tu jornada para cargar ventas`.

- [ ] **Step 2: Run RED**

Run `npm test -- src/components/work-sessions src/app/'(dashboard)'/work-sessions src/app/'(dashboard)'/layout.test.tsx src/app/'(dashboard)'/incomes/new/page.test.tsx`.

- [ ] **Step 3: Implement the responsive UI**

Put `WorkSessionControl` in the shared layout only for employees. Add `/work-sessions` to both operational employee navigation and manager administration. Use server-loaded initial data, no hidden manager fields in employee props, Sonner success/error feedback and the existing dialog/card/table patterns.

- [ ] **Step 4: Run GREEN and commit**

Run the focused tests, lint and TypeScript.

Commit: `feat(presentism): add clock and session workspace`

---

### Task 5: Verify and document block 019

**Files:**
- Modify: `AGENTS.md`
- Modify: `product.md`
- Modify: `context_snapshot.md`
- Modify: `supabase/queries/README.md`

- [ ] **Step 1: Update documentation only for delivered behavior**

Record employee-only clocking, manager correction audit, sale guard, outside-session manager attribution, per-session metrics and migration order `019`.

- [ ] **Step 2: Run complete verification**

```bash
npm test
npm run lint
npx next typegen
npx tsc --noEmit
npm run build -- --webpack
git diff --check
```

- [ ] **Step 3: Run SQL acceptance against Supabase when authorized**

Execute `019` after `018`, run the rollback-wrapped acceptance block and verify tables, RLS, function grants and trigger installation.

- [ ] **Step 4: Validate desktop and 390x844 UI**

Exercise clock in/out, manager history/correction and the employee sale guard with no console errors or horizontal overflow.

- [ ] **Step 5: Commit**

Commit: `docs(presentism): record work session rollout`
