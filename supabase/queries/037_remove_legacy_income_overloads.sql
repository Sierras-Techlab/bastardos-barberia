-- Bastardos Barberia: remove superseded income RPC overloads.
-- Run after 036_live_cash_charged_projection_repair.sql.

begin;

drop function if exists public.create_income(
  uuid, uuid, uuid, uuid, uuid, jsonb, jsonb, boolean
);

drop function if exists public.list_incomes(
  uuid, boolean, uuid, date, date, text, text, text, text, integer, integer
);

notify pgrst, 'reload schema';

commit;
