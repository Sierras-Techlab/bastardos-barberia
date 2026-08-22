import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase", "queries", "022_manual_cash_lifecycle.sql"), "utf8");

describe("migration 022 manual cash lifecycle", () => {
  it("does not introduce version-suffixed objects", () => {
    expect(sql).not.toMatch(/_v2/i);
  });

  it("evolves daily_cash_registers without recreating it", () => {
    expect(sql).toMatch(/alter table public\.daily_cash_registers/i);
    expect(sql).toMatch(/add column if not exists opening_balance bigint/i);
    expect(sql).toMatch(/add column if not exists opening_source text/i);
    expect(sql).toMatch(/add column if not exists expected_cash bigint/i);
    expect(sql).toMatch(/add column if not exists counted_cash bigint/i);
    expect(sql).toMatch(/add column if not exists difference_cash bigint/i);
    expect(sql).toMatch(/add column if not exists reconciliation_state text/i);
  });

  it("backfills legacy 018 registers without losing snapshots", () => {
    expect(sql).toMatch(/update public\.daily_cash_registers/i);
    expect(sql).toMatch(/opening_source = 'first_income'/i);
    expect(sql).toMatch(/close_mode = 'automatic'/i);
    expect(sql).toMatch(/reconciliation_state = 'pending_confirmation'/i);
  });

  it("identifies exactly one Efectivo payment method and refuses to apply otherwise", () => {
    expect(sql).toMatch(/CASH_PAYMENT_METHOD_REQUIRED/);
    expect(sql).toMatch(/update public\.payment_methods\s+set system_code = 'cash'/i);
    expect(sql).toMatch(/payment_methods_cash_system_unique/i);
  });

  it("rejects rename/deactivate/delete of the protected Efectivo record", () => {
    expect(sql).toMatch(/CASH_PAYMENT_METHOD_PROTECTED/);
    expect(sql).toMatch(/create or replace function public\.create_payment_method/i);
    expect(sql).toMatch(/create or replace function public\.update_payment_method/i);
    expect(sql).toMatch(/create or replace function public\.delete_payment_method/i);
  });

  it("exposes open, close, confirm and the protected ensure helper", () => {
    expect(sql).toMatch(/create or replace function public\.ensure_daily_cash_open/i);
    expect(sql).toMatch(/create or replace function public\.open_daily_cash/i);
    expect(sql).toMatch(/create or replace function public\.close_daily_cash/i);
    expect(sql).toMatch(/create or replace function public\.confirm_daily_cash/i);
  });

  it("uses on conflict to make the auto-open conflict-safe", () => {
    expect(sql).toMatch(/on conflict \(business_date\) do nothing/i);
  });

  it("promotes cash_day_as_json to expose lifecycle fields", () => {
    expect(sql).toMatch(/create or replace function public\.cash_day_as_json/i);
    expect(sql).toMatch(/'openingBalance'/i);
    expect(sql).toMatch(/'expectedCash'/i);
    expect(sql).toMatch(/'reconciliationState'/i);
  });

  it("rejects negative opening balance or counted cash inputs", () => {
    expect(sql).toMatch(/INVALID_OPENING_BALANCE/);
    expect(sql).toMatch(/INVALID_COUNTED_CASH/);
  });
});