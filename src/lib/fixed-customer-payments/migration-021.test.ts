import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "queries", "021_fixed_customer_monthly_payments.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("migration 021 fixed customer monthly payments", () => {
  it("does not introduce version-suffixed objects", () => {
    expect(sql).not.toMatch(/_v2/i);
  });

  it("adds responsible_user_id and monthly_price to fixed schedules and requires them", () => {
    expect(sql).toMatch(/alter table public\.customer_fixed_schedules[\s\S]*add column if not exists responsible_user_id uuid/i);
    expect(sql).toMatch(/alter table public\.customer_fixed_schedules[\s\S]*add column if not exists monthly_price integer/i);
    expect(sql).toMatch(/alter column responsible_user_id set not null/i);
    expect(sql).toMatch(/alter column monthly_price set not null/i);
    expect(sql).toMatch(/customer_fixed_schedules_monthly_price_check/i);
  });

  it("aborts with LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED when active schedules lack owner or price", () => {
    expect(sql).toMatch(/LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED/);
  });

  it("does not read the removed legacy user_id schedule column", () => {
    expect(sql).not.toMatch(/\buser_id\b/i);
  });

  it("resolves actor roles through the canonical roles table", () => {
    expect(sql).not.toMatch(/\brole_name\b/i);
    expect(sql).toMatch(/join public\.roles/i);
  });

  it("does not bypass the canonical income work-session trigger with a legacy table", () => {
    expect(sql).not.toMatch(/public\.work_sessions/i);
  });

  it("derives the requested month from the RPC argument instead of the weekly schedule", () => {
    expect(sql).not.toMatch(/\bs\.period\b/i);
    expect(sql).toMatch(/'period', filter_period/i);
  });

  it("derives paid earnings from the immutable income snapshot", () => {
    expect(sql).not.toMatch(/att\.employee_earning/i);
    expect(sql).toMatch(/i\.commission_total/i);
  });

  it("persists subscription incomes with the canonical audited columns", () => {
    expect(sql).toMatch(/insert into public\.incomes \([\s\S]*registered_by[\s\S]*employee_id[\s\S]*responsible_role_snapshot[\s\S]*request_fingerprint/i);
    expect(sql).toMatch(/service_commission_base[\s\S]*commission_total[\s\S]*barbershop_net/i);
  });

  it("reads camelCase payment allocations and persists positive exact amounts", () => {
    expect(sql).toMatch(/paymentMethodId/);
    expect(sql).toMatch(/basisPoints/);
    expect(sql).not.toMatch(/jsonb_to_recordset\(payment_items\)[\s\S]*payment_method_id uuid/i);
  });

  it("preserves the canonical void RPC and synchronizes monthly attempts with a trigger", () => {
    expect(sql).not.toMatch(/create or replace function public\.void_income/i);
    expect(sql).toMatch(/after update of status on public\.incomes/i);
  });

  it("uses configured owner commission instead of forcing it to zero", () => {
    expect(sql).not.toMatch(/if actor_role = 'owner'[\s\S]*commission_amount := 0/i);
  });

  it("adds source_type with sale and fixed_subscription and a one-active-subscription unique index", () => {
    expect(sql).toMatch(/add column if not exists source_type text/i);
    expect(sql).toMatch(/incomes_source_type_check check \(source_type in \('sale', 'fixed_subscription'\)\)/i);
    expect(sql).toMatch(/incomes_one_subscription_per_period_key/i);
  });

  it("creates an append-only fixed_customer_monthly_payment_attempts table with a paid-period unique index", () => {
    expect(sql).toMatch(/create table if not exists public\.fixed_customer_monthly_payment_attempts/i);
    expect(sql).toMatch(/fixed_payment_attempts_one_active_per_period_key/i);
  });

  it("exposes list, pay and get fixed customer month RPCs without a v2 suffix", () => {
    expect(sql).toMatch(/create or replace function public\.list_fixed_customer_months/i);
    expect(sql).toMatch(/create or replace function public\.pay_fixed_customer_month/i);
    expect(sql).toMatch(/create or replace function public\.get_fixed_customer_month/i);
  });

  it("stores subscription concept on the income and never modifies customer visits", () => {
    expect(sql).toMatch(/subscription_concept jsonb/i);
    expect(sql).toMatch(/incomes_subscription_concept_check/i);
    expect(sql).not.toMatch(/update public\.customers\s+set visits/i);
  });

  it("revokes and grants execute to service_role only on every new RPC", () => {
    const rpcs = ["list_fixed_customer_months", "pay_fixed_customer_month", "get_fixed_customer_month"];
    for (const rpc of rpcs) {
      const pattern = new RegExp(`grant execute on function[\\s\\S]*?public\\.${rpc}[\\s\\S]*?to service_role`, "i");
      expect(sql).toMatch(pattern);
    }
  });

  it("enables row level security on the new attempts table", () => {
    expect(sql).toMatch(/alter table public\.fixed_customer_monthly_payment_attempts enable row level security/i);
  });
});
