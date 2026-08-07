-- Bastardos Barbería: lock public tables to the server application.
-- Run after 004_functions_and_triggers.sql.

alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.sessions enable row level security;

revoke all on table public.roles from anon, authenticated;
revoke all on table public.users from anon, authenticated;
revoke all on table public.sessions from anon, authenticated;

grant usage on schema public to service_role;
grant select on table public.roles to service_role;
grant select, insert, update, delete on table public.users to service_role;
grant select, insert, update, delete on table public.sessions to service_role;

revoke execute on function public.normalize_username_component(text) from public, anon, authenticated;
revoke execute on function public.set_user_username() from public, anon, authenticated;
revoke execute on function public.touch_user_updated_at() from public, anon, authenticated;
