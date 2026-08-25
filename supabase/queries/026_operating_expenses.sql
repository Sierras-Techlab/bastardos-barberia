begin;

create table public.expense_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  type text not null check (type in ('fixed','variable','supplies')),
  is_active boolean not null default true,
  created_by uuid not null references public.users(id),
  updated_by uuid not null references public.users(id),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (char_length(name) between 1 and 80),
  check (char_length(normalized_name) between 1 and 80)
);

create table public.expenses (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid not null references public.users(id),
  request_id uuid not null,
  semantic_fingerprint text not null,
  accounting_date date not null,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  category_name_snapshot text not null,
  category_type_snapshot text not null check (category_type_snapshot in ('fixed','variable','supplies')),
  amount bigint not null check (amount > 0),
  concept text not null check (char_length(concept) between 1 and 200),
  notes text check (notes is null or char_length(notes) between 1 and 1000),
  payment_method_id uuid references public.payment_methods(id) on delete restrict,
  payment_method_name_snapshot text,
  status text not null default 'active' check (status in ('active','voided')),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_by uuid not null references public.users(id),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  voided_by uuid references public.users(id),
  voided_at timestamptz,
  void_reason text,
  unique(actor_id, request_id),
  check ((status='active' and voided_by is null and voided_at is null and void_reason is null) or
         (status='voided' and voided_by is not null and voided_at is not null and char_length(void_reason) between 3 and 500)),
  check ((payment_method_id is null and payment_method_name_snapshot is null) or payment_method_name_snapshot is not null)
);

create table public.expense_revisions (
  id uuid primary key default extensions.gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  changed_by uuid not null references public.users(id),
  changed_at timestamptz not null default pg_catalog.clock_timestamp(),
  reason text not null check (char_length(reason) between 3 and 500),
  previous_snapshot jsonb not null,
  next_snapshot jsonb not null,
  unique(expense_id, revision_number)
);

create index expenses_accounting_date_idx on public.expenses(accounting_date desc, created_at desc);
create index expenses_category_idx on public.expenses(category_id, accounting_date desc);
create index expenses_payment_method_idx on public.expenses(payment_method_id, accounting_date desc) where payment_method_id is not null;
create index expense_revisions_expense_idx on public.expense_revisions(expense_id, revision_number);

alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_revisions enable row level security;
revoke all on table public.expense_categories, public.expenses, public.expense_revisions from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.expense_categories to service_role;
grant select, insert, update on table public.expenses to service_role;
grant select, insert on table public.expense_revisions to service_role;

create function public.assert_expense_manager(actor_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists (select 1 from public.users where id=actor_user_id and role_id in (1,2) and is_active and deleted_at is null) then
    raise exception using errcode='42501', message='MANAGER_REQUIRED';
  end if;
end $$;

create function public.expense_as_json(e public.expenses) returns jsonb
language sql stable security definer set search_path='' as $$ select jsonb_build_object(
  'id',e.id,'requestId',e.request_id,'accountingDate',e.accounting_date,'categoryId',e.category_id,
  'categoryName',e.category_name_snapshot,'categoryType',e.category_type_snapshot,'amount',e.amount,
  'concept',e.concept,'notes',e.notes,'paymentMethodId',e.payment_method_id,'paymentMethodName',e.payment_method_name_snapshot,
  'status',e.status,'createdBy',e.created_by,'createdAt',e.created_at,'updatedBy',e.updated_by,'updatedAt',e.updated_at,
  'voidedBy',e.voided_by,'voidedAt',e.voided_at,'voidReason',e.void_reason) $$;

create function public.expense_category_as_json(c public.expense_categories) returns jsonb
language sql stable security definer set search_path='' as $$ select jsonb_build_object(
  'id',c.id,'name',c.name,'type',c.type,'isActive',c.is_active,'createdAt',c.created_at,'updatedAt',c.updated_at) $$;

create function public.list_expense_categories(actor_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
  perform public.assert_expense_manager(actor_user_id);
  return (select coalesce(jsonb_agg(public.expense_category_as_json(c) order by c.is_active desc,c.name),'[]') from public.expense_categories c);
end $$;

create function public.create_expense_category(actor_user_id uuid, category_name text, category_type text) returns jsonb
language plpgsql security definer set search_path='' as $$ declare c public.expense_categories; n text;
begin
  perform public.assert_expense_manager(actor_user_id); n:=public.normalize_catalog_name(trim(category_name));
  if n='' or char_length(trim(category_name))>80 or category_type not in ('fixed','variable','supplies') then raise exception using errcode='22023',message='EXPENSE_CATEGORY_INVALID'; end if;
  if exists(select 1 from public.expense_categories where normalized_name=n) then raise exception using errcode='23505',message='EXPENSE_CATEGORY_DUPLICATE'; end if;
  insert into public.expense_categories(name,normalized_name,type,created_by,updated_by) values(trim(category_name),n,category_type,actor_user_id,actor_user_id) returning * into c;
  return public.expense_category_as_json(c);
exception when unique_violation then
  raise exception using errcode='23505',message='EXPENSE_CATEGORY_DUPLICATE';
end $$;

create function public.update_expense_category(actor_user_id uuid,target_category_id uuid,category_name text,category_type text,category_is_active boolean) returns jsonb
language plpgsql security definer set search_path='' as $$ declare c public.expense_categories; n text;
begin
  perform public.assert_expense_manager(actor_user_id); select * into c from public.expense_categories where id=target_category_id for update;
  if not found then raise exception using errcode='P0002',message='EXPENSE_CATEGORY_NOT_FOUND'; end if;
  if category_name is not null then n:=public.normalize_catalog_name(trim(category_name)); if n='' or char_length(trim(category_name))>80 then raise exception using errcode='22023',message='EXPENSE_CATEGORY_INVALID'; end if;
    if exists(select 1 from public.expense_categories where normalized_name=n and id<>target_category_id) then raise exception using errcode='23505',message='EXPENSE_CATEGORY_DUPLICATE'; end if; end if;
  if category_type is not null and category_type not in ('fixed','variable','supplies') then raise exception using errcode='22023',message='EXPENSE_CATEGORY_INVALID'; end if;
  update public.expense_categories set name=coalesce(trim(category_name),name),normalized_name=coalesce(n,normalized_name),type=coalesce(category_type,type),is_active=coalesce(category_is_active,is_active),updated_by=actor_user_id,updated_at=pg_catalog.clock_timestamp() where id=target_category_id returning * into c;
  return public.expense_category_as_json(c);
exception when unique_violation then
  raise exception using errcode='23505',message='EXPENSE_CATEGORY_DUPLICATE';
end $$;

create function public.delete_expense_category(actor_user_id uuid,target_category_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$ begin
  perform public.assert_expense_manager(actor_user_id); perform 1 from public.expense_categories where id=target_category_id for update;
  if not found then raise exception using errcode='P0002',message='EXPENSE_CATEGORY_NOT_FOUND'; end if;
  if exists(select 1 from public.expenses where category_id=target_category_id) then raise exception using errcode='23503',message='EXPENSE_CATEGORY_IN_USE'; end if;
  delete from public.expense_categories where id=target_category_id; return target_category_id;
end $$;

create function public.create_expense(actor_user_id uuid,request_id uuid,expense_accounting_date date,expense_category_id uuid,expense_amount bigint,expense_concept text,expense_notes text default null,expense_payment_method_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$ declare e public.expenses; c public.expense_categories; pm public.payment_methods; fp text;
begin
  perform public.assert_expense_manager(actor_user_id);
  expense_notes:=nullif(trim(expense_notes),'');
  if expense_amount<=0 or char_length(trim(expense_concept)) not between 1 and 200 or expense_notes is not null and char_length(expense_notes)>1000 then raise exception using errcode='22023',message='EXPENSE_INVALID'; end if;
  fp:=encode(extensions.digest(jsonb_build_object('accountingDate',expense_accounting_date,'categoryId',expense_category_id,'amount',expense_amount,'concept',trim(expense_concept),'notes',expense_notes,'paymentMethodId',expense_payment_method_id)::text,'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('expense-request:'||actor_user_id::text||':'||request_id::text,0)
  );
  select * into e from public.expenses where actor_id=actor_user_id and expenses.request_id=create_expense.request_id for update;
  if found then if e.semantic_fingerprint<>fp then raise exception using errcode='23505',message='EXPENSE_REQUEST_CONFLICT'; end if; return public.expense_as_json(e); end if;
  if expense_accounting_date > (pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception using errcode='22023',message='EXPENSE_DATE_FUTURE'; end if;
  select * into c from public.expense_categories where id=expense_category_id for share;
  if not found then raise exception using errcode='P0002',message='EXPENSE_CATEGORY_NOT_FOUND'; end if; if not c.is_active then raise exception using errcode='22023',message='EXPENSE_CATEGORY_INACTIVE'; end if;
  if expense_payment_method_id is not null then select * into pm from public.payment_methods where id=expense_payment_method_id and is_active for share; if not found then raise exception using errcode='22023',message='PAYMENT_METHOD_INVALID'; end if; end if;
  insert into public.expenses(actor_id,request_id,semantic_fingerprint,accounting_date,category_id,category_name_snapshot,category_type_snapshot,amount,concept,notes,payment_method_id,payment_method_name_snapshot,created_by,updated_by)
  values(actor_user_id,request_id,fp,expense_accounting_date,c.id,c.name,c.type,expense_amount,trim(expense_concept),expense_notes,expense_payment_method_id,case when expense_payment_method_id is null then null else pm.name end,actor_user_id,actor_user_id) returning * into e;
  return public.expense_as_json(e);
end $$;

create function public.update_expense(actor_user_id uuid,target_expense_id uuid,expected_updated_at timestamptz,change_reason text,expense_accounting_date date default null,expense_category_id uuid default null,expense_amount bigint default null,expense_concept text default null,expense_notes text default null,notes_supplied boolean default false,expense_payment_method_id uuid default null,payment_method_supplied boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$ declare old_e public.expenses; e public.expenses; c public.expense_categories; pm public.payment_methods; old_json jsonb; rev integer;
begin
  perform public.assert_expense_manager(actor_user_id); select * into old_e from public.expenses where id=target_expense_id for update;
  if not found then raise exception using errcode='P0002',message='EXPENSE_NOT_FOUND'; end if; if old_e.status<>'active' then raise exception using errcode='22023',message='EXPENSE_NOT_ACTIVE'; end if;
  if old_e.updated_at<>expected_updated_at then raise exception using errcode='40001',message='EXPENSE_CONFLICT'; end if; if char_length(trim(change_reason)) not between 3 and 500 then raise exception using errcode='22023',message='EXPENSE_INVALID'; end if;
  if coalesce(expense_accounting_date,old_e.accounting_date)>(pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception using errcode='22023',message='EXPENSE_DATE_FUTURE'; end if;
  if expense_category_id is not null then select * into c from public.expense_categories where id=expense_category_id and is_active for share; if not found then raise exception using errcode='22023',message='EXPENSE_CATEGORY_INACTIVE'; end if; end if;
  if payment_method_supplied and expense_payment_method_id is not null then select * into pm from public.payment_methods where id=expense_payment_method_id and is_active for share; if not found then raise exception using errcode='22023',message='PAYMENT_METHOD_INVALID'; end if; end if;
  expense_notes:=nullif(trim(expense_notes),'');
  if expense_amount is not null and expense_amount<=0 or expense_concept is not null and char_length(trim(expense_concept)) not between 1 and 200 or notes_supplied and expense_notes is not null and char_length(expense_notes)>1000 then raise exception using errcode='22023',message='EXPENSE_INVALID'; end if;
  old_json:=public.expense_as_json(old_e);
  update public.expenses set accounting_date=coalesce(expense_accounting_date,accounting_date),category_id=coalesce(expense_category_id,category_id),category_name_snapshot=case when expense_category_id is null then category_name_snapshot else c.name end,category_type_snapshot=case when expense_category_id is null then category_type_snapshot else c.type end,amount=coalesce(expense_amount,amount),concept=coalesce(trim(expense_concept),concept),notes=case when notes_supplied then expense_notes else notes end,payment_method_id=case when payment_method_supplied then expense_payment_method_id else payment_method_id end,payment_method_name_snapshot=case when not payment_method_supplied then payment_method_name_snapshot when expense_payment_method_id is null then null else pm.name end,updated_by=actor_user_id,updated_at=pg_catalog.clock_timestamp() where id=target_expense_id returning * into e;
  select coalesce(max(revision_number),0)+1 into rev from public.expense_revisions where expense_id=target_expense_id;
  insert into public.expense_revisions(expense_id,revision_number,changed_by,reason,previous_snapshot,next_snapshot) values(target_expense_id,rev,actor_user_id,trim(change_reason),old_json,public.expense_as_json(e)); return public.expense_as_json(e);
end $$;

create function public.void_expense(actor_user_id uuid,target_expense_id uuid,expected_updated_at timestamptz,void_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$ declare old_e public.expenses; e public.expenses; rev integer;
begin perform public.assert_expense_manager(actor_user_id); select * into old_e from public.expenses where id=target_expense_id for update;
  if not found then raise exception using errcode='P0002',message='EXPENSE_NOT_FOUND'; end if;
  if old_e.updated_at<>expected_updated_at then raise exception using errcode='40001',message='EXPENSE_CONFLICT'; end if;
  if old_e.status<>'active' then raise exception using errcode='22023',message='EXPENSE_NOT_ACTIVE'; end if; if char_length(trim($4)) not between 3 and 500 then raise exception using errcode='22023',message='EXPENSE_INVALID'; end if;
  update public.expenses set status='voided',voided_by=actor_user_id,voided_at=pg_catalog.clock_timestamp(),void_reason=trim($4),updated_by=actor_user_id,updated_at=pg_catalog.clock_timestamp() where id=target_expense_id returning * into e;
  select coalesce(max(revision_number),0)+1 into rev from public.expense_revisions where expense_id=target_expense_id;
  insert into public.expense_revisions(expense_id,revision_number,changed_by,reason,previous_snapshot,next_snapshot) values(target_expense_id,rev,actor_user_id,trim($4),public.expense_as_json(old_e),public.expense_as_json(e)); return public.expense_as_json(e); end $$;

create function public.get_expense(actor_user_id uuid,target_expense_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare e public.expenses;
begin perform public.assert_expense_manager(actor_user_id); select * into e from public.expenses where id=target_expense_id; if not found then return null; end if;
 return jsonb_build_object('expense',public.expense_as_json(e),'revisions',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'expenseId',r.expense_id,'revisionNumber',r.revision_number,'changedBy',r.changed_by,'changedAt',r.changed_at,'reason',r.reason,'previous',r.previous_snapshot,'next',r.next_snapshot) order by r.revision_number desc),'[]') from public.expense_revisions r where r.expense_id=e.id)); end $$;

create function public.list_expenses(actor_user_id uuid,filter_month text default null,filter_date_from date default null,filter_date_to date default null,filter_category_id uuid default null,filter_category_type text default null,filter_payment_method_id uuid default null,filter_status text default null,filter_text text default null,page_number integer default 1,page_size integer default 20) returns jsonb
language plpgsql security definer set search_path='' as $$ declare result jsonb; month_start date; month_end date;
begin perform public.assert_expense_manager(actor_user_id); if page_number<1 or page_size not between 1 and 100 then raise exception using errcode='22023',message='EXPENSE_FILTER_INVALID'; end if;
 if filter_month is not null then begin month_start:=to_date(filter_month||'-01','YYYY-MM-DD'); exception when others then raise exception using errcode='22023',message='EXPENSE_FILTER_INVALID'; end; if to_char(month_start,'YYYY-MM')<>filter_month then raise exception using errcode='22023',message='EXPENSE_FILTER_INVALID'; end if; month_end:=(month_start+interval '1 month')::date; end if;
 with filtered as (select e.* from public.expenses e where (filter_month is null or e.accounting_date>=month_start and e.accounting_date<month_end) and (filter_date_from is null or e.accounting_date>=filter_date_from) and (filter_date_to is null or e.accounting_date<=filter_date_to) and (filter_category_id is null or e.category_id=filter_category_id) and (filter_category_type is null or e.category_type_snapshot=filter_category_type) and (filter_payment_method_id is null or e.payment_method_id=filter_payment_method_id) and (filter_status is null or e.status=filter_status) and (nullif(trim(filter_text),'') is null or public.normalize_catalog_name(e.concept||' '||coalesce(e.notes,'')||' '||e.category_name_snapshot||' '||coalesce(e.payment_method_name_snapshot,'')) like '%'||public.normalize_catalog_name(filter_text)||'%')),
 totals as (select count(*)::integer total,coalesce(sum(amount) filter(where status='active'),0)::bigint amount,count(*) filter(where status='active')::integer active_count,coalesce(sum(amount) filter(where status='active' and category_type_snapshot='fixed'),0)::bigint fixed,coalesce(sum(amount) filter(where status='active' and category_type_snapshot='variable'),0)::bigint variable,coalesce(sum(amount) filter(where status='active' and category_type_snapshot='supplies'),0)::bigint supplies from filtered),
 items as (select coalesce(jsonb_agg(public.expense_as_json(x) order by x.accounting_date desc,x.created_at desc),'[]') value from (select * from filtered order by accounting_date desc,created_at desc offset (page_number-1)*page_size limit page_size)x)
 select jsonb_build_object('items',items.value,'metrics',jsonb_build_object('total',totals.amount,'count',totals.active_count,'fixedTotal',totals.fixed,'variableTotal',totals.variable,'suppliesTotal',totals.supplies),'page',page_number,'pageSize',page_size,'total',totals.total,'totalPages',case when totals.total=0 then 0 else ceil(totals.total::numeric/page_size)::integer end) into result from totals,items; return result; end $$;

create function public.get_expense_month_summary(actor_user_id uuid,target_month text) returns jsonb
language plpgsql security definer set search_path='' as $$ declare d date; d2 date; gross bigint; commission bigint; net bigint; total_exp bigint; fixed bigint; variable bigint; supplies bigint;
begin perform public.assert_expense_manager(actor_user_id); begin d:=to_date(target_month||'-01','YYYY-MM-DD'); exception when others then raise exception using errcode='22023',message='EXPENSE_FILTER_INVALID'; end; if to_char(d,'YYYY-MM')<>target_month then raise exception using errcode='22023',message='EXPENSE_FILTER_INVALID'; end if; d2:=(d+interval '1 month')::date;
 select coalesce(sum(total),0),coalesce(sum(commission_total),0),coalesce(sum(barbershop_net),0) into gross,commission,net from public.incomes where status='active' and business_date>=d and business_date<d2;
 select coalesce(sum(amount),0),coalesce(sum(amount) filter(where category_type_snapshot='fixed'),0),coalesce(sum(amount) filter(where category_type_snapshot='variable'),0),coalesce(sum(amount) filter(where category_type_snapshot='supplies'),0) into total_exp,fixed,variable,supplies from public.expenses where status='active' and accounting_date>=d and accounting_date<d2;
 return jsonb_build_object('month',target_month,'grossIncome',gross,'commission',commission,'barbershopNet',net,'expenses',total_exp,'operatingResult',net-total_exp,'fixedTotal',fixed,'variableTotal',variable,'suppliesTotal',supplies); end $$;

-- Expense references and immutable method snapshots block physical deletion once used.
create or replace function public.delete_payment_method(actor_user_id uuid,target_payment_method_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$ declare current_record record;
begin
 if not exists(select 1 from public.users where id=actor_user_id and role_id in(1,2) and is_active and deleted_at is null) then raise exception using errcode='42501',message='MANAGER_REQUIRED'; end if;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('bastardos_payment_method_lifecycle',0)
 );
 select * into current_record from public.payment_methods where id=target_payment_method_id for update; if not found then return null; end if;
 if current_record.system_code='cash' then raise exception using errcode='22023',message='CASH_PAYMENT_METHOD_PROTECTED'; end if;
 if exists(select 1 from public.income_payments where payment_method_id=target_payment_method_id) or exists(select 1 from public.expenses where payment_method_id=target_payment_method_id) then raise exception using errcode='23503',message='PAYMENT_METHOD_IN_USE'; end if;
 if current_record.is_active and not exists(select 1 from public.payment_methods where id<>target_payment_method_id and is_active) then raise exception using errcode='22023',message='LAST_ACTIVE_PAYMENT_METHOD'; end if;
 delete from public.payment_methods where id=target_payment_method_id; return target_payment_method_id; end $$;

revoke execute on function public.assert_expense_manager(uuid),public.expense_as_json(public.expenses),public.expense_category_as_json(public.expense_categories),public.list_expense_categories(uuid),public.create_expense_category(uuid,text,text),public.update_expense_category(uuid,uuid,text,text,boolean),public.delete_expense_category(uuid,uuid),public.create_expense(uuid,uuid,date,uuid,bigint,text,text,uuid),public.update_expense(uuid,uuid,timestamptz,text,date,uuid,bigint,text,text,boolean,uuid,boolean),public.void_expense(uuid,uuid,timestamptz,text),public.get_expense(uuid,uuid),public.list_expenses(uuid,text,date,date,uuid,text,uuid,text,text,integer,integer),public.get_expense_month_summary(uuid,text) from public,anon,authenticated;
grant execute on function public.list_expense_categories(uuid),public.create_expense_category(uuid,text,text),public.update_expense_category(uuid,uuid,text,text,boolean),public.delete_expense_category(uuid,uuid),public.create_expense(uuid,uuid,date,uuid,bigint,text,text,uuid),public.update_expense(uuid,uuid,timestamptz,text,date,uuid,bigint,text,text,boolean,uuid,boolean),public.void_expense(uuid,uuid,timestamptz,text),public.get_expense(uuid,uuid),public.list_expenses(uuid,text,date,date,uuid,text,uuid,text,text,integer,integer),public.get_expense_month_summary(uuid,text) to service_role;

commit;
