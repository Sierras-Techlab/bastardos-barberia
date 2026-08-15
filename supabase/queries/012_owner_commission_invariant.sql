-- Bastardos Barberia: owner revenue belongs entirely to the barbershop.
-- Run after 011_customer_visits_and_fixed_schedules.sql.

begin;

create or replace function public.enforce_owner_user_commission_rates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role_id = 1 then
    new.service_commission_rate := 0;
    new.product_commission_rate := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_owner_user_commission_rates on public.users;
create trigger enforce_owner_user_commission_rates
before insert or update of role_id, service_commission_rate, product_commission_rate
on public.users
for each row
execute function public.enforce_owner_user_commission_rates();

update public.users
set service_commission_rate = 0,
    product_commission_rate = 0
where role_id = 1
  and (service_commission_rate <> 0 or product_commission_rate <> 0);

alter table public.users
  drop constraint if exists users_owner_commission_rates_check;

alter table public.users
  add constraint users_owner_commission_rates_check check (
    role_id <> 1
    or (service_commission_rate = 0 and product_commission_rate = 0)
  );

create or replace function public.enforce_owner_income_commission()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  responsible_role_id smallint;
begin
  select role_id
  into responsible_role_id
  from public.users
  where id = new.employee_id;

  if not found then
    raise exception using errcode = '23503', message = 'INCOME_EMPLOYEE_NOT_FOUND';
  end if;

  if responsible_role_id = 1 then
    if new.full_service_commission
      or new.full_service_commission_authorized_by is not null
    then
      raise exception using errcode = '42501', message = 'OWNER_COMMISSION_NOT_ALLOWED';
    end if;

    new.service_commission_rate := 0;
    new.product_commission_rate := 0;
    new.service_commission_amount := 0;
    new.product_commission_amount := 0;
    new.commission_total := 0;
    new.barbershop_net := new.total;
    new.full_service_commission := false;
    new.full_service_commission_authorized_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_owner_income_commission on public.incomes;
create trigger enforce_owner_income_commission
before insert
on public.incomes
for each row
execute function public.enforce_owner_income_commission();

revoke all on function public.enforce_owner_user_commission_rates() from public, anon, authenticated;
revoke all on function public.enforce_owner_income_commission() from public, anon, authenticated;

commit;

-- Post-install acceptance checks. The first query must return zero rows and
-- the second query must list both triggers as enabled.
select id, username, service_commission_rate, product_commission_rate
from public.users
where role_id = 1
  and (service_commission_rate <> 0 or product_commission_rate <> 0);

select tgname, tgenabled
from pg_trigger
where tgrelid in ('public.users'::regclass, 'public.incomes'::regclass)
  and tgname in (
    'enforce_owner_user_commission_rates',
    'enforce_owner_income_commission'
  )
order by tgname;
