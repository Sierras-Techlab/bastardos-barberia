begin;

-- Databases that installed the first 026 revision still expose the unversioned
-- three-argument void RPC. Promote the optimistic contract without rerunning 026.
drop function if exists public.void_expense(uuid, uuid, text);
drop function if exists public.void_expense(uuid, uuid, timestamptz, text);

create function public.void_expense(
  actor_user_id uuid,
  target_expense_id uuid,
  expected_updated_at timestamptz,
  void_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_expense public.expenses;
  updated_expense public.expenses;
  next_revision integer;
begin
  perform public.assert_expense_manager(actor_user_id);

  select * into old_expense
  from public.expenses
  where id = target_expense_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'EXPENSE_NOT_FOUND';
  end if;
  if old_expense.updated_at <> expected_updated_at then
    raise exception using errcode = '40001', message = 'EXPENSE_CONFLICT';
  end if;
  if old_expense.status <> 'active' then
    raise exception using errcode = '22023', message = 'EXPENSE_NOT_ACTIVE';
  end if;
  if char_length(trim($4)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'EXPENSE_INVALID';
  end if;

  update public.expenses
  set status = 'voided',
      voided_by = actor_user_id,
      voided_at = pg_catalog.clock_timestamp(),
      void_reason = trim($4),
      updated_by = actor_user_id,
      updated_at = pg_catalog.clock_timestamp()
  where id = target_expense_id
  returning * into updated_expense;

  select coalesce(max(revision_number), 0) + 1
  into next_revision
  from public.expense_revisions
  where expense_id = target_expense_id;

  insert into public.expense_revisions (
    expense_id,
    revision_number,
    changed_by,
    reason,
    previous_snapshot,
    next_snapshot
  ) values (
    target_expense_id,
    next_revision,
    actor_user_id,
    trim($4),
    public.expense_as_json(old_expense),
    public.expense_as_json(updated_expense)
  );

  return public.expense_as_json(updated_expense);
end;
$$;

revoke execute on function public.void_expense(uuid, uuid, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.void_expense(uuid, uuid, timestamptz, text)
  to service_role;

commit;
