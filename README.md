# Bastardos Barberia

Internal administrative dashboard built with Next.js 16 and Supabase PostgreSQL. Authentication is local: Supabase is used only as the database, not as an authentication provider.

## Local setup

Requirements: Node 24.18.x and npm 11.16.x.

```bash
npm install
Copy-Item .env.example .env
npm run dev
```

Required permanent environment variables:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SECRET_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_` and never expose it to frontend code. The publishable Supabase key is not required by the authentication implementation.

Database audit and acceptance commands also require an operations-only direct PostgreSQL URL:

```dotenv
SUPABASE_DB_URL=
```

## Create the database

Open the Supabase SQL Editor and execute each file completely in this order:

1. `supabase/queries/001_extensions_and_roles.sql`
2. `supabase/queries/002_users.sql`
3. `supabase/queries/003_sessions.sql`
4. `supabase/queries/004_functions_and_triggers.sql`
5. `supabase/queries/005_security.sql`
6. `supabase/queries/006_atomic_auth_guards.sql`

For the complete application, continue through `supabase/queries/040_production_hardening.sql` in the exact order documented in `supabase/queries/README.md`. Migration `039` belongs to Reports; databases already installed through that migration execute only `040`. Do not replay structural migrations over populated production data.

See `supabase/queries/README.md` for verification queries and the responsibility of each script.

## Create the first owner

After the SQL scripts succeed, temporarily complete these local `.env` values:

```dotenv
BOOTSTRAP_OWNER_FIRST_NAME=
BOOTSTRAP_OWNER_LAST_NAME=
BOOTSTRAP_OWNER_PASSWORD=
```

Then run:

```bash
npm run bootstrap:owner
```

The command works only while the users table is empty. PostgreSQL generates and returns the final normalized username. Remove the three temporary bootstrap values from `.env` after use. Later users are created through the manager API.

## API contract

Successful responses use `{ "data": ... }`. Errors use `{ "error": { "code", "message", "fields"? } }`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Public | Authenticate by username/password and set the session cookie. |
| POST | `/api/auth/logout` | Session optional | Revoke the current session and clear the cookie. |
| GET | `/api/auth/me` | Authenticated | Return the current safe user. |
| GET | `/api/admin/users` | Owner/Admin | Paginated user list with `page`, `pageSize`, `search`, `roleId`, `status`. |
| POST | `/api/admin/users` | Owner/Admin | Create a user with first name, last name, password and role. |
| GET | `/api/admin/users/:id` | Owner/Admin | Return one safe user. |
| PATCH | `/api/admin/users/:id` | Owner/Admin | Change names, role or active state. |
| PUT | `/api/admin/users/:id/password` | Owner/Admin | Replace password and revoke every session for that user. |
| GET | `/api/admin/roles` | Owner/Admin | Return the fixed role catalog. |
| GET | `/api/payment-methods` | Authenticated | Return active and inactive payment methods for current and historical UI. |
| POST | `/api/payment-methods` | Owner/Admin | Create an active payment method. |
| GET | `/api/payment-methods/:id` | Authenticated | Return one active or inactive payment method. |
| PATCH | `/api/payment-methods/:id` | Owner/Admin | Rename, deactivate or reactivate a payment method. |
| DELETE | `/api/payment-methods/:id` | Owner/Admin | Permanently delete an unused method; referenced methods return a conflict and must be deactivated. |
| DELETE | `/api/product-categories/:id` | Owner/Admin | Permanently delete an unused category; referenced categories return a conflict and must be deactivated. |
| GET | `/api/cash?date=YYYY-MM-DD` | Owner/Admin | Return today's live cash or one immutable historical closure with sale/payment audit detail. |
| GET | `/api/cash/history` | Owner/Admin | Return paginated active-day closures; supports `dateFrom`, `dateTo`, `page` and `pageSize`. |

## Cash lifecycle

`/cash` is available only to owner/admin. It supports manual opening, closing and reconciliation confirmation, with automatic first-income opening and hourly recovery for prior unclosed activity dates.

Migration `018` introduces the immutable cash snapshots and schedules an idempotent hourly `pg_cron` recovery job; `022` adds the manual lifecycle. Historical closures are immutable: a later income void creates a negative adjustment on the void date and preserves the original close for audit. Expenses are a separate manager-only operating module and do not mutate Caja.

Create-user body example:

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "password": "a-long-temporary-password",
  "roleId": 3
}
```

The response includes the generated username, for example `ada.lovelace` or `ada.lovelace2`. It never includes a password hash or session token.

## Verification

```bash
npm test
npm run lint
npx next typegen
npx tsc --noEmit
npm run build
npm run audit:db
npm run acceptance:db
npx tsx --env-file=.env scripts/system-clean-install-acceptance.ts --confirm-disposable
```

Start with `AGENTS.md`, `context_snapshot.md` and `product.md` when continuing development.
