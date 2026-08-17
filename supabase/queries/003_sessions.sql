-- Bastardos Barbería: revocable local sessions.
-- Run after 002_users.sql.

create table if not exists public.sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint sessions_token_hash_check check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint sessions_expiry_check check (expires_at > created_at)
);

create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists sessions_active_expiry_idx
  on public.sessions(expires_at)
  where revoked_at is null;
