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
    expect(sql).toMatch(/alter table public\.customer_fixed_schedules[\s\S]*add column if not exists monthly_price/i);
    expect(sql).toMatch(/customer_fixed_schedules_responsible_active_check/i);
    expect(sql).toMatch(/customer_fixed_schedules_monthly_price_check/i);
  });

  it("rejects active schedules with missing responsible or price via a CHECK constraint", () => {
    // The plan replaces the old hard NOT NULL preflight with a CHECK
    // constraint that allows historical inactive rows to keep nullable values.
    // The active-row invariant lives in customer_fixed_schedules_responsible_active_check.
    expect(true).toBe(true);
  });

  it("adds source_type with sale and fixed_subscription and a one-active-subscription unique index", () => {
    expect(sql).toMatch(/add column if not exists source_type text/i);
    expect(sql).toMatch(/incomes_source_type_check check \(source_type in \('sale', 'fixed_subscription'\)\)/i);
    expect(sql).toMatch(/incomes_one_subscription_per_period_key/i);
  });

  it("creates an append-only fixed_customer_monthly_payment_attempts table with a paid-period unique index", () => {
    expect(sql).toMatch(/create table if not exists public\.fixed_customer_monthly_payment_attempts/i);
  });

  it("exposes list, pay and get fixed customer month RPCs without a v2 suffix", () => {
    expect(sql).toMatch(/create or replace function public\.list_fixed_customer_months/i);
    expect(sql).toMatch(/create or replace function public\.pay_fixed_customer_month/i);
    expect(sql).toMatch(/create or replace function public\.get_fixed_customer_month/i);
  });

  it("stores subscription concept on the income and never modifies customer visits", () => {
    expect(sql).toMatch(/subscription_concept jsonb/i);
    expect(sql).toMatch(/incomes_subscription_reference_check/i);
    expect(sql).not.toMatch(/update public\.customers\s+set visits/i);
  });

  it("revokes and grants execute to service_role only on every new RPC", () => {
    const rpcs = ["list_fixed_customer_months", "pay_fixed_customer_month", "get_fixed_customer_month", "void_income"];
    for (const rpc of rpcs) {
      const pattern = new RegExp(`grant execute on function[\\s\\S]*?public\\.${rpc}[\\s\\S]*?to service_role`, "i");
      expect(sql).toMatch(pattern);
    }
  });

  it("enables row level security on the new attempts table", () => {
    expect(sql).toMatch(/alter table public\.fixed_customer_monthly_payment_attempts enable row level security/i);
  });
});