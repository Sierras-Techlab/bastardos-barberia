-- Bastardos Barberia: optional customer phone.
-- Run after 041_employee_service_prices_and_automatic_cash.sql as one complete migration.

begin;

alter table public.customers
  alter column phone drop not null,
  alter column normalized_phone drop not null;

alter table public.customers
  drop constraint if exists customers_phone_check;
alter table public.customers
  add constraint customers_phone_check check (
    normalized_phone is null
    or char_length(normalized_phone) between 8 and 15
  );

create or replace function public.set_customer_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.first_name := trim(new.first_name);
  new.last_name := trim(new.last_name);
  new.phone := nullif(trim(new.phone), '');
  new.normalized_phone := nullif(public.normalize_customer_phone(new.phone), '');
  new.email := nullif(lower(trim(new.email)), '');
  new.updated_at := now();
  return new;
end;
$$;

drop index if exists public.customers_active_normalized_phone_key;
create unique index customers_active_normalized_phone_key
  on public.customers(normalized_phone)
  where deleted_at is null and normalized_phone is not null;

notify pgrst, 'reload schema';

commit;
