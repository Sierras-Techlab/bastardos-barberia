import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "queries", "021_fixed_customer_monthly_payments.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("migration 021 fixed customer monthly payments", () => {
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

  it("adds source_type with sale and fixed_subscription and a one-active-subscription unique index", () => {
    expect(sql).toMatch(/add column if not exists source_type text/i);
    expect(sql).toMatch(/incomes_source_type_check check \(source_type in \('sale', 'fixed_subscription'\)\)/i);
    expect(sql).toMatch(/incomes_one_subscription_per_period_key/i);
  });

  it("defines attempts.status with a CHECK constraint and a partial unique active index", () => {
    expect(sql).toMatch(/status text not null default 'active' check \(status in \('active', 'voided'\)\)/i);
    expect(sql).toMatch(/fixed_payment_attempts_one_active_period/i);
    expect(sql).toMatch(/create unique index if not exists fixed_payment_attempts_one_active_period/i);
  });

  it("creates the append-only fixed_customer_monthly_payment_attempts table", () => {
    expect(sql).toMatch(/create table if not exists public\.fixed_customer_monthly_payment_attempts/i);
  });

  it("exposes list, pay and get fixed customer month RPCs without a v2 suffix and adds a synthesize_pending helper", () => {
    expect(sql).toMatch(/create or replace function public\.list_fixed_customer_months/i);
    expect(sql).toMatch(/create or replace function public\.pay_fixed_customer_month/i);
    expect(sql).toMatch(/create or replace function public\.get_fixed_customer_month/i);
    expect(sql).toMatch(/create or replace function public\.synthesize_pending_fixed_customer_month/i);
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

  it("revokes and grants execute to service_role only on every new RPC", () => {
    const rpcs = [
      "list_fixed_customer_months",
      "pay_fixed_customer_month",
      "get_fixed_customer_month",
      "synthesize_pending_fixed_customer_month",
      "compute_fixed_subscription_payments",
      "fixed_customer_month_as_json",
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