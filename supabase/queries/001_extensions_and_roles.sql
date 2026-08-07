-- Bastardos Barbería: extensions and fixed application roles.
-- Run first in Supabase SQL Editor.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

create table if not exists public.roles (
  id smallint primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  constraint roles_name_check check (name in ('owner', 'admin', 'employee'))
);

insert into public.roles (id, name)
values (1, 'owner'), (2, 'admin'), (3, 'employee')
on conflict (id) do update set name = excluded.name;
