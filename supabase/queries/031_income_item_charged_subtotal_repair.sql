-- Bastardos Barberia: allow charged-price snapshots in the legacy subtotal.
-- Run after 030_create_income_override_record_repair.sql.

begin;

-- Migration 009 made subtotal a generated catalog-price column. The canonical
-- create_income installed by 020 writes the charged amount explicitly, which
-- PostgreSQL rejects with SQLSTATE 428C9 until the generated expression is removed.
alter table public.income_items
  alter column subtotal drop expression if exists;

alter table public.income_items
  drop constraint if exists income_items_subtotal_check,
  drop constraint if exists income_items_line_subtotal_check;

alter table public.income_items
  alter column subtotal set not null,
  add constraint income_items_subtotal_check check (
    subtotal >= 0 and subtotal = charged_subtotal
  ),
  add constraint income_items_line_subtotal_check check (
    line_subtotal >= 0
    and line_subtotal = charged_subtotal
    and subtotal = charged_subtotal
  );

notify pgrst, 'reload schema';

commit;
