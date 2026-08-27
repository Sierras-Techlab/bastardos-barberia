import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "queries", "021_fixed_customer_monthly_payments.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("migration 021 fixed customer monthly payments", () => {
  it("consumes the repository camelCase payment JSON contract", () => {
    expect(sql).toMatch(/item->>'paymentMethodId'/i);
    expect(sql).toMatch(/item->>'basisPoints'/i);
    expect(sql).not.toMatch(/jsonb_to_recordset\(payment_items\)[\s\S]*?payment_method_id uuid/i);
  });

  it("requires explicit legacy schedule mappings instead of inferring the creator", () => {
    expect(sql).toMatch(/LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED/i);
    expect(sql).not.toMatch(/responsible_user_id = coalesce\(responsible_user_id, created_by\)/i);
    expect(sql.indexOf("LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED")).toBeLessThan(
      sql.indexOf("begin;", sql.indexOf("LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED")),
    );
  });

  it("fingerprints the normalized payment allocation and rejects mismatched retries", () => {
    expect(sql).toMatch(/normalized_payments/i);
    expect(sql).toMatch(/FIXED_MONTH_REQUEST_CONFLICT/i);
    expect(sql).toMatch(/existing_income\.request_fingerprint <> fingerprint/i);
    expect(sql).toMatch(/get stacked diagnostics violated_constraint = constraint_name/i);
    const payBody = sql.match(/create or replace function public\.pay_fixed_customer_month[\s\S]+?end;\s*\$\$/i)?.[0] ?? "";
    expect(payBody.indexOf("where request_id = income_request_id")).toBeGreaterThan(0);
    expect(payBody.indexOf("where request_id = income_request_id")).toBeLessThan(
      payBody.indexOf("perform public.ensure_fixed_customer_active"),
    );
  });
  it("does not introduce version-suffixed objects", () => {
    expect(sql).not.toMatch(/_v2/i);
  });

  it("does not call ensure_daily_cash_open so migration 022 owns universal opening", () => {
    const executableSql = sql.replace(/--[^\n]*\n/g, "");
    expect(executableSql).not.toMatch(/ensure_daily_cash_open/i);
  });

  it("derives the viewer discriminant from actor_user_id and never reads JWT settings", () => {
    expect(sql).not.toMatch(/request\.jwt\.claim/i);
    expect(sql).not.toMatch(/current_setting/i);
  });

  it("never writes to the legacy customer_fixed_schedules.user_id column", () => {
    expect(sql).not.toMatch(/customer_fixed_schedules[\s\S]*?\buser_id\b(?!\s*_snapshot)/i);
  });

  it("uses a hexadecimal text fingerprint for request_fingerprint on subscription incomes", () => {
    expect(sql).toMatch(/request_fingerprint\s*,/i);
    expect(sql).toMatch(/pg_catalog\.encode\([\s\S]+extensions\.digest\([\s\S]+'hex'[\s\S]+\)/i);
    expect(sql).not.toMatch(/uuid\]?::jsonb/i);
  });

  it("adds responsible_user_id and monthly_price to fixed schedules and requires them", () => {
    expect(sql).toMatch(/alter table public\.customer_fixed_schedules[\s\S]*add column if not exists responsible_user_id uuid/i);
    expect(sql).toMatch(/alter table public\.customer_fixed_schedules[\s\S]*add column if not exists monthly_price/i);
    expect(sql).toMatch(/customer_fixed_schedules_responsible_active_check/i);
    expect(sql).toMatch(/customer_fixed_schedules_monthly_price_check/i);
  });

  it("scopes the weekly agenda and attendance mutations to the responsible employee", () => {
    const listBody = sql.match(/create or replace function public\.list_fixed_customer_occurrences[\s\S]+?end;\s*\$\$/i)?.[0] ?? "";
    const resolveBody = sql.match(/create or replace function public\.resolve_fixed_customer_occurrence[\s\S]+?end;\s*\$\$/i)?.[0] ?? "";

    expect(listBody).toMatch(/select u\.role_id into actor_role_id[\s\S]+u\.id = actor_user_id/i);
    expect(listBody).toMatch(/actor_role_id in \(1, 2\)[\s\S]+s\.responsible_user_id = actor_user_id/i);
    expect(resolveBody).toMatch(/actor_role_id in \(1, 2\)[\s\S]+s\.is_active[\s\S]+s\.responsible_user_id = actor_user_id/i);
    expect(resolveBody).toMatch(/FIXED_OCCURRENCE_NOT_FOUND/i);
  });

  it("adds source_type with sale and fixed_subscription and a one-active-subscription unique index", () => {
    expect(sql).toMatch(/add column if not exists source_type text/i);
    expect(sql).toMatch(/incomes_source_type_check check \(source_type in \('sale', 'fixed_subscription'\)\)/i);
    expect(sql).toMatch(/incomes_one_subscription_per_period_key/i);
  });

  it("does not write an invalid legacy payment discriminator for subscriptions", () => {
    const payBody = sql.match(/create or replace function public\.pay_fixed_customer_month[\s\S]+?end;\s*\$\$/i)?.[0] ?? "";

    expect(payBody).toMatch(/target_customer_id,\s*null,\s*monthly_price,\s*monthly_price/i);
    expect(payBody).not.toMatch(/target_customer_id,\s*'mixed'/i);
  });

  it("defines attempts.status with a CHECK constraint and a partial unique active index", () => {
    expect(sql).toMatch(/status text not null default 'active' check \(status in \('active', 'voided'\)\)/i);
    expect(sql).toMatch(/fixed_payment_attempts_one_active_period/i);
    expect(sql).toMatch(/create unique index if not exists fixed_payment_attempts_one_active_period/i);
  });

  it("creates the append-only fixed_customer_monthly_payment_attempts table", () => {
    expect(sql).toMatch(/create table if not exists public\.fixed_customer_monthly_payment_attempts/i);
  });

  it("exposes list, pay, get, synthesize and the employee projection without a v2 suffix", () => {
    expect(sql).toMatch(/create or replace function public\.list_fixed_customer_months/i);
    expect(sql).toMatch(/create or replace function public\.pay_fixed_customer_month/i);
    expect(sql).toMatch(/create or replace function public\.get_fixed_customer_month/i);
    expect(sql).toMatch(/create or replace function public\.synthesize_pending_fixed_customer_month/i);
    expect(sql).toMatch(/create or replace function public\.fixed_customer_month_as_employee_json/i);
  });

  it("stores subscription concept on the income and never modifies customer visits", () => {
    expect(sql).toMatch(/subscription_concept jsonb/i);
    expect(sql).toMatch(/incomes_subscription_reference_check/i);
    expect(sql).not.toMatch(/update public\.customers\s+set visits/i);
  });

  it("keeps the canonical void_income RPC and only adds an AFTER UPDATE OF status trigger", () => {
    expect(sql).toMatch(/trg_void_fixed_subscription_attempt/i);
    expect(sql).toMatch(/after update of status on public\.incomes/i);
    expect(sql).not.toMatch(/create or replace function public\.void_income/i);
  });

  it("records the actual voiding manager in attempts.voided_by, not the original registrant", () => {
    expect(sql).toMatch(/voided_by\s*=\s*coalesce\(new\.voided_by,\s*new\.registered_by\)/i);
  });

  it("includes the viewer discriminant on every read projection", () => {
    expect(sql).toMatch(/fixed_customer_month_as_json[\s\S]+'viewer',\s*'manager'/i);
    expect(sql).toMatch(/fixed_customer_month_as_employee_json[\s\S]+'viewer',\s*'employee'/i);
  });

  it("never exposes monthlyPrice on the employee projection", () => {
    const employeeJsonMatch = sql.match(/create or replace function public\.fixed_customer_month_as_employee_json[\s\S]+?return result;\s+end;\s*\$\$/i);
    expect(employeeJsonMatch).toBeTruthy();
    expect(employeeJsonMatch?.[0] ?? "").not.toMatch(/monthlyPrice/i);
  });

  it("uses the canonical YYYY-MM period in synthesize_pending", () => {
    expect(sql).toMatch(/synthesize_pending_fixed_customer_month[\s\S]+'period',\s*target_period/i);
  });

  it("blocks zero-basis_points distributions inside compute_fixed_subscription_payments", () => {
    expect(sql).toMatch(/basis_points is null or raw_item\.basis_points <= 0 or raw_item\.basis_points > 10000/i);
    expect(sql).toMatch(/if computed_amount <= 0 then[\s\S]+raise exception using errcode = '22023', message = 'FIXED_MONTH_INVALID_PAYMENT'/i);
  });

  it("does not shadow the PL/pgSQL raw_item record in the amount return query", () => {
    const computeBody = sql.match(/create or replace function public\.compute_fixed_subscription_payments[\s\S]+?end;\s*\$\$/i)?.[0] ?? "";

    expect(computeBody).toMatch(/select parsed_item\.payment_method_id, parsed_item\.amount::bigint/i);
    expect(computeBody).not.toMatch(/\)\s+raw_item;/i);
  });

  it("calls synthesize_pending_fixed_customer_month when no attempt exists", () => {
    const getMatch = sql.match(/create or replace function public\.get_fixed_customer_month[\s\S]+?end;\s*\$\$/i);
    expect(getMatch).toBeTruthy();
    expect(getMatch?.[0] ?? "").toMatch(/synthesize_pending_fixed_customer_month/i);
  });

  it("dispatches pay and get responses through the authenticated actor role", () => {
    const payBody = sql.match(/create or replace function public\.pay_fixed_customer_month[\s\S]+?end;\s*\$\$/i)?.[0] ?? "";
    const getBody = sql.match(/create or replace function public\.get_fixed_customer_month[\s\S]+?end;\s*\$\$/i)?.[0] ?? "";

    expect(payBody).toMatch(/actor_role/i);
    expect(payBody).toMatch(/fixed_customer_month_as_employee_json/i);
    expect(getBody).toMatch(/actor_role/i);
    expect(getBody).toMatch(/fixed_customer_month_as_employee_json/i);
    expect(getBody).not.toMatch(/most recent attempt regardless of status/i);
  });

  it("omits monthlyPrice from employee list and pending projections", () => {
    const listBody = sql.match(/create or replace function public\.list_fixed_customer_months[\s\S]+?end;\s*\$\$/i)?.[0] ?? "";
    const synthBody = sql.match(/create or replace function public\.synthesize_pending_fixed_customer_month[\s\S]+?end;\s*\$\$/i)?.[0] ?? "";

    expect(listBody).toMatch(/case\s+when actor_role in \('owner', 'admin'\)[\s\S]+jsonb_build_object\('monthlyPrice'/i);
    expect(synthBody).toMatch(/viewer_role/i);
    expect(synthBody).toMatch(/case\s+when viewer_role = 'employee'/i);
  });

  it("locks and validates every submitted payment method as active", () => {
    const payBody = sql.match(/create or replace function public\.pay_fixed_customer_month[\s\S]+?end;\s*\$\$/i)?.[0] ?? "";

    expect(payBody).toMatch(/from public\.payment_methods pm[\s\S]+pm\.is_active[\s\S]+for share/i);
    expect(payBody).toMatch(/FIXED_MONTH_PAYMENT_METHOD_NOT_AVAILABLE/i);
    expect(payBody).not.toMatch(/payment_methods_lock_key/i);
  });

  it("revokes and grants execute to service_role only on every new RPC", () => {
    const rpcs = [
      "list_fixed_customer_months",
      "pay_fixed_customer_month",
      "get_fixed_customer_month",
      "synthesize_pending_fixed_customer_month",
      "compute_fixed_subscription_payments",
      "fixed_customer_month_as_json",
      "fixed_customer_month_as_employee_json",
      "ensure_fixed_customer_active",
    ];
    for (const rpc of rpcs) {
      const pattern = new RegExp(`grant execute on function[\\s\\S]*?public\\.${rpc}[\\s\\S]*?to service_role`, "i");
      expect(sql).toMatch(pattern);
    }
  });

  it("enables row level security on the new attempts table", () => {
    expect(sql).toMatch(/alter table public\.fixed_customer_monthly_payment_attempts enable row level security/i);
  });

  it("selects the role as text and never casts role_id to integer", () => {
    expect(sql).not.toMatch(/role_id\s*::\s*integer/i);
    expect(sql).toMatch(/when 1 then 'owner' when 2 then 'admin' when 3 then 'employee'/i);
  });
});
