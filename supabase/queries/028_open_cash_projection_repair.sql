begin;

-- The 018 live projection used null as a sentinel because Caja was read-only.
-- Manual opening needs the persisted register ID to distinguish an open day.
create or replace function public.cash_day_as_json(target_business_date date,target_cash_id uuid,is_live boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare base jsonb; register_record record; expected_value bigint; opened_by_json jsonb;
begin
  base:=public.cash_day_base_as_json(target_business_date,target_cash_id,is_live);
  if is_live and target_cash_id is not null then
    base:=jsonb_set(base,'{id}',to_jsonb(target_cash_id),true);
  end if;
  select * into register_record from public.daily_cash_registers
  where id=target_cash_id or (target_cash_id is null and business_date=target_business_date) limit 1;
  if register_record.id is null then
    return base || jsonb_build_object('lifecycle',jsonb_build_object(
      'openingBalance',0,'openingSource',null,'openedAt',null,'openedBy',null,
      'expectedCash',0,'countedCash',null,'difference',null,'closeMode',null,'reconciliationState','not_applicable'));
  end if;
  if is_live then
    select register_record.opening_balance + coalesce(sum(ip.amount),0) into expected_value
    from public.income_payments ip join public.incomes i on i.id=ip.income_id
    join public.payment_methods pm on pm.id=ip.payment_method_id and pm.system_code='cash'
    where i.business_date=target_business_date and i.status='active';
  else expected_value:=register_record.expected_cash; end if;
  select case when u.id is null then null else jsonb_build_object('id',u.id,'firstName',u.first_name,'lastName',u.last_name) end
  into opened_by_json from (select 1) seed left join public.users u on u.id=register_record.opened_by;
  return base || jsonb_build_object('lifecycle',jsonb_build_object(
    'openingBalance',register_record.opening_balance,'openingSource',register_record.opening_source,
    'openedAt',register_record.opened_at,'openedBy',opened_by_json,'expectedCash',expected_value,
    'countedCash',register_record.counted_cash,'difference',register_record.difference_cash,
    'closeMode',register_record.close_mode,'reconciliationState',register_record.reconciliation_state));
end;
$$;

revoke execute on function public.cash_day_as_json(date,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.cash_day_as_json(date,uuid,boolean) to service_role;

commit;
