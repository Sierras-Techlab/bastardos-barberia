# Block 019 — Final Fix Round 1 report

Date: 2026-08-21

Branch: `codex/019-employee-work-sessions`

## Outcome

The four Important findings and both associated Minor findings are closed across migration, repository, API, browser client and responsive Presentismo UI. No remote SQL, dependency installation, push or merge was performed.

## RED evidence

- Optimistic correction concurrency: the focused slice initially failed 6 test files with 16 failures and 19 passes. Failures traced to the absent `updatedAt` response field, absent `expectedUpdatedAt` input/RPC argument, the five-argument SQL signature, missing compare-before-write guard, missing stale-operation acceptance sentinels and the dialog not forwarding its visible version. A later idempotency audit added one structural RED (1 failure / 7 passes) proving that changed PostgreSQL arguments would otherwise leave the superseded five-argument overload installed.
- Income error ownership: 2 files ran with 1 failure and 14 passes. A Supabase `P0001` containing `EMPLOYEE_WORK_SESSION_REQUIRED` became a generic database error in `incomeRepository`; the Route Handler passthrough test was already green.
- Strict browser parsing: 2 files ran with 5 failures and 9 passes. The client accepted manager-shaped employee data and employee-shaped manager data, while History omitted the required viewer role.
- Exact-session manager commission: 1 file ran with 1 failure and 7 passes. The manager table and mobile card omitted the commission for each session.

## GREEN implementation and focused evidence

- Concurrency: 6 files / 36 tests passed. Employee and manager session JSON now requires an offset-bearing `updatedAt`; corrections require an offset-bearing `expectedUpdatedAt`. The migration drops only the superseded five-argument overload before creating the sole canonical RPC `correct_work_session(uuid,uuid,timestamptz,timestamptz,timestamptz,text)`, compares `current_session.updated_at is distinct from expected_updated_at` while holding the row lock and before overlap/audit/session writes, then returns the advanced version. The dialog sends only the visible session token. README acceptance proves stale correction-versus-end cannot reopen and two corrections sharing a token cannot both apply; the valid correction remains audited. Grants/revokes and structural sentinels use the same signature.
- Income error: 3 files / 22 tests passed. `incomeRepository` maps the database sentinel to `AppError("EMPLOYEE_WORK_SESSION_REQUIRED", "Iniciá tu jornada antes de registrar una venta.", 409)`, and `/api/incomes` preserves that public 409 response. The unreachable mapping was removed from `workSessionRepository` without changing other sentinels.
- Browser client: 4 files / 21 tests passed. Every successful current/start/end/correct/list response now reaches an existing strict Zod schema before returning. History passes its explicit `viewerRole`; employee history rejects manager-only keys and manager history requires manager metrics. `cache: "no-store"` remains on every request. A dedicated test preserves `WorkSessionApiError` status, code, message and fields for a structured 409.
- Manager commission: 2 files / 11 tests passed. Desktop and mobile manager projections show `metrics.employeeCommission` on the exact session alongside gross/net; the responsive table minimum width is `72rem`. A two-session fixture verifies distinct `$ 18.000` and `$ 7.000` attribution in both renderings. Employee projection still shows only `Mi comisión` and never gross/net.

## Final verification

- `npm test`: 164 files / 634 tests passed.
- `npm run lint`: passed with zero warnings.
- `npx next typegen`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build -- --webpack`: passed on Next.js 16.3.0; 31 static pages generated and all work-session routes compiled.
- `git diff --check`: passed.

## Cross-layer review

- SQL → repository: the superseded overload is removed and only the canonical six-argument correction signature remains; the version comparison is after `SELECT ... FOR UPDATE` and before overlap or writes; JSON includes the persisted `updated_at` value.
- Repository → API: correction input and RPC parameter names match, income-originated sale guard errors are mapped at the executing repository, and Route Handlers keep their existing authorization/validation order.
- API → browser: success envelopes expose data to strict role-specific schemas; there is no generic `data as T` cast and errors retain their public envelope.
- Browser → UI: History supplies the authenticated viewer role, the correction dialog reuses `session.updatedAt`, corrected responses carry the next token, and manager exact-session commission is rendered on desktop/mobile without widening employee financial access.

## Deferred concern

Historical manager filter coverage for an employee later promoted to a manager remains outside the current catalog contract. Excluding logically deleted users follows the existing lifecycle ruling. Both are documented boundaries and were intentionally not changed in this round.

## External pending action

When separately authorized, manually apply `supabase/queries/019_employee_work_sessions.sql` after installed migration `018`, then execute the README object/RLS/grant/trigger checks and rollback-wrapped acceptance block. This worktree did not mutate Supabase.
