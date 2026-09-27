-- Allow an initial-balance-only Caja day to close automatically on upgraded databases.
-- Run after 042_optional_customer_phone.sql as one complete migration.

begin;

-- An older 018/022 lineage kept a close-time sale/adjustment requirement.
-- The 041 lifecycle permits an initial balance even when no sale occurs.
alter table public.daily_cash_registers
  drop constraint if exists daily_cash_counts_check;
alter table public.daily_cash_registers
  add constraint daily_cash_counts_check check (
    sale_count >= 0
    and active_sale_count >= 0
    and voided_sale_count >= 0
    and active_sale_count + voided_sale_count = sale_count
    and adjustment_count >= 0
  );

commit;
