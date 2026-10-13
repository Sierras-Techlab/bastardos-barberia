import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/queries/045_employee_commercial_agreements_and_chair_rentals.sql"),
  "utf8",
).toLowerCase();

describe("migration 045 employee agreements and chair rentals", () => {
  it("installs the employee agreement, append-only audit and safe grants", () => {
    expect(sql).toContain("service_commission_enabled");
    expect(sql).toContain("product_commission_enabled");
    expect(sql).toContain("chair_rental_effective_from");
    expect(sql).toContain("normalize_employee_agreement_on_insert");
    expect(sql).toContain("monthly_chair_rental_amount is not null and monthly_chair_rental_amount > 0");
    expect(sql).toContain("chair_rental_effective_from is not null");
    expect(sql).toContain("chair_rental_due_day is not null");
    expect(sql).toContain("employee_commercial_agreement_audit");
    expect(sql).toContain("agreement_audit_append_only");
    expect(sql).toContain("alter table public.employee_commercial_agreement_audit enable row level security");
    expect(sql).toMatch(/revoke all on table public\.employee_commercial_agreement_audit[\s\S]*grant select/);
    expect(sql).toContain("revoke execute on function public.chair_rental_payment_as_json(uuid)");
    expect(sql).toContain("grant execute on function public.chair_rental_payment_as_json(uuid) to service_role");
    expect(sql).toContain("revoke execute on function public.seed_chair_rental_obligations(uuid,bigint,text,smallint,uuid)");
    expect(sql).toContain("revoke execute on function public.chair_rental_month_summary(text)");
    expect(sql).toContain("revoke execute on function public.cash_day_as_json(date,uuid,boolean) from public,anon,authenticated");
    expect(sql).toContain("grant execute on function public.cash_day_as_json(date,uuid,boolean) to service_role");
    expect(sql).toContain("set_config('app.actor_user_id', actor_user_id::text, true)");
    expect(sql).toContain("servicecommissionrate");
  });

  it("uses an active employee-period key and request-id idempotency", () => {
    expect(sql).toContain("chair_rental_attempt_request_unique");
    expect(sql).toContain("chair_rental_one_active_period");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("confirm_chair_rental_payment");
    expect(sql).toContain("void_chair_rental_payment");
    expect(sql).toContain("void_reason");
    expect(sql).toContain("chair_rental_request_unique");
    expect(sql).toContain("chair_rental_request_conflict");
    expect(sql).toContain("chair-rental-request:");
  });

  it("matches the repository RPC names and named-argument contracts", () => {
    expect(sql).toMatch(/get_employee_commercial_agreement\(actor_user_id uuid, target_employee_id uuid\)/);
    expect(sql).toMatch(/list_chair_rental_payments\(actor_user_id uuid, filter_period text/);
    expect(sql).toMatch(/get_chair_rental_detail\(actor_user_id uuid, target_employee_id uuid\)/);
    expect(sql).toMatch(/update_employee_commercial_agreement\(\s*actor_user_id uuid, target_employee_id uuid, agreement jsonb/);
    expect(sql).toMatch(/confirm_chair_rental_payment\(actor_user_id uuid,target_employee_id uuid,billed_period text,target_payment_method_id uuid,request_id uuid\)/);
    expect(sql).toMatch(/void_chair_rental_payment\(actor_user_id uuid,target_payment_id uuid,void_reason text\)/);
  });

  it("keeps rentals outside work sessions and commissions", () => {
    expect(sql).toContain("new.source_type='chair_rental'");
    expect(sql).toContain("new.outside_work_session=false");
    expect(sql).toMatch(/source_type='chair_rental'[\s\S]*service_commission_rate,product_commission_rate[\s\S]*,0,0/);
    expect(sql).toContain("chair_rental");
    expect(sql).toContain("daily_cash_sales_kind_check");
    expect(sql).toContain("pay_fixed_customer_month");
    expect(sql).toContain("employee_service_enabled");
    expect(sql).toContain("get_business_report");
    expect(sql).toContain("get_expense_month_summary");
    expect(sql).toMatch(/'status',case when a\.status='active' then 'paid' else 'voided' end/);
    expect(sql).not.toMatch(/'status',a\.status/);
  });

  it("inserts chair-rental income with matching economic column values", () => {
    expect(sql).toContain("obligation.amount,obligation.amount,obligation.amount,0,0,0,0,0,0,obligation.amount,false,null,false,'active'");
    expect(sql).not.toContain("obligation.amount,obligation.amount,obligation.amount,0,0,0,0,0,0,0,obligation.amount,false");
  });

  it("repairs automatic close and cash composition for rental movements", () => {
    expect(sql).toContain("create or replace function public.close_pending_daily_cash()");
    expect(sql).toContain("perform public.snapshot_daily_cash(open_register.id,open_register.business_date)");
    expect(sql).toContain("chair_rental_sales_total");
    expect(sql).toContain("chair_rental_adjustment_total");
    expect(sql).toContain("chair_rental_delta");
    expect(sql).toContain("byeffectivedate");
    expect(sql).toContain("source_type='chair_rental'");
    expect(sql).toContain("kind = 'chair_rental'");
    expect(sql).toContain("chairrentaltotal");
    expect(sql).toContain("is_live then");
    expect(sql).toContain("jsonb_array_elements(coalesce(result->'sales','[]'::jsonb))");
    expect(sql).toContain("to_char(i.business_date,'yyyy-mm')=target_period");
    expect(sql).toContain("create or replace function public.snapshot_daily_cash");
    expect(sql).toContain("income_chair_rental_attempt_fk");
    expect(sql).toContain("voided_at is not null");
  });

  it("enforces source-specific attempt links and complete rental metadata", () => {
    expect(sql).toContain("drop constraint if exists incomes_subscription_concept_check");
    expect(sql).toContain("alter column income_id set not null");
    expect(sql).toContain("alter column request_fingerprint set not null");
    expect(sql).toContain("chair_rental_period is not null");
    expect(sql).toContain("chair_rental_attempt_income_fk");
    expect(sql).toMatch(/chair_rental_attempt_income_fk[\s\S]*deferrable initially deferred/);
    expect(sql).toContain("chair_rental_attempt_income_unique");
    expect(sql).toContain("income_chair_rental_attempt_unique");
    expect(sql).toContain("chair_rental_attempt_id is not null");
    expect(sql).toContain("chair_rental_income_items_forbidden");
    expect(sql).toContain("chair_rental_attempt_payment_link_invalid");
    expect(sql).toContain("request_fingerprint is distinct from new.request_fingerprint");
    expect(sql).toContain("employee_id is distinct from new.employee_id");
    expect(sql).toContain("chair_rental_period is distinct from new.period");
    expect(sql).toContain("chair_rental_attempt_id is null");
    expect(sql).toContain("chair_rental_attempt_income_required");
  });

  it("makes rental void authorization fail closed", () => {
    expect(sql).toContain("coalesce(current_setting('app.chair_rental_void',true),'') <> '1'");
    expect(sql).toContain("app.chair_rental_void_attempt_id");
    expect(sql).toContain("app.chair_rental_void_reason");
    expect(sql).toContain("select a.void_reason,a.voided_by,a.voided_at into attempt_reason");
    expect(sql).not.toContain("new.void_reason");
    expect(sql).toContain("chair_rental_canonical_void_required");
    expect(sql).toContain("set_config('app.chair_rental_void_attempt_id'");
    expect(sql).toContain("set_config('app.chair_rental_void_reason'");
    expect(sql).toContain("normalized_void_reason text");
    expect(sql).toContain("normalized_void_reason:=trim(void_reason)");
    expect(sql).toContain("void_reason=normalized_void_reason");
    expect(sql).not.toContain("void_reason=trim(void_reason)");
  });

  it("invalidates operational agreements across role transitions", () => {
    expect(sql).toContain("users_employee_agreement_role_check");
    expect(sql).toContain("role_id = 3");
    expect(sql).toMatch(/old\.role_id = 3 and new\.role_id <> 3/);
    expect(sql).toMatch(/old\.role_id <> 3 and new\.role_id = 3/);
    expect(sql).toContain("agreement_actor_required");
    expect(sql).toMatch(/target_employee_id[\s\S]*for update/);
    expect(sql).toContain("actor_role_id is null");
    expect(sql).toContain("manager_required");
    expect(sql).toContain("actor_role_id <> 1");
    expect(sql).toContain("owner_required");
  });

  it("guards canonical rewrites against partial or repeated repairs", () => {
    expect(sql).toContain("bastardos.045.pay_fixed_customer_month.v1");
    expect(sql).toContain("bastardos.045.list_incomes.v1");
    expect(sql).toContain("pay_fixed_customer_month_repair_partial");
    expect(sql).toContain("list_incomes_chair_rental_repair_partial");
    expect(sql).toContain("employee_service_rate, employee_product_rate, employee_service_enabled");
    expect(sql).toContain("position('into responsible_employee_role, employee_service_rate, employee_product_rate' in d)>0");
    expect(sql).toContain("replace(repaired_definition,'into responsible_employee_role, employee_service_rate, employee_product_rate','into responsible_employee_role, employee_service_rate, employee_product_rate, employee_service_enabled')");
    expect(sql).toContain("create_income_employee_agreement_target_missing");
    expect(sql).toContain("list_incomes_chair_rental_target_missing");
    expect(sql).toContain("pay_fixed_customer_month_target_missing");
    expect(sql).toContain("when totals.sale_count = 0");
    expect(sql).toContain("employee_service_rate := case when responsible_employee_role = ''employee'' and not employee_service_enabled");
  });

  it("repairs the record-based fixed-customer writer installed on upgraded databases", () => {
    expect(sql).toContain("responsible[[:space:]]+record;");
    expect(sql).toContain("u\\.service_commission_rate,[[:space:]]*u\\.service_commission_enabled");
    expect(sql).toContain("into[[:space:]]+responsible");
    expect(sql).toContain("responsible.service_commission_rate := case when responsible.role_id = 3 and not responsible.service_commission_enabled");
  });

  it("keeps generic income voiding away from chair rentals", () => {
    expect(sql).toContain("void_income_045_base");
    expect(sql).toContain("chair_rental_canonical_void_required");
    expect(sql).toMatch(/revoke execute on function public\.void_income_045_base\(uuid,uuid\)[\s\S]*service_role/);
    expect(sql).toContain("app.chair_rental_void_income_id");
    expect(sql).toContain("attempt_voided_at is distinct from new.voided_at");
  });

  it("snapshots obligations and audit rates instead of reading mutable configuration", () => {
    expect(sql).toContain("chair_rental_obligations");
    expect(sql).toContain("servicecommissionrate");
    expect(sql).toContain("productcommissionrate");
    expect(sql).toContain("source_effective_from");
    expect(sql).toContain("billed_period");
  });
});
