# Local Authentication with Supabase Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver local employee authentication, revocable sessions, protected routes, administrative user APIs, Supabase SQL scripts, and living documentation.

**Architecture:** Next.js Route Handlers exclusively access Supabase with a server-side secret. Argon2id protects passwords; opaque cookie tokens map to hashed database sessions; database-backed guards authorize sensitive operations.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, Supabase PostgreSQL/PostgREST, Supabase JS, node-rs Argon2, Zod 4, Vitest 4.

## Global Constraints

- No Supabase Auth or browser access to the Supabase secret.
- Database-generated normalized usernames with suffixes from `2`.
- Argon2id passwords; 12-hour revocable sessions.
- Five failures lock for 15 minutes without account disclosure.
- Roles: owner `1`, admin `2`, employee `3`.
- Protect the final owner and self-deactivation.
- Deliver ordered SQL for Supabase SQL Editor.
- Read local Next.js 16 docs before Next-specific code.

### Task 1: Dependencies, environment, and SQL

**Files:** Modify package manifests and `.gitignore`; create `.env.example` and `supabase/queries/001` through `005` plus README.

**Interfaces:** Produces roles, users, sessions, triggers, stable role IDs, and environment contract.

- [ ] Install `@supabase/supabase-js`, `@node-rs/argon2`, `server-only`, and dev dependency `tsx`.
- [ ] Read complete local Next.js guides for Route Handlers, cookies, auth, Proxy, and async params.
- [ ] Add empty Supabase URL/secret, app URL, and three bootstrap owner values to `.env.example`; allow it through `.gitignore`.

- [ ] Write SQL enabling pgcrypto/unaccent; exact approved tables/indexes; normalized username trigger with advisory lock and suffix loop; timestamp trigger; RLS/revokes/service-role grants.
- [ ] Document execution order and verification queries for role seeds and `pg_tables.rowsecurity`.
- [ ] Run `npm test` and `git diff --check`; commit `feat(database): add local auth schema scripts`.

**SQL normalization core:** `regexp_replace(lower(extensions.unaccent(trim(value))), '[^a-z0-9]+', '', 'g')`.

### Task 2: Authentication primitives

**Files:** Create auth constants, password, session-token, username, schemas, types, and colocated tests under `src/lib/auth/`.

**Interfaces:** `hashPassword`, `verifyPassword`, `generateSessionToken`, `hashSessionToken`, `normalizeUsername`, Zod schemas, roles, safe DTOs.

- [ ] Write failing username tests for accents, compound names, punctuation, and empty components; implement NFD normalization and ASCII filtering.
- [ ] Write failing password test asserting `$argon2id$`, correct verification, and incorrect rejection.

- [ ] Implement Argon2id with memory `19456`, time `2`, parallelism `1`, output `32`.
- [ ] Test then implement 32-byte base64url tokens and deterministic 64-character SHA-256 hashes.
- [ ] Define schemas: names 1–80, passwords 10–128, roles `1|2|3`, login/update/reset/list filters; DTOs exclude hashes/tokens.
- [ ] Run auth tests/lint/diff check; commit `feat(auth): add secure authentication primitives`.

**Required assertion:** `expect(await verifyPassword(await hashPassword(password), password)).toBe(true)`.

### Task 3: Server-only persistence

**Files:** Create Supabase admin/types, user repository/tests, session repository, repository contracts.

**Interfaces:** Lazy admin client; credential/safe lookup, list/insert/update/login-state/owner-count; session create/find/touch/revoke.

- [ ] Write failing mapper tests proving snake-case rows become camel-case safe DTOs without `password_hash`.
- [ ] Implement lazy `server-only` client with disabled auth persistence and explicit database types.
- [ ] Implement repositories; absent rows return null and unexpected PostgREST failures become sanitized `DatabaseError`.
- [ ] Run repository tests/lint; commit `feat(auth): add server-only persistence repositories`.

### Task 4: Login, sessions, and authorization

**Files:** Create auth errors, authentication/session/authorization services and tests, plus cookie helpers.

**Interfaces:** `login`, `getCurrentSession`, `revokeSession`, `requireUser`, `requireManager`, cookie set/clear.

- [ ] Write failing login tests for success, wrong password, fifth-failure lock, locked user, inactive user; assert only token hash persists.
- [ ] Implement login normalization, generic credential errors, failure/success updates, and 12-hour session creation.
- [ ] Write failing valid/missing/revoked/expired/inactive session tests and owner/admin/employee guard tests.

- [ ] Implement database-backed session loading; only owner/admin pass `requireManager`; never trust a cookie role.
- [ ] Set cookie `HttpOnly`, `SameSite=Lax`, path `/`, production `Secure`, and 12-hour max age with async `cookies()`.
- [ ] Run auth tests/lint; commit `feat(auth): implement login and session authorization`.

**Required failure:** invalid credentials reject with `{ code: INVALID_CREDENTIALS, status: 401 }` and never disclose lock/existence.

### Task 5: Administrative user lifecycle

**Files:** Create `src/lib/users/service.ts` and `service.test.ts`.

**Interfaces:** List/create/get/update/reset-password/list-roles service functions.

- [ ] Write failing tests for hash-before-create, generated username return, pagination, 404, self-deactivation, final-owner protection, valid update, and reset revocation.
- [ ] Implement rules and safe DTO returns. Deactivation/password reset revoke all target sessions.
- [ ] Assert self-deactivation rejects with code `CANNOT_DEACTIVATE_SELF`, status 409.
- [ ] Run service tests/lint; commit `feat(users): add administrative lifecycle rules`.

### Task 6: HTTP API handlers

**Files:** Create API response helper/tests and auth/admin routes matching the design.

**Interfaces:** Success `{ data }`; error `{ error: { code, message, fields? } }`.

- [ ] Test response mapping for 400/401/403/404/409 and sanitized 500; implement helper without stacks/database details.
- [ ] Test auth routes for validation, 401, cookie set, idempotent logout/clear, and `/me`; implement thin handlers.
- [ ] Test admin routes for employee 403, manager success, bad UUID/input 400, missing 404, conflict 409.
- [ ] Implement admin handlers, awaiting Next.js 16 params and authorizing before mutation.
- [ ] Run API tests/lint; commit `feat(api): expose local auth and user administration`.

### Task 7: Route protection and login UI

**Files:** Create `src/proxy.ts` and login-form test; modify login form and protected pages.

**Interfaces:** Optimistic cookie redirects plus authoritative page guards; form calls login API.

- [ ] Test submitted credentials, disabled loading, generic error, and `router.replace(/)` success.
- [ ] Implement accessible submission, duplicate prevention, `role=alert`, and no password logging.
- [ ] Add Proxy redirect for missing cookie excluding API/static assets; never treat presence as authorization.
- [ ] Make protected pages async and invoke database-backed guard redirecting invalid sessions.
- [ ] Run UI/existing tests, lint, build; commit `feat(auth): connect login UI and protect routes`.

### Task 8: Bootstrap and living documentation

**Files:** Create bootstrap script/test, `AGENTS.md`, `product.md`, `context_snapshot.md`; modify scripts/README; delete `CLAUDE.md`.

**Interfaces:** `npm run bootstrap:owner`; durable documentation update protocol.

- [ ] Test missing bootstrap values, existing-user refusal, and successful role-1 hashed insert.
- [ ] Implement TypeScript bootstrap using shared password service; print username only.
- [ ] Preserve generated AGENTS block and add project brain; write product/snapshot; replace boilerplate README; delete CLAUDE.
- [ ] Run tests/lint/diff check; commit `docs: establish project brain and auth operations`.

### Task 9: Final verification and handoff

**Files:** Update `context_snapshot.md` and `product.md` if final state changes.

- [ ] Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check`; every command exits zero.
- [ ] Audit `SUPABASE_SECRET_KEY`, `password_hash`, and `token_hash` references; all remain server-side.
- [ ] Confirm `localStorage`/`sessionStorage` have no authentication use.
- [ ] Record exact branch counts, Git state, completed work, manual SQL/bootstrap steps, and next work.
- [ ] Commit a changed snapshot as `docs: record local auth delivery state`.
