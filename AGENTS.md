<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Bastardos Barberia

## Start here

- Read `context_snapshot.md` for current branch state, delivered work, external SQL status and known boundaries; read `product.md` for scope.
- This is one Next.js 16 App Router application. Pages/layouts are in `src/app`; Route Handlers are in `src/app/api`; domain services, repositories, schemas and browser clients are grouped under `src/lib/*`.
- `src/lib/supabase/admin.ts` is server-only and uses `SUPABASE_SECRET_KEY`. Browser code must never import it or receive that key. Database types live in `src/lib/supabase/database.types.ts`.

## Commands

- Requirements are Node `24.18.x` and npm `11.16.x`; install with `npm install`.
- Run the dev server with `npm run dev`.
- Run all tests with `npm test`; run a focused test with `npx vitest run path/to/file.test.ts` or `npx vitest run -t "test name"`.
- Verification is `npm test`, `npm run lint`, `npx next typegen`, `npx tsc --noEmit`, then `npm run build`.
- `npm run bootstrap:owner` loads `.env` with `tsx`; use it only after all SQL migrations are installed and supplied bootstrap values are intentional, then remove the temporary `BOOTSTRAP_OWNER_*` values.

## Database and security

- Supabase is PostgreSQL storage only; Supabase Auth is not used. Execute every file in `supabase/queries` manually in numeric order, `001` through `018`; consult `supabase/queries/README.md` for migration-specific repair and verification steps.
- SQL is the schema/RPC source of truth. Do not hand-edit generated database types to hide a schema mismatch, and do not apply remote SQL without explicit authorization.
- Tables have RLS enabled with no browser-facing policies; server repositories use the secret role and Route Handlers/services must authorize again at the server boundary.
- `src/proxy.ts` only checks for the session-cookie presence and redirects unauthenticated page requests. It is not authorization.
- Passwords are Argon2id hashes; sessions are random opaque tokens stored as SHA-256 hashes in HttpOnly cookies. Never log or expose either secret.
- Roles are fixed as owner (`1`), admin (`2`) and employee (`3`); owner/admin are managers. Accounts are manager-created, usernames are database-generated, and there is no public registration.
- Preserve lifecycle invariants: user deletion is logical and revokes sessions; the last active owner cannot be removed/demoted; products/services/customers use their documented logical lifecycle; owner commissions remain zero.
- Sale creation and manager voiding are atomic/idempotent database operations. The server determines actor, prices, totals, timestamps, business date, payments and commission snapshots; never trust those values from browser input.
- Sales and Caja use the local date in `America/Argentina/Buenos_Aires`; Caja is manager-only, read-only, and historical closures are immutable with later voids represented by adjustments.

## Working conventions

- Validate request bodies and query/path inputs with the existing Zod schemas, return the established `{ data }` / `{ error }` API envelope, and keep authorization before mutation.
- Add or update focused tests for behavior changes, then run the complete verification sequence above. Do not add real credentials; `.env` is local and `.env.example` contains placeholders only.
- After a completed task, update `context_snapshot.md`; update `product.md` only when scope/status/objectives change, and update this file only for durable architecture or workflow changes.
- Treat `docs/superpowers/specs` as approved design decisions and `docs/superpowers/plans` as implementation history; do not silently change an invariant to make a test pass.
