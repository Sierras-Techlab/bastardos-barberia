-- Bastardos Barbería: local application users.
-- Run after 001_extensions_and_roles.sql.

create table if not exists public.users (
  id uuid primary key default extensions.gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  username text not null unique,
  password_hash text not null,
  role_id smallint not null references public.roles(id),
  is_active boolean not null default true,
  failed_login_attempts smallint not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_first_name_check check (char_length(trim(first_name)) between 1 and 80),
  constraint users_last_name_check check (char_length(trim(last_name)) between 1 and 80),
  constraint users_username_check check (username ~ '^[a-z0-9]+\.[a-z0-9]+[0-9]*$'),
  constraint users_password_hash_check check (password_hash like '$argon2id$%'),
  constraint users_failed_attempts_check check (failed_login_attempts >= 0)
);

create index if not exists users_role_id_idx on public.users(role_id);
create index if not exists users_active_idx on public.users(is_active);
create index if not exists users_created_at_idx on public.users(created_at desc);
