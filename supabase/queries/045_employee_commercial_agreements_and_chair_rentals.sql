-- Bastardos Barberia: employee commercial agreements and chair-rental income.
-- Append-only, idempotent after 044. No historical snapshots are rewritten.
begin;

do $$ declare had_all boolean; begin
  select count(*)=6 into had_all from information_schema.columns
   where table_schema='public' and table_name='users' and column_name in
     ('service_commission_enabled','product_commission_enabled','chair_rental_enabled','monthly_chair_rental_amount','chair_rental_effective_from','chair_rental_due_day');
  alter table public.users
    add column if not exists service_commission_enabled boolean not null default true,
    add column if not exists product_commission_enabled boolean not null default true,
    add column if not exists chair_rental_enabled boolean not null default false,
    add column if not exists monthly_chair_rental_amount bigint,
    add column if not exists chair_rental_effective_from text,
    add column if not exists chair_rental_due_day smallint;
  if not had_all then
    update public.users set service_commission_enabled=service_commission_rate>0, product_commission_enabled=product_commission_rate>0, chair_rental_enabled=false, monthly_chair_rental_amount=null, chair_rental_effective_from=null, chair_rental_due_day=null where role_id=3;
  end if;
end $$;

create or replace function public.normalize_employee_agreement_on_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role_id <> 3 then
    new.service_commission_enabled := false;
    new.product_commission_enabled := false;
    new.chair_rental_enabled := false;
    new.monthly_chair_rental_amount := null;
    new.chair_rental_effective_from := null;
    new.chair_rental_due_day := null;
  end if;
  return new;
end $$;
drop trigger if exists users_employee_agreement_insert_normalize on public.users;
create trigger users_employee_agreement_insert_normalize before insert on public.users
for each row execute function public.normalize_employee_agreement_on_insert();

do $$ begin
  update public.users
  set service_commission_enabled=false,
      product_commission_enabled=false,
      chair_rental_enabled=false,
      monthly_chair_rental_amount=null,
      chair_rental_effective_from=null,
      chair_rental_due_day=null
  where role_id <> 3
    and (service_commission_enabled or product_commission_enabled or chair_rental_enabled
      or monthly_chair_rental_amount is not null or chair_rental_effective_from is not null
      or chair_rental_due_day is not null);
   alter table public.users
     drop constraint if exists users_chair_rental_configuration_check,
     drop constraint if exists users_chair_rental_employee_check,
     drop constraint if exists users_employee_agreement_role_check;
   alter table public.users add constraint users_chair_rental_configuration_check check (
     (not chair_rental_enabled and monthly_chair_rental_amount is null and chair_rental_effective_from is null and chair_rental_due_day is null)
     or (chair_rental_enabled and monthly_chair_rental_amount is not null and monthly_chair_rental_amount > 0
       and chair_rental_effective_from is not null and chair_rental_effective_from ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
       and chair_rental_due_day is not null and chair_rental_due_day between 1 and 28)
   );
   alter table public.users add constraint users_chair_rental_employee_check check (role_id = 3 or not chair_rental_enabled);
   alter table public.users add constraint users_employee_agreement_role_check check (
     role_id = 3
     or (not service_commission_enabled and not product_commission_enabled
       and not chair_rental_enabled and monthly_chair_rental_amount is null
       and chair_rental_effective_from is null and chair_rental_due_day is null)
   );
end $$;

create table if not exists public.employee_commercial_agreement_audit (
  id uuid primary key default extensions.gen_random_uuid(),
  employee_id uuid not null references public.users(id) on delete restrict,
  changed_by uuid not null references public.users(id) on delete restrict,
  changed_at timestamptz not null default pg_catalog.clock_timestamp(),
  previous_snapshot jsonb not null, next_snapshot jsonb not null
);
alter table public.employee_commercial_agreement_audit enable row level security;
create index if not exists employee_agreement_audit_employee_idx on public.employee_commercial_agreement_audit(employee_id, changed_at desc);

create or replace function public.prevent_employee_agreement_audit_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$ begin
  raise exception using errcode = '42501', message = 'AGREEMENT_AUDIT_APPEND_ONLY';
end $$;
drop trigger if exists employee_agreement_audit_immutable on public.employee_commercial_agreement_audit;
create trigger employee_agreement_audit_immutable before update or delete on public.employee_commercial_agreement_audit
for each row execute function public.prevent_employee_agreement_audit_mutation();

create or replace function public.audit_employee_commercial_agreement()
returns trigger language plpgsql security definer set search_path = '' as $$ declare actor_id uuid; begin
  if old.service_commission_enabled is distinct from new.service_commission_enabled
    or old.product_commission_enabled is distinct from new.product_commission_enabled
    or old.chair_rental_enabled is distinct from new.chair_rental_enabled
    or old.monthly_chair_rental_amount is distinct from new.monthly_chair_rental_amount
    or old.chair_rental_effective_from is distinct from new.chair_rental_effective_from
     or old.chair_rental_due_day is distinct from new.chair_rental_due_day then
     actor_id := nullif(current_setting('app.actor_user_id', true), '')::uuid;
     if actor_id is null or not exists(select 1 from public.users where id=actor_id and role_id in (1,2) and is_active and deleted_at is null) then
       raise exception using errcode='42501',message='AGREEMENT_ACTOR_REQUIRED';
     end if;
     insert into public.employee_commercial_agreement_audit(employee_id, changed_by, previous_snapshot, next_snapshot)
     values(new.id, actor_id,
      jsonb_build_object('serviceCommissionEnabled',old.service_commission_enabled,'productCommissionEnabled',old.product_commission_enabled,'chairRentalEnabled',old.chair_rental_enabled,'monthlyChairRentalAmount',old.monthly_chair_rental_amount,'chairRentalEffectiveFrom',old.chair_rental_effective_from,'chairRentalDueDay',old.chair_rental_due_day),
      jsonb_build_object('serviceCommissionEnabled',new.service_commission_enabled,'productCommissionEnabled',new.product_commission_enabled,'chairRentalEnabled',new.chair_rental_enabled,'monthlyChairRentalAmount',new.monthly_chair_rental_amount,'chairRentalEffectiveFrom',new.chair_rental_effective_from,'chairRentalDueDay',new.chair_rental_due_day));
  end if; return new;
end $$;
create or replace function public.reset_employee_agreement_on_role_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role_id is distinct from new.role_id and (
    (old.role_id = 3 and new.role_id <> 3)
    or (old.role_id <> 3 and new.role_id = 3)
  ) then
    new.service_commission_enabled := false;
    new.product_commission_enabled := false;
    new.chair_rental_enabled := false;
    new.monthly_chair_rental_amount := null;
    new.chair_rental_effective_from := null;
    new.chair_rental_due_day := null;
  end if;
  return new;
end $$;
drop trigger if exists users_employee_agreement_role_reset on public.users;
create trigger users_employee_agreement_role_reset before update of role_id on public.users
for each row execute function public.reset_employee_agreement_on_role_change();
drop trigger if exists users_employee_agreement_audit on public.users;
create trigger users_employee_agreement_audit after update on public.users for each row execute function public.audit_employee_commercial_agreement();

drop function if exists public.update_employee_commercial_agreement(uuid,uuid,boolean,boolean,boolean,bigint,text,smallint);
create or replace function public.update_employee_commercial_agreement(
  actor_user_id uuid, target_employee_id uuid, agreement jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; locked_employee_id uuid; service_enabled boolean; product_enabled boolean; rental_enabled boolean; rental_amount bigint; rental_from text; rental_due smallint;
begin
  if not exists (select 1 from public.users where id=actor_user_id and role_id=1 and is_active and deleted_at is null) then raise exception using errcode='42501',message='OWNER_REQUIRED'; end if;
  select id into locked_employee_id from public.users where id=target_employee_id and role_id=3 and is_active and deleted_at is null for update;
  if locked_employee_id is null then raise exception using errcode='22023',message='EMPLOYEE_NOT_ELIGIBLE'; end if;
  if jsonb_typeof(agreement) <> 'object' or agreement ?| array['employeeId'] then raise exception using errcode='22023',message='INVALID_EMPLOYEE_AGREEMENT'; end if;
  begin
    service_enabled := (agreement->>'serviceCommissionEnabled')::boolean;
    product_enabled := (agreement->>'productCommissionEnabled')::boolean;
    rental_enabled := (agreement->>'chairRentalEnabled')::boolean;
    rental_amount := nullif(agreement->>'monthlyChairRentalAmount','')::bigint;
    rental_from := nullif(agreement->>'chairRentalEffectiveFrom','');
    rental_due := nullif(agreement->>'chairRentalDueDay','')::smallint;
  exception when others then raise exception using errcode='22023',message='INVALID_EMPLOYEE_AGREEMENT'; end;
  if service_enabled is null or product_enabled is null or rental_enabled is null then raise exception using errcode='22023',message='INVALID_EMPLOYEE_AGREEMENT'; end if;
  if rental_enabled and (rental_amount is null or rental_amount <= 0 or rental_from is null or rental_from !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or rental_due not between 1 and 28) then raise exception using errcode='22023',message='INVALID_CHAIR_RENTAL_AGREEMENT'; end if;
  if not rental_enabled and (rental_amount is not null or rental_from is not null or rental_due is not null) then raise exception using errcode='22023',message='INVALID_CHAIR_RENTAL_AGREEMENT'; end if;
  perform set_config('app.actor_user_id', actor_user_id::text, true);
  update public.users set service_commission_enabled=service_enabled, product_commission_enabled=product_enabled, chair_rental_enabled=rental_enabled, monthly_chair_rental_amount=case when rental_enabled then rental_amount end, chair_rental_effective_from=case when rental_enabled then rental_from end, chair_rental_due_day=case when rental_enabled then rental_due end, updated_at=pg_catalog.clock_timestamp() where id=target_employee_id;
  select jsonb_build_object('serviceCommissionEnabled',service_commission_enabled,'productCommissionEnabled',product_commission_enabled,'chairRentalEnabled',chair_rental_enabled,'monthlyChairRentalAmount',monthly_chair_rental_amount,'chairRentalEffectiveFrom',chair_rental_effective_from,'chairRentalDueDay',chair_rental_due_day) into result from public.users where id=target_employee_id;
  return result;
end $$;

alter table public.incomes add column if not exists chair_rental_period text, add column if not exists chair_rental_paid_at timestamptz, add column if not exists chair_rental_attempt_id uuid;
alter table public.incomes drop constraint if exists incomes_source_type_check;
alter table public.incomes add constraint incomes_source_type_check check (source_type in ('sale','fixed_subscription','chair_rental'));
alter table public.incomes drop constraint if exists incomes_subscription_concept_check;
alter table public.incomes drop constraint if exists incomes_subscription_reference_check;
alter table public.incomes add constraint incomes_subscription_reference_check check (
  (source_type='sale'
    and fixed_customer_id is null and fixed_period is null and subscription_concept is null
    and chair_rental_period is null and chair_rental_paid_at is null and chair_rental_attempt_id is null)
  or (source_type='fixed_subscription'
    and fixed_customer_id is not null and fixed_period is not null
    and fixed_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    and subscription_concept is not null
    and chair_rental_period is null and chair_rental_paid_at is null and chair_rental_attempt_id is null)
  or (source_type='chair_rental'
    and employee_id is not null
    and customer_id is null and fixed_customer_id is null and fixed_period is null and subscription_concept is null
    and chair_rental_period is not null
    and chair_rental_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    and chair_rental_paid_at is not null and chair_rental_attempt_id is not null
    and payment_method is null and work_session_id is null and outside_work_session=false
    and total > 0 and gross_total = total
    and service_commission_base = total and product_commission_base = 0
    and service_commission_rate = 0 and product_commission_rate = 0
    and service_commission_amount = 0 and product_commission_amount = 0
    and commission_total = 0 and barbershop_net = total
    and full_service_commission = false and full_service_commission_authorized_by is null)
  );

create table if not exists public.chair_rental_payment_attempts (
 id uuid primary key default extensions.gen_random_uuid(), employee_id uuid not null references public.users(id) on delete restrict,
 period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), request_id uuid not null,
  income_id uuid not null references public.incomes(id) on delete restrict, amount bigint not null check (amount > 0),
 payment_method_id uuid not null references public.payment_methods(id) on delete restrict, method_name_snapshot text not null,
 status text not null default 'active' check (status in ('active','voided')), paid_at timestamptz,
 confirmed_by uuid not null references public.users(id) on delete restrict, voided_at timestamptz,
 voided_by uuid references public.users(id) on delete restrict, void_reason text,
  created_at timestamptz not null default pg_catalog.clock_timestamp(), request_fingerprint text not null, constraint chair_rental_attempt_request_unique unique(employee_id,period,request_id)
 );
alter table public.chair_rental_payment_attempts enable row level security;
alter table public.chair_rental_payment_attempts add column if not exists request_fingerprint text;
create unique index if not exists chair_rental_one_active_period on public.chair_rental_payment_attempts(employee_id,period) where status='active';
create unique index if not exists chair_rental_request_unique on public.chair_rental_payment_attempts(request_id);
create index if not exists chair_rental_attempt_period_idx on public.chair_rental_payment_attempts(period,employee_id);

create or replace function public.get_employee_commercial_agreement(actor_user_id uuid, target_employee_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.users where id=actor_user_id and role_id in (1,2) and is_active and deleted_at is null) then raise exception using errcode='42501',message='MANAGER_REQUIRED'; end if;
  if not exists (select 1 from public.users where id=target_employee_id and role_id=3 and is_active and deleted_at is null) then return null; end if;
  return (select jsonb_build_object('serviceCommissionEnabled',service_commission_enabled,'productCommissionEnabled',product_commission_enabled,'chairRentalEnabled',chair_rental_enabled,'monthlyChairRentalAmount',monthly_chair_rental_amount,'chairRentalEffectiveFrom',chair_rental_effective_from,'chairRentalDueDay',chair_rental_due_day) from public.users where id=target_employee_id);
end $$;

create or replace function public.chair_rental_payment_as_json(target_attempt_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',a.id,'employeeId',a.employee_id,'employeeName',trim(e.first_name||' '||e.last_name),'period',a.period,'amount',a.amount,'status',case when a.status='active' then 'paid' else 'voided' end,'paymentMethodId',a.payment_method_id,'paymentMethodName',a.method_name_snapshot,'confirmedBy',case when confirmer.id is null then null else jsonb_build_object('id',confirmer.id,'firstName',confirmer.first_name,'lastName',confirmer.last_name) end,'paidAt',a.paid_at,'businessDate',i.business_date,'incomeId',a.income_id,'voidedAt',a.voided_at,'voidedBy',case when voider.id is null then null else jsonb_build_object('id',voider.id,'firstName',voider.first_name,'lastName',voider.last_name) end,'voidReason',a.void_reason)
  from public.chair_rental_payment_attempts a join public.users e on e.id=a.employee_id left join public.users confirmer on confirmer.id=a.confirmed_by left join public.users voider on voider.id=a.voided_by left join public.incomes i on i.id=a.income_id where a.id=target_attempt_id;
$$;

create or replace function public.list_chair_rental_payments(actor_user_id uuid, filter_period text default null, filter_status text default null, page_number integer default 1, page_size integer default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p text := coalesce(filter_period,to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM')); result jsonb; total_count integer;
begin
  if not exists(select 1 from public.users where id=actor_user_id and role_id in(1,2) and is_active and deleted_at is null) then raise exception using errcode='42501',message='MANAGER_REQUIRED'; end if;
  if p !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or (filter_status is not null and filter_status not in('pending','paid','overdue','voided')) then raise exception using errcode='22023',message='INVALID_CHAIR_RENTAL_FILTER'; end if;
  with obligations as (select e.*,active.id active_id,(select x.id from public.chair_rental_payment_attempts x where x.employee_id=e.id and x.period=p and x.status='voided' order by x.created_at desc limit 1) voided_id from public.users e left join public.chair_rental_payment_attempts active on active.employee_id=e.id and active.period=p and active.status='active' where e.role_id=3 and e.chair_rental_enabled and e.chair_rental_effective_from<=p and e.is_active and e.deleted_at is null), classified as (select o.*,case when active_id is not null then 'paid' when voided_id is not null then 'voided' when p < to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM') or (p=to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM') and extract(day from(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires'))>chair_rental_due_day) then 'overdue' else 'pending' end derived_status from obligations o), filtered as(select * from classified where filter_status is null or derived_status=filter_status) select count(*)::integer into total_count from filtered;
  with obligations as (select e.*,active.id active_id,(select x.id from public.chair_rental_payment_attempts x where x.employee_id=e.id and x.period=p and x.status='voided' order by x.created_at desc limit 1) voided_id from public.users e left join public.chair_rental_payment_attempts active on active.employee_id=e.id and active.period=p and active.status='active' where e.role_id=3 and e.chair_rental_enabled and e.chair_rental_effective_from<=p and e.is_active and e.deleted_at is null), classified as(select o.*,case when active_id is not null then 'paid' when voided_id is not null then 'voided' when p < to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM') or (p=to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM') and extract(day from(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires'))>chair_rental_due_day) then 'overdue' else 'pending' end derived_status from obligations o), filtered as(select * from classified where filter_status is null or derived_status=filter_status)
  select jsonb_build_object('items',coalesce(jsonb_agg(case when coalesce(active_id,voided_id) is not null then public.chair_rental_payment_as_json(coalesce(active_id,voided_id)) else jsonb_build_object('id',id,'employeeId',id,'employeeName',trim(first_name||' '||last_name),'period',p,'amount',monthly_chair_rental_amount,'status',derived_status,'paymentMethodId',null,'paymentMethodName',null,'confirmedBy',null,'paidAt',null,'businessDate',null,'incomeId',null,'voidedAt',null,'voidedBy',null,'voidReason',null) end order by last_name,first_name),'[]'::jsonb),'page',greatest(page_number,1),'pageSize',least(greatest(page_size,1),100),'total',total_count,'totalPages',case when total_count=0 then 0 else ceiling(total_count::numeric/least(greatest(page_size,1),100))::integer end) into result from (select * from filtered order by last_name,first_name limit least(greatest(page_size,1),100) offset (greatest(page_number,1)-1)*least(greatest(page_size,1),100)) page;
  return result;
end $$;

create or replace function public.get_chair_rental_detail(actor_user_id uuid, target_employee_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.users where id=actor_user_id and role_id in(1,2) and is_active and deleted_at is null) then raise exception using errcode='42501',message='MANAGER_REQUIRED'; end if;
  if not exists(select 1 from public.users where id=target_employee_id) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(public.chair_rental_payment_as_json(a.id) order by a.period desc,a.created_at desc),'[]'::jsonb) into result from public.chair_rental_payment_attempts a where a.employee_id=target_employee_id;
  return result;
end $$;

create or replace function public.chair_rental_month_summary(target_period text)
returns jsonb language sql stable security definer set search_path = '' as $$
    with obligations as (
    select e.id employee_id, trim(e.first_name||' '||e.last_name) employee_name,
      e.monthly_chair_rental_amount amount, e.chair_rental_due_day due_day,
      case when target_period < to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM')
        or (target_period = to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM')
          and extract(day from (pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')) > e.chair_rental_due_day)
        then 'overdue' else 'pending' end derived_status
    from public.users e
    where e.role_id=3 and e.chair_rental_enabled and e.chair_rental_effective_from <= target_period
      and e.is_active and e.deleted_at is null
      and not exists (select 1 from public.chair_rental_payment_attempts a where a.employee_id=e.id and a.period=target_period and a.status='active')
  ), paying as (
    select i.employee_id, trim(e.first_name||' '||e.last_name) employee_name,
      sum(i.total)::bigint amount, count(*)::integer payment_count
    from public.incomes i join public.users e on e.id=i.employee_id
    where i.source_type='chair_rental' and i.status='active' and i.chair_rental_period=target_period
    group by i.employee_id,e.first_name,e.last_name
  )
  select jsonb_build_object(
    'total', coalesce((select sum(i.total)::bigint from public.incomes i where i.source_type='chair_rental' and i.status='active' and to_char(i.business_date,'YYYY-MM')=target_period),0),
    'count', coalesce((select count(*)::integer from public.incomes i where i.source_type='chair_rental' and i.status='active' and to_char(i.business_date,'YYYY-MM')=target_period),0),
    'payingEmployees', coalesce((select jsonb_agg(jsonb_build_object('employeeId',p.employee_id,'employeeName',p.employee_name,'amount',p.amount,'paymentCount',p.payment_count) order by p.employee_name) from paying p), '[]'::jsonb),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('employeeId',o.employee_id,'employeeName',o.employee_name,'period',target_period,'amount',o.amount,'dueDay',o.due_day,'status',o.derived_status) order by o.employee_name) from obligations o where o.derived_status='pending'), '[]'::jsonb),
    'overdue', coalesce((select jsonb_agg(jsonb_build_object('employeeId',o.employee_id,'employeeName',o.employee_name,'period',target_period,'amount',o.amount,'dueDay',o.due_day,'status',o.derived_status) order by o.employee_name) from obligations o where o.derived_status='overdue'), '[]'::jsonb)
  );
$$;

create or replace function public.attach_income_work_session() returns trigger language plpgsql security definer set search_path='' as $$
declare actor_role text; responsible_role text; open_session_id uuid;
begin
 if new.source_type='chair_rental' then new.work_session_id=null; new.outside_work_session=false; return new; end if;
 perform 1 from public.users where id in(new.registered_by,new.employee_id) order by id for share;
 select case role_id when 1 then 'owner' when 2 then 'admin' when 3 then 'employee' end into actor_role from public.users where id=new.registered_by and is_active and deleted_at is null;
 if not found then raise exception using errcode='22023',message='INVALID_ACTOR'; end if;
 select case role_id when 1 then 'owner' when 2 then 'admin' when 3 then 'employee' end into responsible_role from public.users where id=new.employee_id and is_active and deleted_at is null;
 if not found then raise exception using errcode='P0001',message='EMPLOYEE_NOT_ELIGIBLE'; end if;
 if responsible_role='employee' then select id into open_session_id from public.employee_work_sessions where employee_id=new.employee_id and ended_at is null for update; end if;
 if actor_role='employee' then if new.registered_by<>new.employee_id or open_session_id is null then raise exception using errcode='P0001',message='EMPLOYEE_WORK_SESSION_REQUIRED'; end if; new.work_session_id=open_session_id; new.outside_work_session=false;
 elsif responsible_role='employee' and open_session_id is not null then new.work_session_id=open_session_id; new.outside_work_session=false;
 else new.work_session_id=null; new.outside_work_session=responsible_role='employee'; end if; return new;
end $$;

create or replace function public.prevent_non_owner_chair_rental_void() returns trigger language plpgsql security definer set search_path='' as $$ declare attempt_reason text; attempt_voided_by uuid; attempt_voided_at timestamptz; begin
  if old.status='active' and new.status='voided' and old.source_type='chair_rental' then
    select a.void_reason,a.voided_by,a.voided_at into attempt_reason,attempt_voided_by,attempt_voided_at
    from public.chair_rental_payment_attempts a
    where a.id=new.chair_rental_attempt_id and a.status='voided';
    if coalesce(current_setting('app.chair_rental_void',true),'') <> '1'
      or coalesce(current_setting('app.chair_rental_void_attempt_id',true),'') <> coalesce(new.chair_rental_attempt_id::text,'')
      or coalesce(current_setting('app.chair_rental_void_income_id',true),'') <> coalesce(new.id::text,'')
      or coalesce(current_setting('app.chair_rental_void_reason',true),'') <> trim(coalesce(attempt_reason,''))
      or coalesce(current_setting('app.actor_user_id',true),'') <> coalesce(new.voided_by::text,'')
      or attempt_voided_by is distinct from new.voided_by
      or attempt_voided_at is distinct from new.voided_at
    then raise exception using errcode='42501',message='CHAIR_RENTAL_CANONICAL_VOID_REQUIRED'; end if;
    if not exists(select 1 from public.users where id=new.voided_by and role_id=1 and is_active and deleted_at is null) then raise exception using errcode='42501',message='OWNER_REQUIRED'; end if;
    if new.voided_at is null or length(trim(coalesce(attempt_reason,'')))=0 then raise exception using errcode='22023',message='VOID_REASON_REQUIRED'; end if;
  end if; return new;
end $$;
drop trigger if exists prevent_non_owner_chair_rental_void on public.incomes;
create trigger prevent_non_owner_chair_rental_void before update of status on public.incomes for each row execute function public.prevent_non_owner_chair_rental_void();

-- The generic manager void RPC remains valid for sales and fixed subscriptions,
-- but it is not a second chair-rental cancellation path.  Keep the historical
-- implementation as an internal helper and make the public signature fail
-- before it can mutate inventory, visits, income status or Caja.
do $$ begin
  if pg_catalog.to_regprocedure('public.void_income(uuid,uuid)') is not null
    and pg_catalog.to_regprocedure('public.void_income_045_base(uuid,uuid)') is null then
    alter function public.void_income(uuid,uuid) rename to void_income_045_base;
  end if;
end $$;
create or replace function public.void_income(target_income_id uuid, actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare source text;
begin
  if not exists (
    select 1 from public.users
    where id=actor_user_id and role_id in (1,2) and is_active and deleted_at is null
  ) then
    raise exception using errcode='42501',message='MANAGER_REQUIRED';
  end if;
  select source_type into source from public.incomes where id=target_income_id;
  if source='chair_rental' then
    raise exception using errcode='42501',message='CHAIR_RENTAL_CANONICAL_VOID_REQUIRED';
  end if;
  return public.void_income_045_base(target_income_id,actor_user_id);
end $$;

drop function if exists public.confirm_chair_rental_payment(uuid,uuid,uuid,text,uuid);
create or replace function public.confirm_chair_rental_payment(actor_user_id uuid,target_employee_id uuid,billed_period text,target_payment_method_id uuid,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e record; obligation record; pm record; old_attempt record; paid timestamptz:=pg_catalog.clock_timestamp(); income_id uuid; attempt_id uuid:=extensions.gen_random_uuid();
begin
 if not exists(select 1 from public.users where id=actor_user_id and role_id=1 and is_active and deleted_at is null) then raise exception using errcode='42501',message='OWNER_REQUIRED'; end if;
 if billed_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or request_id is null then raise exception using errcode='22023',message='INVALID_CHAIR_RENTAL_REQUEST'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chair-rental-request:'||request_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chair-rental:'||target_employee_id||':'||billed_period,0));
 select * into old_attempt from public.chair_rental_payment_attempts a where a.request_id=$5;
 if found then if old_attempt.request_fingerprint is distinct from encode(extensions.digest(convert_to(target_employee_id::text||':'||billed_period||':'||target_payment_method_id::text,'UTF8'),'sha256'),'hex') then raise exception using errcode='P0001',message='CHAIR_RENTAL_REQUEST_CONFLICT'; end if; return public.chair_rental_payment_as_json(old_attempt.id); end if;
 select * into e from public.users where id=target_employee_id and role_id=3 and is_active and deleted_at is null for update;
 if not found or not e.chair_rental_enabled or e.chair_rental_effective_from>billed_period then raise exception using errcode='P0001',message='CHAIR_RENTAL_NOT_ACTIVE'; end if;
  perform public.seed_chair_rental_obligations(e.id,e.monthly_chair_rental_amount,e.chair_rental_effective_from,e.chair_rental_due_day,actor_user_id);
  select * into obligation from public.chair_rental_obligations where employee_id=e.id and period=billed_period for update;
  if not found then raise exception using errcode='P0001',message='CHAIR_RENTAL_NOT_ACTIVE'; end if;
 select * into pm from public.payment_methods where id=target_payment_method_id and is_active for share;
 if not found then raise exception using errcode='P0001',message='PAYMENT_METHOD_NOT_AVAILABLE'; end if;
 if exists(select 1 from public.chair_rental_payment_attempts where employee_id=target_employee_id and period=billed_period and status='active') then raise exception using errcode='P0001',message='CHAIR_RENTAL_ALREADY_PAID'; end if;
   insert into public.incomes(request_id,registered_by,employee_id,responsible_role_snapshot,request_fingerprint,customer_id,payment_method,total,gross_total,service_commission_base,product_commission_base,service_commission_rate,product_commission_rate,service_commission_amount,product_commission_amount,commission_total,barbershop_net,full_service_commission,work_session_id,outside_work_session,status,created_at,business_date,source_type,chair_rental_period,chair_rental_paid_at,chair_rental_attempt_id) values(request_id,actor_user_id,target_employee_id,'employee',encode(extensions.digest(convert_to(target_employee_id::text||':'||billed_period||':'||target_payment_method_id::text,'UTF8'),'sha256'),'hex'),null,null,obligation.amount,obligation.amount,obligation.amount,0,0,0,0,0,0,obligation.amount,false,null,false,'active',paid,(paid at time zone 'America/Argentina/Buenos_Aires')::date,'chair_rental',billed_period,paid,attempt_id) returning id into income_id;
   insert into public.income_payments(income_id,payment_method_id,method_name_snapshot,amount) values(income_id,target_payment_method_id,pm.name,obligation.amount);
   insert into public.chair_rental_payment_attempts(id,employee_id,period,request_id,income_id,amount,payment_method_id,method_name_snapshot,paid_at,confirmed_by,request_fingerprint) values(attempt_id,target_employee_id,billed_period,request_id,income_id,obligation.amount,target_payment_method_id,pm.name,paid,actor_user_id,encode(extensions.digest(convert_to(target_employee_id::text||':'||billed_period||':'||target_payment_method_id::text,'UTF8'),'sha256'),'hex'));
 return public.chair_rental_payment_as_json(attempt_id);
end $$;

drop function if exists public.void_chair_rental_payment(uuid,uuid,text);
create or replace function public.void_chair_rental_payment(actor_user_id uuid,target_payment_id uuid,void_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a record; t timestamptz:=pg_catalog.clock_timestamp(); normalized_void_reason text;
begin
 if not exists(select 1 from public.users where id=actor_user_id and role_id=1 and is_active and deleted_at is null) then raise exception using errcode='42501',message='OWNER_REQUIRED'; end if;
 select * into a from public.chair_rental_payment_attempts where id=target_payment_id for update; if not found then raise exception using errcode='P0001',message='CHAIR_RENTAL_NOT_FOUND'; end if;
  if a.status='voided' then return public.chair_rental_payment_as_json(a.id); end if;
  if length(trim(coalesce(void_reason,'')))=0 then raise exception using errcode='22023',message='VOID_REASON_REQUIRED'; end if;
  normalized_void_reason:=trim(void_reason);
  update public.chair_rental_payment_attempts set status='voided',voided_at=t,voided_by=actor_user_id,void_reason=normalized_void_reason where id=a.id;
   perform set_config('app.chair_rental_void','1',true);
   perform set_config('app.chair_rental_void_attempt_id',a.id::text,true);
   perform set_config('app.chair_rental_void_income_id',a.income_id::text,true);
   perform set_config('app.chair_rental_void_reason',normalized_void_reason,true);
  perform set_config('app.actor_user_id',actor_user_id::text,true);
  update public.incomes set status='voided',voided_at=t,voided_by=actor_user_id where id=a.income_id and status='active';
 return public.chair_rental_payment_as_json(a.id);
end $$;

-- Agreement flags are enforced inside the existing canonical sale RPC.  The
-- replacement is intentionally textual so the installed 10-argument
-- signature and every historical idempotency rule remain unchanged.
do $$
declare
  target_function oid;
  d text;
  repaired_definition text;
begin
  target_function := pg_catalog.to_regprocedure(
    'public.create_income(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb)'
  )::oid;
  if target_function is null then
    raise exception using errcode='P0001',message='CREATE_INCOME_EMPLOYEE_AGREEMENT_TARGET_MISSING';
  end if;

  select pg_catalog.pg_get_functiondef(target_function) into d;
  if d ~* 'effective_service_rate := case when employee_record\.role_id=3 and not employee_record\.service_commission_enabled'
    and d ~* 'effective_product_rate := case when employee_record\.role_id=3 and not employee_record\.product_commission_enabled'
    and d ~* 'requested\.full_commission and not \(employee_record\.role_id=3 and not employee_record\.product_commission_enabled\)'
    and d ~* 'line_grant and not \(employee_record\.role_id=3 and not employee_record\.product_commission_enabled\)'
    and d ~* 'normalized_products := coalesce'
  then
    return;
  end if;
  if d ~* 'service_commission_enabled'
    or d ~* 'product_commission_enabled'
    or d ~* 'normalized_products := coalesce'
  then
    raise exception using errcode='P0001',message='CREATE_INCOME_EMPLOYEE_AGREEMENT_REPAIR_PARTIAL';
  end if;
  if d !~* 'select id, role_id, service_commission_rate, product_commission_rate[[:space:]]+into employee_record'
    or d !~* 'effective_service_rate[[:space:]]*:= case[[:space:]]+when full_service then 100'
    or d !~* 'effective_product_rate[[:space:]]*:= employee_record\.product_commission_rate'
    or d !~* 'when requested\.full_commission then 100'
    or d !~* 'when line_grant then 100'
    or d !~* 'if full_service and[[:space:]]*\('
  then
    raise exception using errcode='P0001',message='CREATE_INCOME_EMPLOYEE_AGREEMENT_TARGET_UNEXPECTED';
  end if;

  repaired_definition:=regexp_replace(d,'select id, role_id, service_commission_rate, product_commission_rate[[:space:]]+into employee_record','select id, role_id, service_commission_rate, product_commission_rate, service_commission_enabled, product_commission_enabled into employee_record','i');
  repaired_definition:=regexp_replace(repaired_definition,'effective_service_rate[[:space:]]*:= case[[:space:]]+when full_service then 100[[:space:]]+else employee_record\.service_commission_rate[[:space:]]+end;','effective_service_rate := case when employee_record.role_id=3 and not employee_record.service_commission_enabled then 0 when full_service then 100 else employee_record.service_commission_rate end;','i');
  repaired_definition:=regexp_replace(repaired_definition,'effective_product_rate[[:space:]]*:= employee_record\.product_commission_rate;','effective_product_rate := case when employee_record.role_id=3 and not employee_record.product_commission_enabled then 0 else employee_record.product_commission_rate end;','i');
  repaired_definition:=regexp_replace(repaired_definition,'when requested\.full_commission then 100','when requested.full_commission and not (employee_record.role_id=3 and not employee_record.product_commission_enabled) then 100','gi');
  repaired_definition:=regexp_replace(repaired_definition,'when line_grant then 100','when line_grant and not (employee_record.role_id=3 and not employee_record.product_commission_enabled) then 100','gi');
  repaired_definition:=regexp_replace(repaired_definition,'if full_service and[[:space:]]*\(','if employee_record.role_id=3 and not employee_record.service_commission_enabled then full_service := false; end if; if employee_record.role_id=3 and not employee_record.product_commission_enabled then normalized_products := coalesce((select jsonb_agg(jsonb_set(item,''{grantFullCommission}'',''false''::jsonb)) from jsonb_array_elements(normalized_products) item),''[]''::jsonb); any_full_product := false; end if; if full_service and (','i');
  if repaired_definition = d
    or repaired_definition !~* 'effective_service_rate := case when employee_record\.role_id=3 and not employee_record\.service_commission_enabled'
    or repaired_definition !~* 'effective_product_rate := case when employee_record\.role_id=3 and not employee_record\.product_commission_enabled'
    or repaired_definition !~* 'requested\.full_commission and not \(employee_record\.role_id=3 and not employee_record\.product_commission_enabled\)'
    or repaired_definition !~* 'line_grant and not \(employee_record\.role_id=3 and not employee_record\.product_commission_enabled\)'
    or repaired_definition !~* 'normalized_products := coalesce'
  then
    raise exception using errcode='P0001',message='CREATE_INCOME_EMPLOYEE_AGREEMENT_REPAIR_FAILED';
  end if;
  execute repaired_definition;
end $$;
comment on function public.create_income(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,boolean,jsonb,jsonb) is 'bastardos.045.create_income.v1';

do $$ begin
  if pg_catalog.to_regprocedure('public.income_as_employee_json(uuid)') is not null and pg_catalog.to_regprocedure('public.income_as_employee_json_045_base(uuid)') is null then
    alter function public.income_as_employee_json(uuid) rename to income_as_employee_json_045_base;
  end if;
end $$;
create or replace function public.income_as_employee_json(target_income_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when i.source_type='chair_rental' then null else public.income_as_employee_json_045_base(target_income_id) end
  from public.incomes i where i.id=target_income_id;
$$;

do $$ begin
  if pg_catalog.to_regprocedure('public.income_as_json(uuid)') is not null and pg_catalog.to_regprocedure('public.income_as_json_045_base(uuid)') is null then
    alter function public.income_as_json(uuid) rename to income_as_json_045_base;
  end if;
end $$;
create or replace function public.income_as_json(target_income_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when i.source_type='chair_rental' then
    public.income_as_json_045_base(target_income_id) || jsonb_build_object('sourceType',i.source_type,'chairRentalPeriod',i.chair_rental_period,'paidAt',i.chair_rental_paid_at)
    else public.income_as_json_045_base(target_income_id) end
  from public.incomes i where i.id=target_income_id;
$$;

do $$
declare
  target_function oid;
  d text;
  repaired_definition text;
begin
  target_function := pg_catalog.to_regprocedure(
    'public.list_incomes(uuid,boolean,uuid,date,date,uuid,text,text,text,integer,integer)'
  )::oid;
  if target_function is null then
    raise exception using errcode='P0001',message='LIST_INCOMES_CHAIR_RENTAL_TARGET_MISSING';
  end if;
  select pg_catalog.pg_get_functiondef(target_function) into d;
  if d ~* 'source_type <> ''chair_rental'''
    and d ~* 'sales_gross_total'
    and d ~* 'totals\.sale_count'
    and d ~* 'filter_kind = ''chair_rental'''
    and d ~* 'when totals\.sale_count = 0'
  then
    return;
  end if;
  if d ~* 'source_type <> ''chair_rental'''
    or d ~* 'sales_gross_total'
    or d ~* 'totals\.sale_count'
    or d ~* 'filter_kind = ''chair_rental'''
  then
    raise exception using errcode='P0001',message='LIST_INCOMES_CHAIR_RENTAL_REPAIR_PARTIAL';
  end if;
  if d !~* '\(effective_can_view_all or i\.employee_id = requesting_user_id\)'
    or d !~* '\(count\(\*\) filter \(where status = ''active''\)\)::integer as active_count'
    or d !~* 'filter_kind not in \(''service'', ''products'', ''combined''\)'
  then
    raise exception using errcode='P0001',message='LIST_INCOMES_CHAIR_RENTAL_TARGET_UNEXPECTED';
  end if;

  repaired_definition:=regexp_replace(d,'\(effective_can_view_all or i\.employee_id = requesting_user_id\)','(effective_can_view_all or (i.employee_id = requesting_user_id and i.source_type <> ''chair_rental''))','i');
  repaired_definition:=regexp_replace(repaired_definition,'\(count\(\*\) filter \(where status = ''active''\)\)::integer as active_count','(count(*) filter (where status = ''active''))::integer as active_count, (count(*) filter (where status = ''active'' and source_type <> ''chair_rental''))::integer as sale_count, coalesce(sum(total) filter (where status = ''active'' and source_type <> ''chair_rental''),0)::bigint as sales_gross_total','i');
  repaired_definition:=regexp_replace(repaired_definition,'''count'', totals\.active_count','''count'', totals.sale_count','gi');
  repaired_definition:=regexp_replace(repaired_definition,'totals\.gross_total::numeric / totals\.active_count','totals.sales_gross_total::numeric / totals.sale_count','gi');
  repaired_definition:=regexp_replace(repaired_definition,'when totals\.active_count = 0 then 0 else','when totals.sale_count = 0 then 0 else','gi');
  repaired_definition:=regexp_replace(repaired_definition,'filter_kind not in \(''service'', ''products'', ''combined''\)','filter_kind not in (''service'', ''products'', ''combined'', ''chair_rental'')','i');
  repaired_definition:=regexp_replace(repaired_definition,'or \(filter_kind = ''combined''[[:space:]]+and','or (filter_kind = ''chair_rental'' and i.source_type = ''chair_rental'')'||chr(10)||'       or (filter_kind = ''combined'' and','i');
  if repaired_definition = d
    or repaired_definition !~* 'source_type <> ''chair_rental'''
    or repaired_definition !~* 'sales_gross_total'
    or repaired_definition !~* 'totals\.sale_count'
    or repaired_definition !~* 'filter_kind = ''chair_rental'''
    or repaired_definition !~* 'when totals\.sale_count = 0'
  then
    raise exception using errcode='P0001',message='LIST_INCOMES_CHAIR_RENTAL_REPAIR_FAILED';
  end if;
  execute repaired_definition;
end $$;
comment on function public.list_incomes(uuid,boolean,uuid,date,date,uuid,text,text,text,integer,integer) is 'bastardos.045.list_incomes.v1';

-- The fixed-subscription writer shares the service commission flag.  Repair
-- its installed canonical body rather than introducing a competing overload.
do $$
declare
  target_function oid;
  d text;
  repaired_definition text;
begin
  target_function := pg_catalog.to_regprocedure(
    'public.pay_fixed_customer_month(uuid,uuid,uuid,text,jsonb)'
  )::oid;
  if target_function is null then
    raise exception using errcode='P0001',message='PAY_FIXED_CUSTOMER_MONTH_TARGET_MISSING';
  end if;
  select pg_catalog.pg_get_functiondef(target_function) into d;
  if d ~* 'employee_service_enabled[[:space:]]+boolean;'
    and d ~* 'employee_service_rate,[[:space:]]*employee_product_rate,[[:space:]]*employee_service_enabled'
    and d ~* 'employee_service_rate := case when responsible_employee_role = ''employee'' and not employee_service_enabled'
    and d ~* 'total_commission[[:space:]]*:= round\(monthly_price::numeric \* employee_service_rate / 100\)::bigint;'
  then
    return;
  end if;
  if d ~* 'responsible[[:space:]]+record;'
    and d ~* 'u\.service_commission_rate,[[:space:]]*u\.service_commission_enabled[[:space:]]+into[[:space:]]+responsible'
    and d ~* 'responsible\.service_commission_rate := case when responsible\.role_id = 3 and not responsible\.service_commission_enabled'
    and d ~* 'commission_amount[[:space:]]*:= round\(schedule_price::numeric \* responsible\.service_commission_rate / 100\)::integer;'
  then
    return;
  end if;
  if d ~* 'employee_service_enabled[[:space:]]+boolean;'
    or d ~* 'employee_service_rate,[[:space:]]*employee_product_rate,[[:space:]]*employee_service_enabled'
    or d ~* 'u\.service_commission_rate,[[:space:]]*u\.service_commission_enabled'
    or d ~* 'responsible\.service_commission_enabled'
    or d ~* 'not employee_service_enabled'
  then
    raise exception using errcode='P0001',message='PAY_FIXED_CUSTOMER_MONTH_REPAIR_PARTIAL';
  end if;
  if d ~* 'employee_product_rate smallint;'
    and d ~* 'u\.service_commission_rate,[[:space:]]+u\.product_commission_rate'
    and position('into responsible_employee_role, employee_service_rate, employee_product_rate' in d)>0
    and d ~* 'total_commission[[:space:]]*:= round\(monthly_price::numeric \* employee_service_rate / 100\)::bigint;'
  then
    repaired_definition:=regexp_replace(d,'employee_product_rate smallint;','employee_product_rate smallint;'||chr(10)||'   employee_service_enabled boolean;','i');
    repaired_definition:=regexp_replace(repaired_definition,'u\.service_commission_rate,[[:space:]]+u\.product_commission_rate','u.service_commission_rate, u.product_commission_rate, u.service_commission_enabled','i');
    repaired_definition:=replace(repaired_definition,'into responsible_employee_role, employee_service_rate, employee_product_rate','into responsible_employee_role, employee_service_rate, employee_product_rate, employee_service_enabled');
    repaired_definition:=regexp_replace(repaired_definition,'total_commission[[:space:]]*:= round\(monthly_price::numeric \* employee_service_rate / 100\)::bigint;','employee_service_rate := case when responsible_employee_role = ''employee'' and not employee_service_enabled then 0 else employee_service_rate end;'||chr(10)||'   total_commission := round(monthly_price::numeric * employee_service_rate / 100)::bigint;','i');
    if repaired_definition = d
      or repaired_definition !~* 'employee_service_enabled[[:space:]]+boolean;'
      or repaired_definition !~* 'employee_service_rate,[[:space:]]*employee_product_rate,[[:space:]]*employee_service_enabled'
      or repaired_definition !~* 'employee_service_rate := case when responsible_employee_role = ''employee'' and not employee_service_enabled'
      or repaired_definition !~* 'total_commission[[:space:]]*:= round\(monthly_price::numeric \* employee_service_rate / 100\)::bigint;'
    then
      raise exception using errcode='P0001',message='PAY_FIXED_CUSTOMER_MONTH_REPAIR_FAILED';
    end if;
  elsif d ~* 'responsible[[:space:]]+record;'
    and d ~* 'u\.service_commission_rate[[:space:]]+into[[:space:]]+responsible'
    and d ~* 'commission_amount[[:space:]]*:= round\(schedule_price::numeric \* responsible\.service_commission_rate / 100\)::integer;'
  then
    repaired_definition:=regexp_replace(d,'u\.service_commission_rate[[:space:]]+into[[:space:]]+responsible','u.service_commission_rate, u.service_commission_enabled'||chr(10)||'  into responsible','i');
    repaired_definition:=regexp_replace(repaired_definition,'commission_amount[[:space:]]*:= round\(schedule_price::numeric \* responsible\.service_commission_rate / 100\)::integer;','responsible.service_commission_rate := case when responsible.role_id = 3 and not responsible.service_commission_enabled then 0 else responsible.service_commission_rate end;'||chr(10)||'  commission_amount := round(schedule_price::numeric * responsible.service_commission_rate / 100)::integer;','i');
    if repaired_definition = d
      or repaired_definition !~* 'u\.service_commission_rate,[[:space:]]*u\.service_commission_enabled[[:space:]]+into[[:space:]]+responsible'
      or repaired_definition !~* 'responsible\.service_commission_rate := case when responsible\.role_id = 3 and not responsible\.service_commission_enabled'
      or repaired_definition !~* 'commission_amount[[:space:]]*:= round\(schedule_price::numeric \* responsible\.service_commission_rate / 100\)::integer;'
    then
      raise exception using errcode='P0001',message='PAY_FIXED_CUSTOMER_MONTH_REPAIR_FAILED';
    end if;
  else
    raise exception using errcode='P0001',message='PAY_FIXED_CUSTOMER_MONTH_TARGET_UNEXPECTED';
  end if;
  execute repaired_definition;
end $$;
comment on function public.pay_fixed_customer_month(uuid,uuid,uuid,text,jsonb) is 'bastardos.045.pay_fixed_customer_month.v1';

-- Rentals are their own financial composition. Rename the installed
-- definitions once, then expose the same signatures through stable wrappers.
do $$ declare d text; begin
  if pg_catalog.to_regprocedure('public.get_business_report(uuid,text)') is not null and pg_catalog.to_regprocedure('public.get_business_report_045_base(uuid,text)') is null then
    alter function public.get_business_report(uuid,text) rename to get_business_report_045_base;
  end if;
  if pg_catalog.to_regprocedure('public.get_business_report_045_base(uuid,text)') is not null then
    select pg_catalog.pg_get_functiondef('public.get_business_report_045_base(uuid,text)'::regprocedure) into d;
    d:=regexp_replace(d,'from selected_incomes i[[:space:]]+group by i\.employee_id','from selected_incomes i where i.source_type <> ''chair_rental'' group by i.employee_id','gi');
    d:=regexp_replace(d,'from comparison_incomes i[[:space:]]+group by i\.employee_id','from comparison_incomes i where i.source_type <> ''chair_rental'' group by i.employee_id','gi');
    execute d;
  end if;
end $$;
create or replace function public.get_business_report(actor_user_id uuid,target_month text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  result := public.get_business_report_045_base(actor_user_id,target_month);
  result := result || jsonb_build_object('chairRentals',public.chair_rental_month_summary(target_month));
  result := jsonb_set(result,'{incomeComposition}',coalesce(result->'incomeComposition','[]'::jsonb) || jsonb_build_array(jsonb_build_object('key','chair_rentals','amount',(result->'chairRentals'->>'total')::bigint)),true);
  return result;
end $$;

do $$ begin
  if pg_catalog.to_regprocedure('public.get_expense_month_summary(uuid,text)') is not null and pg_catalog.to_regprocedure('public.get_expense_month_summary_045_base(uuid,text)') is null then
    alter function public.get_expense_month_summary(uuid,text) rename to get_expense_month_summary_045_base;
  end if;
end $$;
create or replace function public.get_expense_month_summary(actor_user_id uuid,target_month text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  result := public.get_expense_month_summary_045_base(actor_user_id,target_month);
  return result || jsonb_build_object('chairRentals',public.chair_rental_month_summary(target_month));
end $$;

alter table public.daily_cash_sales drop constraint if exists daily_cash_sales_kind_check;
alter table public.daily_cash_sales add constraint daily_cash_sales_kind_check check(kind in('service','products','combined','subscription','chair_rental'));

do $$ begin
  if pg_catalog.to_regprocedure('public.cash_day_as_json(date,uuid,boolean)') is not null and pg_catalog.to_regprocedure('public.cash_day_as_json_045_base(date,uuid,boolean)') is null then
    alter function public.cash_day_as_json(date,uuid,boolean) rename to cash_day_as_json_045_base;
  end if;
end $$;

 -- Obligations are immutable snapshots of the agreement that created them.  They
 -- are deliberately separate from users: disabling or editing an agreement must
 -- not erase an unpaid historical period or change its amount/due day.
 create table if not exists public.chair_rental_obligations (
   employee_id uuid not null references public.users(id) on delete restrict,
   period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
   amount bigint not null check (amount > 0),
   due_day smallint not null check (due_day between 1 and 28),
   source_effective_from text not null check (source_effective_from ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
   created_at timestamptz not null default pg_catalog.clock_timestamp(),
   created_by uuid references public.users(id) on delete restrict,
   primary key (employee_id, period)
 );
 alter table public.chair_rental_obligations enable row level security;
 create index if not exists chair_rental_obligation_period_idx on public.chair_rental_obligations(period, employee_id);

 create or replace function public.seed_chair_rental_obligations(
   target_employee_id uuid, target_amount bigint, target_effective_from text,
   target_due_day smallint, target_created_by uuid
 ) returns void language sql security definer set search_path = '' as $$
   insert into public.chair_rental_obligations(employee_id, period, amount, due_day, source_effective_from, created_by)
   select target_employee_id,
     to_char(month_start, 'YYYY-MM'), target_amount, target_due_day, target_effective_from, target_created_by
   from generate_series(
     to_date(target_effective_from || '-01', 'YYYY-MM-DD'),
     date_trunc('month', pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date,
     interval '1 month'
   ) month_start
   where target_amount > 0 and target_due_day between 1 and 28
   on conflict (employee_id, period) do nothing;
 $$;

 -- Include rates in every agreement snapshot.  The same append-only row also
  -- captures ordinary rate edits made through the existing profile RPC.
  create or replace function public.audit_employee_commercial_agreement()
  returns trigger language plpgsql security definer set search_path = '' as $$ declare actor_id uuid; begin
   if old.service_commission_enabled is distinct from new.service_commission_enabled
     or old.product_commission_enabled is distinct from new.product_commission_enabled
     or old.chair_rental_enabled is distinct from new.chair_rental_enabled
     or old.monthly_chair_rental_amount is distinct from new.monthly_chair_rental_amount
     or old.chair_rental_effective_from is distinct from new.chair_rental_effective_from
     or old.chair_rental_due_day is distinct from new.chair_rental_due_day
      or old.service_commission_rate is distinct from new.service_commission_rate
      or old.product_commission_rate is distinct from new.product_commission_rate then
      actor_id := nullif(current_setting('app.actor_user_id', true), '')::uuid;
      if actor_id is null or not exists(select 1 from public.users where id=actor_id and role_id in (1,2) and is_active and deleted_at is null) then
        raise exception using errcode='42501',message='AGREEMENT_ACTOR_REQUIRED';
      end if;
      insert into public.employee_commercial_agreement_audit(employee_id, changed_by, previous_snapshot, next_snapshot)
      values(new.id, actor_id,
       jsonb_build_object('serviceCommissionEnabled',old.service_commission_enabled,'productCommissionEnabled',old.product_commission_enabled,'chairRentalEnabled',old.chair_rental_enabled,'monthlyChairRentalAmount',old.monthly_chair_rental_amount,'chairRentalEffectiveFrom',old.chair_rental_effective_from,'chairRentalDueDay',old.chair_rental_due_day,'serviceCommissionRate',old.service_commission_rate,'productCommissionRate',old.product_commission_rate),
       jsonb_build_object('serviceCommissionEnabled',new.service_commission_enabled,'productCommissionEnabled',new.product_commission_enabled,'chairRentalEnabled',new.chair_rental_enabled,'monthlyChairRentalAmount',new.monthly_chair_rental_amount,'chairRentalEffectiveFrom',new.chair_rental_effective_from,'chairRentalDueDay',new.chair_rental_due_day,'serviceCommissionRate',new.service_commission_rate,'productCommissionRate',new.product_commission_rate));
   end if;
   if new.chair_rental_enabled and new.monthly_chair_rental_amount is not null
     and new.chair_rental_effective_from is not null and new.chair_rental_due_day is not null then
      perform public.seed_chair_rental_obligations(new.id, new.monthly_chair_rental_amount,
        new.chair_rental_effective_from, new.chair_rental_due_day,
        actor_id);
   end if;
   return new;
 end $$;

 -- The legacy profile RPC had no actor argument, so rate changes could not
 -- populate changed_by safely.  Keep its implementation as the inner writer
 -- and expose an actor-aware overload for the server repository.
 create or replace function public.update_user_profile(
   actor_user_id uuid, target_user_id uuid,
   set_first_name boolean, new_first_name text,
   set_last_name boolean, new_last_name text,
   set_role_id boolean, new_role_id smallint,
   set_is_active boolean, new_is_active boolean,
   set_service_commission_rate boolean, new_service_commission_rate smallint,
   set_product_commission_rate boolean, new_product_commission_rate smallint
  ) returns uuid language plpgsql security definer set search_path = '' as $$
  declare actor_role_id smallint;
  begin
    select role_id into actor_role_id
    from public.users
    where id=actor_user_id and role_id in (1,2) and is_active and deleted_at is null;
    if actor_role_id is null then
      raise exception using errcode='42501', message='MANAGER_REQUIRED';
    end if;
    if actor_role_id <> 1 and (set_service_commission_rate or set_product_commission_rate) then
      raise exception using errcode='42501', message='OWNER_REQUIRED';
    end if;
   perform set_config('app.actor_user_id', actor_user_id::text, true);
   return public.update_user_profile(target_user_id,set_first_name,new_first_name,set_last_name,new_last_name,set_role_id,new_role_id,set_is_active,new_is_active,set_service_commission_rate,new_service_commission_rate,set_product_commission_rate,new_product_commission_rate);
 end $$;

 -- Re-declare the manager reads over immutable obligations.  A current users row
 -- is only a source for a not-yet-snapshotted future obligation; historical rows
 -- always come from chair_rental_obligations.
 create or replace function public.list_chair_rental_payments(actor_user_id uuid, filter_period text default null, filter_status text default null, page_number integer default 1, page_size integer default 20)
 returns jsonb language plpgsql stable security definer set search_path = '' as $$
 declare p text := coalesce(filter_period,to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM')); result jsonb; total_count integer;
 begin
   if not exists(select 1 from public.users where id=actor_user_id and role_id in(1,2) and is_active and deleted_at is null) then raise exception using errcode='42501',message='MANAGER_REQUIRED'; end if;
   if p !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or (filter_status is not null and filter_status not in('pending','paid','overdue','voided')) then raise exception using errcode='22023',message='INVALID_CHAIR_RENTAL_FILTER'; end if;
   with obligations as (
     select e.id,e.first_name,e.last_name,e.chair_rental_enabled,e.chair_rental_effective_from,e.chair_rental_due_day,
       coalesce(o.amount,e.monthly_chair_rental_amount) amount,coalesce(o.due_day,e.chair_rental_due_day) snapshot_due_day,
       a.id active_id,v.id voided_id
     from public.users e
     left join public.chair_rental_obligations o on o.employee_id=e.id and o.period=p
     left join public.chair_rental_payment_attempts a on a.employee_id=e.id and a.period=p and a.status='active'
     left join lateral (select x.id from public.chair_rental_payment_attempts x where x.employee_id=e.id and x.period=p and x.status='voided' order by x.created_at desc limit 1) v on true
     where (o.employee_id is not null or (e.role_id=3 and e.chair_rental_enabled and e.chair_rental_effective_from<=p))
       and (o.employee_id is not null or (e.is_active and e.deleted_at is null))
   ), classified as (
     select o.*,case when active_id is not null then 'paid' when voided_id is not null then 'voided'
       when p < to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM')
         or (p=to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM') and extract(day from(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires'))>snapshot_due_day)
       then 'overdue' else 'pending' end derived_status from obligations o
   ), filtered as(select * from classified where filter_status is null or derived_status=filter_status)
   select count(*)::integer into total_count from filtered;
   with obligations as (
     select e.id,e.first_name,e.last_name,coalesce(o.amount,e.monthly_chair_rental_amount) amount,coalesce(o.due_day,e.chair_rental_due_day) snapshot_due_day,a.id active_id,v.id voided_id
     from public.users e left join public.chair_rental_obligations o on o.employee_id=e.id and o.period=p
     left join public.chair_rental_payment_attempts a on a.employee_id=e.id and a.period=p and a.status='active'
     left join lateral (select x.id from public.chair_rental_payment_attempts x where x.employee_id=e.id and x.period=p and x.status='voided' order by x.created_at desc limit 1) v on true
     where (o.employee_id is not null or (e.role_id=3 and e.chair_rental_enabled and e.chair_rental_effective_from<=p)) and (o.employee_id is not null or (e.is_active and e.deleted_at is null))
   ), classified as(select o.*,case when active_id is not null then 'paid' when voided_id is not null then 'voided' when p < to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM') or (p=to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM') and extract(day from(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires'))>snapshot_due_day) then 'overdue' else 'pending' end derived_status from obligations o), filtered as(select * from classified where filter_status is null or derived_status=filter_status)
   select jsonb_build_object('items',coalesce(jsonb_agg(case when coalesce(active_id,voided_id) is not null then public.chair_rental_payment_as_json(coalesce(active_id,voided_id)) else jsonb_build_object('id',extensions.gen_random_uuid(),'employeeId',id,'employeeName',trim(first_name||' '||last_name),'period',p,'amount',amount,'status',derived_status,'paymentMethodId',null,'paymentMethodName',null,'confirmedBy',null,'paidAt',null,'businessDate',null,'incomeId',null,'voidedAt',null,'voidedBy',null,'voidReason',null) end order by last_name,first_name),'[]'::jsonb),'page',greatest(page_number,1),'pageSize',least(greatest(page_size,1),100),'total',total_count,'totalPages',case when total_count=0 then 0 else ceiling(total_count::numeric/least(greatest(page_size,1),100))::integer end) into result from (select * from filtered order by last_name,first_name limit least(greatest(page_size,1),100) offset (greatest(page_number,1)-1)*least(greatest(page_size,1),100)) page;
   return result;
 end $$;

 create or replace function public.chair_rental_month_summary(target_period text)
 returns jsonb language sql stable security definer set search_path = '' as $$
   with obligations as (
     select o.employee_id,trim(e.first_name||' '||e.last_name) employee_name,o.amount,o.due_day,o.period,
       case when target_period < to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM') or (target_period=to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM') and extract(day from(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires'))>o.due_day) then 'overdue' else 'pending' end derived_status
     from public.chair_rental_obligations o join public.users e on e.id=o.employee_id
      where o.period=target_period and not exists(select 1 from public.chair_rental_payment_attempts a where a.employee_id=o.employee_id and a.period=o.period and a.status='active')
      union all
      select e.id,trim(e.first_name||' '||e.last_name),e.monthly_chair_rental_amount,e.chair_rental_due_day,target_period,
        case when target_period < to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM') or (target_period=to_char(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM') and extract(day from(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires'))>e.chair_rental_due_day) then 'overdue' else 'pending' end
      from public.users e
      where e.role_id=3 and e.is_active and e.deleted_at is null and e.chair_rental_enabled and e.chair_rental_effective_from<=target_period
        and not exists(select 1 from public.chair_rental_obligations o2 where o2.employee_id=e.id and o2.period=target_period)
        and not exists(select 1 from public.chair_rental_payment_attempts a where a.employee_id=e.id and a.period=target_period and a.status='active')
    ), paying as (
     select i.employee_id,trim(e.first_name||' '||e.last_name) employee_name,sum(i.total)::bigint amount,count(*)::integer payment_count
     from public.incomes i join public.users e on e.id=i.employee_id
     where i.source_type='chair_rental' and i.status='active' and to_char(i.business_date,'YYYY-MM')=target_period group by i.employee_id,e.first_name,e.last_name
    ), effective_dates as (
     select i.business_date effective_date,sum(i.total)::bigint amount,count(*)::integer payment_count
     from public.incomes i
     where i.source_type='chair_rental' and i.status='active' and to_char(i.business_date,'YYYY-MM')=target_period
     group by i.business_date
    )
   select jsonb_build_object(
     -- total/count are effective cash month; pending/overdue/payers are billed period.
      'total',coalesce((select sum(i.total)::bigint from public.incomes i where i.source_type='chair_rental' and i.status='active' and to_char(i.business_date,'YYYY-MM')=target_period),0),
      'count',coalesce((select count(*)::integer from public.incomes i where i.source_type='chair_rental' and i.status='active' and to_char(i.business_date,'YYYY-MM')=target_period),0),
      'byEffectiveDate',coalesce((select jsonb_agg(jsonb_build_object('date',to_char(d.effective_date,'YYYY-MM-DD'),'amount',d.amount,'count',d.payment_count) order by d.effective_date) from effective_dates d),'[]'::jsonb),
      'payingEmployees',coalesce((select jsonb_agg(jsonb_build_object('employeeId',p.employee_id,'employeeName',p.employee_name,'amount',p.amount,'paymentCount',p.payment_count) order by p.employee_name) from paying p),'[]'::jsonb),
     'pending',coalesce((select jsonb_agg(jsonb_build_object('employeeId',o.employee_id,'employeeName',o.employee_name,'period',o.period,'amount',o.amount,'dueDay',o.due_day,'status',o.derived_status) order by o.employee_name) from obligations o where o.derived_status='pending'),'[]'::jsonb),
     'overdue',coalesce((select jsonb_agg(jsonb_build_object('employeeId',o.employee_id,'employeeName',o.employee_name,'period',o.period,'amount',o.amount,'dueDay',o.due_day,'status',o.derived_status) order by o.employee_name) from obligations o where o.derived_status='overdue'),'[]'::jsonb)
   );
 $$;

   -- Persist the third financial component instead of reconstructing it from
   -- audit rows. Existing 018-044 rows are backfilled from their old two-way
   -- identity; rental rows from an earlier partial 045 are moved out of the
   -- service bucket before the strict checks are promoted.
   -- Drop the old two-way checks before the backfill so a previously started
   -- 045 installation can be repaired even when it already contains a rental
   -- row whose service/product components were zero.
   alter table public.daily_cash_sales drop constraint if exists daily_cash_sales_economics_check;
   alter table public.daily_cash_registers drop constraint if exists daily_cash_sales_amounts_check;
   alter table public.daily_cash_registers drop constraint if exists daily_cash_adjustment_amounts_check;
   alter table public.daily_cash_adjustments drop constraint if exists daily_cash_adjustment_economics_check;
   alter table public.daily_cash_registers
     add column if not exists chair_rental_sales_total bigint;
  alter table public.daily_cash_registers
    add column if not exists chair_rental_adjustment_total bigint;
  alter table public.daily_cash_sales
    add column if not exists chair_rental_total bigint;
  alter table public.daily_cash_adjustments
    add column if not exists chair_rental_delta bigint;

  update public.daily_cash_sales s
  set service_total=0, product_total=0, chair_rental_total=s.gross_total
  from public.incomes i
  where i.id=s.income_id and i.source_type='chair_rental';

  update public.daily_cash_sales
  set chair_rental_total=gross_total-service_total-product_total
  where chair_rental_total is null;

  update public.daily_cash_adjustments a
  set service_delta=0, product_delta=0, chair_rental_delta=a.gross_delta
  from public.incomes i
  where i.id=a.source_income_id and i.source_type='chair_rental';

  update public.daily_cash_adjustments
  set chair_rental_delta=gross_delta-service_delta-product_delta
  where chair_rental_delta is null;

  update public.daily_cash_registers
  set chair_rental_sales_total=sales_gross_total-service_sales_total-product_sales_total,
      chair_rental_adjustment_total=adjustment_gross_total-service_adjustment_total-product_adjustment_total;

  do $$ begin
    if exists (
      select 1 from public.daily_cash_sales
      where gross_total < 0 or commission_total < 0 or barbershop_net < 0
        or commission_total + barbershop_net <> gross_total
        or service_total < 0 or product_total < 0 or chair_rental_total < 0
        or service_total + product_total + chair_rental_total <> gross_total
    ) then
      raise exception using errcode='23514',message='DAILY_CASH_SALES_COMPOSITION_BACKFILL_FAILED';
    end if;
    if exists (
      select 1 from public.daily_cash_adjustments
      where gross_delta >= 0 or commission_delta > 0 or barbershop_net_delta > 0
        or commission_delta + barbershop_net_delta <> gross_delta
        or service_delta > 0 or product_delta > 0 or chair_rental_delta > 0
        or service_delta + product_delta + chair_rental_delta <> gross_delta
    ) then
      raise exception using errcode='23514',message='DAILY_CASH_ADJUSTMENT_COMPOSITION_BACKFILL_FAILED';
    end if;
    if exists (
      select 1 from public.daily_cash_registers
      where sales_gross_total < 0 or sales_commission_total < 0 or sales_barbershop_net < 0
        or sales_commission_total + sales_barbershop_net <> sales_gross_total
        or service_sales_total < 0 or product_sales_total < 0 or chair_rental_sales_total < 0
        or service_sales_total + product_sales_total + chair_rental_sales_total <> sales_gross_total
        or adjustment_gross_total > 0 or adjustment_commission_total > 0 or adjustment_barbershop_net > 0
        or adjustment_commission_total + adjustment_barbershop_net <> adjustment_gross_total
        or service_adjustment_total > 0 or product_adjustment_total > 0 or chair_rental_adjustment_total > 0
        or service_adjustment_total + product_adjustment_total + chair_rental_adjustment_total <> adjustment_gross_total
    ) then
      raise exception using errcode='23514',message='DAILY_CASH_REGISTER_COMPOSITION_BACKFILL_FAILED';
    end if;
  end $$;

  alter table public.daily_cash_registers
    alter column chair_rental_sales_total set default 0,
    alter column chair_rental_sales_total set not null,
    alter column chair_rental_adjustment_total set default 0,
    alter column chair_rental_adjustment_total set not null;
  alter table public.daily_cash_sales
    alter column chair_rental_total set default 0,
    alter column chair_rental_total set not null;
  alter table public.daily_cash_adjustments
    alter column chair_rental_delta set default 0,
    alter column chair_rental_delta set not null;

  alter table public.daily_cash_sales drop constraint if exists daily_cash_sales_economics_check;
  alter table public.daily_cash_sales add constraint daily_cash_sales_economics_check check (
    gross_total >= 0 and commission_total >= 0 and barbershop_net >= 0
    and commission_total + barbershop_net = gross_total
    and service_total >= 0 and product_total >= 0 and chair_rental_total >= 0
    and service_total + product_total + chair_rental_total = gross_total
    and ((kind = 'chair_rental' and service_total = 0 and product_total = 0 and chair_rental_total = gross_total and commission_total = 0)
      or (kind <> 'chair_rental' and chair_rental_total = 0))
  );
  alter table public.daily_cash_registers drop constraint if exists daily_cash_sales_amounts_check;
  alter table public.daily_cash_registers drop constraint if exists daily_cash_adjustment_amounts_check;
  alter table public.daily_cash_registers add constraint daily_cash_sales_amounts_check check (
    sales_gross_total >= 0 and sales_commission_total >= 0 and sales_barbershop_net >= 0
    and sales_barbershop_net + sales_commission_total = sales_gross_total
    and service_sales_total >= 0 and product_sales_total >= 0 and chair_rental_sales_total >= 0
    and service_sales_total + product_sales_total + chair_rental_sales_total = sales_gross_total
  );
  alter table public.daily_cash_registers add constraint daily_cash_adjustment_amounts_check check (
    adjustment_gross_total <= 0 and adjustment_commission_total <= 0 and adjustment_barbershop_net <= 0
    and adjustment_barbershop_net + adjustment_commission_total = adjustment_gross_total
    and service_adjustment_total <= 0 and product_adjustment_total <= 0 and chair_rental_adjustment_total <= 0
    and service_adjustment_total + product_adjustment_total + chair_rental_adjustment_total = adjustment_gross_total
  );
  alter table public.daily_cash_adjustments drop constraint if exists daily_cash_adjustment_economics_check;
  alter table public.daily_cash_adjustments add constraint daily_cash_adjustment_economics_check check (
    gross_delta < 0 and commission_delta <= 0 and barbershop_net_delta <= 0
    and commission_delta + barbershop_net_delta = gross_delta
    and service_delta <= 0 and product_delta <= 0 and chair_rental_delta <= 0
    and service_delta + product_delta + chair_rental_delta = gross_delta
  );

  create or replace function public.snapshot_daily_cash(target_register_id uuid, target_business_date date)
  returns void language plpgsql security definer set search_path = '' as $$
  declare opening_value bigint;
  begin
    select coalesce(opening_balance,0) into opening_value
    from public.daily_cash_registers
    where id=target_register_id and business_date=target_business_date and closed_at is null
    for update;
    if not found then raise exception using errcode='P0001',message='CASH_NOT_OPEN'; end if;

    delete from public.daily_cash_payment_totals where daily_cash_id=target_register_id;
    delete from public.daily_cash_sales where daily_cash_id=target_register_id;

    with sale_totals as (
      select
        coalesce(sum(i.total) filter(where i.status='active'),0)::bigint gross,
        coalesce(sum(i.commission_total) filter(where i.status='active'),0)::bigint commission,
        coalesce(sum(i.barbershop_net) filter(where i.status='active'),0)::bigint net,
        coalesce(sum(case when i.source_type='fixed_subscription' then i.total when i.source_type='chair_rental' then 0 else item_totals.service end) filter(where i.status='active'),0)::bigint service,
        coalesce(sum(case when i.source_type in('fixed_subscription','chair_rental') then 0 else item_totals.product end) filter(where i.status='active'),0)::bigint product,
        coalesce(sum(i.total) filter(where i.status='active' and i.source_type='chair_rental'),0)::bigint chair_rental,
        count(*) filter(where i.source_type <> 'chair_rental')::integer sale_count,
        count(*) filter(where i.status='active' and i.source_type <> 'chair_rental')::integer active_count,
        count(*) filter(where i.status='voided' and i.source_type <> 'chair_rental')::integer voided_count
      from public.incomes i
      left join lateral (
        select coalesce(sum(ii.charged_subtotal) filter(where ii.item_type='service'),0)::bigint service,
          coalesce(sum(ii.charged_subtotal) filter(where ii.item_type='product'),0)::bigint product,
          coalesce(bool_or(ii.item_type='service'),false) has_service,
          coalesce(bool_or(ii.item_type='product'),false) has_product
        from public.income_items ii where ii.income_id=i.id
      ) item_totals on true
      where i.business_date=target_business_date
    ), adjustment_totals as (
      select coalesce(sum(a.gross_delta),0)::bigint gross,
        coalesce(sum(a.commission_delta),0)::bigint commission,
        coalesce(sum(a.barbershop_net_delta),0)::bigint net,
        coalesce(sum(a.service_delta),0)::bigint service,
        coalesce(sum(a.product_delta),0)::bigint product,
        coalesce(sum(a.chair_rental_delta),0)::bigint chair_rental,
        count(*)::integer adjustment_count
      from public.daily_cash_adjustments a where a.business_date=target_business_date
    )
    update public.daily_cash_registers r
    set sales_gross_total=s.gross, sales_commission_total=s.commission, sales_barbershop_net=s.net,
      service_sales_total=s.service, product_sales_total=s.product, chair_rental_sales_total=s.chair_rental,
      adjustment_gross_total=a.gross, adjustment_commission_total=a.commission, adjustment_barbershop_net=a.net,
      service_adjustment_total=a.service, product_adjustment_total=a.product, chair_rental_adjustment_total=a.chair_rental,
      sale_count=s.sale_count, active_sale_count=s.active_count, voided_sale_count=s.voided_count,
      adjustment_count=a.adjustment_count, expected_cash=public.current_cash_expected(target_business_date,opening_value)
    from sale_totals s cross join adjustment_totals a where r.id=target_register_id;

    insert into public.daily_cash_sales(
      daily_cash_id,income_id,employee_id,employee_first_name_snapshot,employee_last_name_snapshot,
      customer_name_snapshot,kind,status_at_close,gross_total,commission_total,barbershop_net,
      service_total,product_total,chair_rental_total,created_at_snapshot
    )
    select target_register_id,i.id,employee.id,employee.first_name,employee.last_name,
      case when customer.id is null then null else trim(customer.first_name||' '||customer.last_name) end,
      case when i.source_type='chair_rental' then 'chair_rental'
        when i.source_type='fixed_subscription' then 'subscription'
        when item_totals.has_service and item_totals.has_product then 'combined'
        when item_totals.has_service then 'service' else 'products' end,
      i.status,i.total,i.commission_total,i.barbershop_net,
      case when i.source_type='fixed_subscription' then i.total when i.source_type='chair_rental' then 0 else item_totals.service end,
      case when i.source_type in('fixed_subscription','chair_rental') then 0 else item_totals.product end,
      case when i.source_type='chair_rental' then i.total else 0 end,i.created_at
    from public.incomes i
    join public.users employee on employee.id=i.employee_id
    left join public.customers customer on customer.id=i.customer_id
    left join lateral (
      select coalesce(sum(ii.charged_subtotal) filter(where ii.item_type='service'),0)::bigint service,
        coalesce(sum(ii.charged_subtotal) filter(where ii.item_type='product'),0)::bigint product,
        coalesce(bool_or(ii.item_type='service'),false) has_service,
        coalesce(bool_or(ii.item_type='product'),false) has_product
      from public.income_items ii where ii.income_id=i.id
    ) item_totals on true
    where i.business_date=target_business_date;

    with method_movements as (
      select ip.payment_method_id,ip.method_name_snapshot,ip.amount::bigint sales_amount,0::bigint adjustment_amount
      from public.income_payments ip join public.incomes i on i.id=ip.income_id
      where i.business_date=target_business_date and i.status='active'
      union all
      select ap.payment_method_id,ap.method_name_snapshot,0::bigint,ap.amount::bigint
      from public.daily_cash_adjustment_payments ap join public.daily_cash_adjustments a on a.id=ap.adjustment_id
      where a.business_date=target_business_date
    )
    insert into public.daily_cash_payment_totals(daily_cash_id,payment_method_id,method_name_snapshot,sales_amount,adjustment_amount)
    select target_register_id,payment_method_id,method_name_snapshot,sum(sales_amount)::bigint,sum(adjustment_amount)::bigint
    from method_movements group by payment_method_id,method_name_snapshot;
  end $$;

  create or replace function public.close_pending_daily_cash()
  returns integer language plpgsql security definer set search_path = '' as $$
  declare local_today date := (pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date; open_register record; closed_count integer:=0;
  begin
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bastardos_daily_cash_close'));
    insert into public.daily_cash_registers(
      business_date,sales_gross_total,sales_commission_total,sales_barbershop_net,service_sales_total,product_sales_total,
      chair_rental_sales_total,chair_rental_adjustment_total,sale_count,active_sale_count,voided_sale_count,
      opening_balance,opening_source,opened_at,opened_by,close_mode,expected_cash,reconciliation_state,closed_at
    )
    select candidate.business_date,0,0,0,0,0,0,0,0,0,0,0,'first_income',candidate.opened_at,candidate.opened_by,null,0,'not_applicable',null
    from (
      select i.business_date,min(i.created_at) opened_at,min(i.registered_by::text)::uuid opened_by
      from public.incomes i where i.business_date < local_today group by i.business_date
      union all
      select a.business_date,min(a.created_at),min(a.created_by::text)::uuid
      from public.daily_cash_adjustments a where a.business_date < local_today group by a.business_date
    ) candidate on conflict(business_date) do nothing;
    for open_register in
      select id,business_date from public.daily_cash_registers
      where business_date < local_today and closed_at is null order by business_date for update
    loop
      perform public.snapshot_daily_cash(open_register.id,open_register.business_date);
      update public.daily_cash_registers set close_mode='automatic',reconciliation_state='pending_confirmation',counted_cash=null,difference_cash=null,closed_at=pg_catalog.clock_timestamp() where id=open_register.id;
      closed_count:=closed_count+1;
    end loop;
    return closed_count;
  end $$;

  create or replace function public.capture_post_close_cash_void()
  returns trigger language plpgsql security definer set search_path = '' as $$
  declare original_cash_id uuid; adjustment_id uuid; actor_record record; charged_service_total bigint:=0; charged_product_total bigint:=0; charged_rental_total bigint:=0; adjustment_date date := (new.voided_at at time zone 'America/Argentina/Buenos_Aires')::date;
  begin
    if not(old.status='active' and new.status='voided') or new.total=0 then return new; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bastardos_daily_cash_close'));
    select id into original_cash_id from public.daily_cash_registers where business_date=old.business_date and closed_at is not null;
    if original_cash_id is null then return new; end if;
    select first_name,last_name into actor_record from public.users where id=new.voided_by;
    if new.source_type='chair_rental' then
      charged_rental_total:=new.total;
    elsif new.source_type='fixed_subscription' then
      charged_service_total:=new.total;
    else
      select coalesce(sum(ii.charged_subtotal) filter(where ii.item_type='service'),0)::bigint,
        coalesce(sum(ii.charged_subtotal) filter(where ii.item_type='product'),0)::bigint
      into charged_service_total,charged_product_total
      from public.income_items ii where ii.income_id=new.id;
    end if;
    insert into public.daily_cash_adjustments(
      business_date,source_income_id,original_daily_cash_id,created_by,created_by_first_name_snapshot,created_by_last_name_snapshot,
      gross_delta,commission_delta,barbershop_net_delta,service_delta,product_delta,chair_rental_delta,created_at
    ) values(
      adjustment_date,new.id,original_cash_id,new.voided_by,actor_record.first_name,actor_record.last_name,
      -new.total::bigint,-new.commission_total::bigint,-new.barbershop_net::bigint,
      -charged_service_total,-charged_product_total,-charged_rental_total,new.voided_at
    ) on conflict(source_income_id) do nothing returning id into adjustment_id;
    if adjustment_id is not null then
      insert into public.daily_cash_adjustment_payments(adjustment_id,payment_method_id,method_name_snapshot,amount)
      select adjustment_id,ip.payment_method_id,ip.method_name_snapshot,-ip.amount from public.income_payments ip where ip.income_id=new.id;
    end if;
    return new;
  end $$;

  create or replace function public.cash_day_as_json(target_business_date date,target_cash_id uuid,is_live boolean)
  returns jsonb language plpgsql stable security definer set search_path = '' as $$
  declare result jsonb; rental_total bigint; service_total bigint; product_total bigint; normalized_sales jsonb;
  begin
    result:=public.cash_day_as_json_045_base(target_business_date,target_cash_id,is_live);
    if result is null then return null; end if;
    if is_live then
      select
        coalesce((select sum(case when i.source_type='fixed_subscription' then i.total when i.source_type='chair_rental' then 0 else item_totals.service end) from public.incomes i left join lateral(select coalesce(sum(ii.charged_subtotal) filter(where ii.item_type='service'),0)::bigint service from public.income_items ii where ii.income_id=i.id) item_totals on true where i.business_date=target_business_date and i.status='active'),0)
          + coalesce((select sum(a.service_delta) from public.daily_cash_adjustments a join public.incomes i on i.id=a.source_income_id where a.business_date=target_business_date and i.source_type <> 'chair_rental'),0),
        coalesce((select sum(case when i.source_type in('fixed_subscription','chair_rental') then 0 else item_totals.product end) from public.incomes i left join lateral(select coalesce(sum(ii.charged_subtotal) filter(where ii.item_type='product'),0)::bigint product from public.income_items ii where ii.income_id=i.id) item_totals on true where i.business_date=target_business_date and i.status='active'),0)
          + coalesce((select sum(a.product_delta) from public.daily_cash_adjustments a join public.incomes i on i.id=a.source_income_id where a.business_date=target_business_date and i.source_type <> 'chair_rental'),0),
        coalesce((select sum(i.total) from public.incomes i where i.business_date=target_business_date and i.status='active' and i.source_type='chair_rental'),0)
          + coalesce((select sum(a.chair_rental_delta) from public.daily_cash_adjustments a join public.incomes i on i.id=a.source_income_id where a.business_date=target_business_date and i.source_type='chair_rental'),0)
      into service_total,product_total,rental_total;
    else
      select r.service_sales_total+r.service_adjustment_total,
        r.product_sales_total+r.product_adjustment_total,
        r.chair_rental_sales_total+r.chair_rental_adjustment_total
      into service_total,product_total,rental_total
      from public.daily_cash_registers r where r.id=target_cash_id;
    end if;
    result:=jsonb_set(result,'{summary,serviceTotal}',to_jsonb(service_total),true);
    result:=jsonb_set(result,'{summary,productTotal}',to_jsonb(product_total),true);
    result:=jsonb_set(result,'{summary,chairRentalTotal}',to_jsonb(rental_total),true);
    select coalesce(jsonb_agg(case when i.source_type='chair_rental' then jsonb_set(s.item,'{kind}',to_jsonb('chair_rental'::text)) when i.source_type='fixed_subscription' then jsonb_set(s.item,'{kind}',to_jsonb('subscription'::text)) else s.item end order by s.ordinality),'[]'::jsonb)
    into normalized_sales
    from jsonb_array_elements(coalesce(result->'sales','[]'::jsonb)) with ordinality s(item,ordinality)
    left join public.incomes i on i.id=(s.item->>'id')::uuid;
    return jsonb_set(result,'{sales}',normalized_sales,true);
  end $$;

  create or replace function public.list_daily_cash(requesting_user_id uuid,filter_date_from date,filter_date_to date,page_number integer,page_size integer)
  returns jsonb language plpgsql security definer set search_path = '' as $$
  declare safe_page integer:=greatest(coalesce(page_number,1),1); safe_page_size integer:=least(greatest(coalesce(page_size,12),1),100); total_count integer; result jsonb;
  begin
    if not exists(select 1 from public.users where id=requesting_user_id and role_id in(1,2) and is_active and deleted_at is null) then raise exception using errcode='42501',message='MANAGER_REQUIRED'; end if;
    if filter_date_from is not null and filter_date_to is not null and filter_date_from>filter_date_to then raise exception using errcode='22023',message='INVALID_CASH_DATE_RANGE'; end if;
    perform public.close_pending_daily_cash();
    select count(*)::integer into total_count from public.daily_cash_registers cash where cash.closed_at is not null and (filter_date_from is null or cash.business_date>=filter_date_from) and (filter_date_to is null or cash.business_date<=filter_date_to);
    select jsonb_build_object(
      'items',coalesce(jsonb_agg(jsonb_build_object(
        'id',page.id,'businessDate',page.business_date,'state','closed','closedAt',page.closed_at,
        'lifecycle',jsonb_build_object('openingBalance',coalesce(page.opening_balance,0),'openingSource',page.opening_source,'openedAt',page.opened_at,'openedBy',case when opener.id is null then null else jsonb_build_object('id',opener.id,'firstName',opener.first_name,'lastName',opener.last_name) end,'expectedCash',page.expected_cash,'countedCash',page.counted_cash,'difference',page.difference_cash,'closeMode',page.close_mode,'reconciliationState',page.reconciliation_state),
        'summary',jsonb_build_object('salesGrossTotal',page.sales_gross_total,'salesCommissionTotal',page.sales_commission_total,'salesBarbershopNet',page.sales_barbershop_net,'adjustmentGrossTotal',page.adjustment_gross_total,'adjustmentCommissionTotal',page.adjustment_commission_total,'adjustmentBarbershopNet',page.adjustment_barbershop_net,'grossTotal',page.sales_gross_total+page.adjustment_gross_total,'commissionTotal',page.sales_commission_total+page.adjustment_commission_total,'barbershopNet',page.sales_barbershop_net+page.adjustment_barbershop_net,'serviceTotal',page.service_sales_total+page.service_adjustment_total,'productTotal',page.product_sales_total+page.product_adjustment_total,'chairRentalTotal',page.chair_rental_sales_total+page.chair_rental_adjustment_total,'saleCount',page.sale_count,'activeSaleCount',page.active_sale_count,'voidedSaleCount',page.voided_sale_count,'adjustmentCount',page.adjustment_count)
      ) order by page.business_date desc),'[]'::jsonb),
      'pagination',jsonb_build_object('page',safe_page,'pageSize',safe_page_size,'total',total_count,'totalPages',case when total_count=0 then 0 else ceiling(total_count::numeric/safe_page_size)::integer end)
    ) into result
    from (select cash.* from public.daily_cash_registers cash where cash.closed_at is not null and (filter_date_from is null or cash.business_date>=filter_date_from) and (filter_date_to is null or cash.business_date<=filter_date_to) order by cash.business_date desc limit safe_page_size offset(safe_page-1)*safe_page_size) page
    left join public.users opener on opener.id=page.opened_by;
    return result;
  end $$;

 revoke all on table public.chair_rental_obligations from public,anon,authenticated;
 grant select on table public.chair_rental_obligations to service_role;
   revoke execute on function public.seed_chair_rental_obligations(uuid,bigint,text,smallint,uuid) from public,anon,authenticated;
  grant execute on function public.seed_chair_rental_obligations(uuid,bigint,text,smallint,uuid) to service_role;

  revoke all on table public.employee_commercial_agreement_audit,public.chair_rental_payment_attempts from public,anon,authenticated;
  -- Link both sides after the two rows exist.  The deferred constraint trigger
  -- prevents an attempt from pointing at a different income (or vice versa).
  do $$ begin
    if exists(select 1 from public.chair_rental_payment_attempts where income_id is null) then
      raise exception using errcode='23502',message='CHAIR_RENTAL_ATTEMPT_INCOME_REQUIRED';
    end if;
    if exists(select 1 from public.chair_rental_payment_attempts where request_fingerprint is null) then
      raise exception using errcode='23502',message='CHAIR_RENTAL_REQUEST_FINGERPRINT_REQUIRED';
    end if;
  end $$;
   alter table public.chair_rental_payment_attempts
     alter column income_id set not null,
     alter column request_fingerprint set not null;
   alter table public.chair_rental_payment_attempts
     drop constraint if exists chair_rental_payment_attempts_income_id_fkey,
     drop constraint if exists chair_rental_attempt_income_fk;
   alter table public.chair_rental_payment_attempts
     add constraint chair_rental_attempt_income_fk
       foreign key (income_id) references public.incomes(id) on delete restrict
       deferrable initially deferred;
   do $$ begin
    if not exists(select 1 from pg_constraint where conname='chair_rental_attempt_income_unique') then
      alter table public.chair_rental_payment_attempts add constraint chair_rental_attempt_income_unique unique(income_id);
    end if;
    if not exists(select 1 from pg_constraint where conname='income_chair_rental_attempt_unique') then
      alter table public.incomes add constraint income_chair_rental_attempt_unique unique(chair_rental_attempt_id);
    end if;
  end $$;
   alter table public.incomes drop constraint if exists income_chair_rental_attempt_fk;
  alter table public.incomes add constraint income_chair_rental_attempt_fk
    foreign key (chair_rental_attempt_id) references public.chair_rental_payment_attempts(id) deferrable initially deferred;
   create or replace function public.validate_chair_rental_attempt_link()
   returns trigger language plpgsql security definer set search_path = '' as $$
   declare linked_income record; payment_count integer;
   begin
     if new.income_id is null then
       raise exception using errcode = '23514', message = 'chair_rental_attempt_income_required';
     end if;
     select i.* into linked_income from public.incomes i where i.id = new.income_id;
     if not found or linked_income.source_type <> 'chair_rental'
       or linked_income.chair_rental_attempt_id is distinct from new.id
       or linked_income.employee_id is distinct from new.employee_id
       or linked_income.chair_rental_period is distinct from new.period
       or linked_income.request_id is distinct from new.request_id
       or linked_income.request_fingerprint is distinct from new.request_fingerprint
       or linked_income.total is distinct from new.amount
       or linked_income.chair_rental_paid_at is distinct from new.paid_at
       or (new.status = 'active' and linked_income.status <> 'active')
       or (new.status = 'voided' and linked_income.status <> 'voided')
     then
       raise exception using errcode = '23514', message = 'chair_rental_attempt_income_link_invalid';
     end if;
     select count(*)::integer into payment_count
     from public.income_payments ip where ip.income_id = new.income_id;
     if payment_count <> 1 or not exists (
       select 1 from public.income_payments ip
       where ip.income_id = new.income_id
         and ip.payment_method_id = new.payment_method_id
         and ip.method_name_snapshot = new.method_name_snapshot
         and ip.amount = new.amount
     ) then
       raise exception using errcode = '23514', message = 'chair_rental_attempt_payment_link_invalid';
     end if;
     if new.status = 'voided' and (
       linked_income.voided_by is distinct from new.voided_by
       or linked_income.voided_at is distinct from new.voided_at
     ) then
       raise exception using errcode = '23514', message = 'chair_rental_attempt_void_link_invalid';
     end if;
     return new;
   end $$;
 drop trigger if exists chair_rental_attempt_link_check on public.chair_rental_payment_attempts;
 create constraint trigger chair_rental_attempt_link_check after insert or update on public.chair_rental_payment_attempts
   deferrable initially deferred for each row execute function public.validate_chair_rental_attempt_link();
   create or replace function public.prevent_chair_rental_income_item()
   returns trigger language plpgsql security definer set search_path = '' as $$ begin
     if exists(select 1 from public.incomes i where i.id = new.income_id and i.source_type = 'chair_rental') then
       raise exception using errcode = '23514', message = 'chair_rental_income_items_forbidden';
     end if;
     return new;
   end $$;
   drop trigger if exists chair_rental_income_item_check on public.income_items;
   create trigger chair_rental_income_item_check before insert or update of income_id on public.income_items
     for each row execute function public.prevent_chair_rental_income_item();

   create or replace function public.validate_chair_rental_income_link()
   returns trigger language plpgsql security definer set search_path = '' as $$
   declare linked_attempt record;
   begin
     if new.source_type = 'chair_rental' and new.chair_rental_attempt_id is null then
       raise exception using errcode = '23514', message = 'chair_rental_income_attempt_required';
     end if;
     if new.source_type = 'chair_rental' and exists(
       select 1 from public.income_items ii where ii.income_id = new.id
     ) then
       raise exception using errcode = '23514', message = 'chair_rental_income_items_forbidden';
     end if;
     if new.chair_rental_attempt_id is not null then
       select a.* into linked_attempt
       from public.chair_rental_payment_attempts a
       where a.id = new.chair_rental_attempt_id;
       if not found or linked_attempt.income_id is distinct from new.id
         or new.source_type <> 'chair_rental'
         or linked_attempt.employee_id is distinct from new.employee_id
         or linked_attempt.period is distinct from new.chair_rental_period
         or linked_attempt.request_id is distinct from new.request_id
         or linked_attempt.request_fingerprint is distinct from new.request_fingerprint
         or linked_attempt.amount is distinct from new.total
         or linked_attempt.paid_at is distinct from new.chair_rental_paid_at
         or (new.status = 'active' and linked_attempt.status <> 'active')
         or (new.status = 'voided' and linked_attempt.status <> 'voided')
       then
         raise exception using errcode = '23514', message = 'chair_rental_income_attempt_link_invalid';
       end if;
     end if;
     return new;
   end $$;
 drop trigger if exists chair_rental_income_link_check on public.incomes;
 create constraint trigger chair_rental_income_link_check after insert or update on public.incomes
   deferrable initially deferred for each row execute function public.validate_chair_rental_income_link();

  alter table public.chair_rental_payment_attempts drop constraint if exists chair_rental_attempt_metadata_check;
  alter table public.chair_rental_payment_attempts add constraint chair_rental_attempt_metadata_check check (
    length(trim(request_fingerprint)) > 0
    and length(trim(method_name_snapshot)) between 1 and 80
    and ((status = 'active' and paid_at is not null and voided_at is null and voided_by is null and void_reason is null)
    or (status = 'voided' and paid_at is not null and voided_at is not null and voided_by is not null and length(trim(void_reason)) > 0)
    )
  );

 revoke all on table public.employee_commercial_agreement_audit,public.chair_rental_payment_attempts,public.chair_rental_obligations from public,anon,authenticated;
grant select on table public.employee_commercial_agreement_audit,public.chair_rental_payment_attempts to service_role;
revoke execute on function public.get_employee_commercial_agreement(uuid,uuid),public.list_chair_rental_payments(uuid,text,text,integer,integer),public.get_chair_rental_detail(uuid,uuid),public.update_employee_commercial_agreement(uuid,uuid,jsonb),public.confirm_chair_rental_payment(uuid,uuid,text,uuid,uuid),public.void_chair_rental_payment(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_employee_commercial_agreement(uuid,uuid),public.list_chair_rental_payments(uuid,text,text,integer,integer),public.get_chair_rental_detail(uuid,uuid),public.update_employee_commercial_agreement(uuid,uuid,jsonb),public.confirm_chair_rental_payment(uuid,uuid,text,uuid,uuid),public.void_chair_rental_payment(uuid,uuid,text) to service_role;
 revoke execute on function public.chair_rental_payment_as_json(uuid) from public,anon,authenticated;
 grant execute on function public.chair_rental_payment_as_json(uuid) to service_role;
 revoke execute on function public.chair_rental_month_summary(text) from public,anon,authenticated;
 grant execute on function public.chair_rental_month_summary(text) to service_role;
revoke execute on function public.income_as_employee_json(uuid),public.income_as_json(uuid) from public,anon,authenticated;
grant execute on function public.income_as_employee_json(uuid),public.income_as_json(uuid) to service_role;
 revoke execute on function public.get_business_report(uuid,text),public.get_expense_month_summary(uuid,text) from public,anon,authenticated;
   grant execute on function public.get_business_report(uuid,text),public.get_expense_month_summary(uuid,text) to service_role;
 revoke execute on function public.cash_day_as_json(date,uuid,boolean) from public,anon,authenticated;
 grant execute on function public.cash_day_as_json(date,uuid,boolean) to service_role;
  revoke execute on function public.void_income(uuid,uuid) from public,anon,authenticated;
 grant execute on function public.void_income(uuid,uuid) to service_role;
 revoke execute on function public.void_income_045_base(uuid,uuid) from public,anon,authenticated,service_role;
  revoke execute on function public.update_user_profile(uuid,boolean,text,boolean,text,boolean,smallint,boolean,boolean,boolean,smallint,boolean,smallint) from public,anon,authenticated,service_role;
 revoke execute on function public.update_user_profile(uuid,uuid,boolean,text,boolean,text,boolean,smallint,boolean,boolean,boolean,smallint,boolean,smallint) from public,anon,authenticated;
 grant execute on function public.update_user_profile(uuid,uuid,boolean,text,boolean,text,boolean,smallint,boolean,boolean,boolean,smallint,boolean,smallint) to service_role;
    revoke execute on function public.prevent_employee_agreement_audit_mutation(),public.audit_employee_commercial_agreement(),public.reset_employee_agreement_on_role_change(),public.normalize_employee_agreement_on_insert(),public.prevent_non_owner_chair_rental_void(),public.prevent_chair_rental_income_item(),public.validate_chair_rental_attempt_link(),public.validate_chair_rental_income_link(),public.attach_income_work_session() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
