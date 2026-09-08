import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "queries",
  "041_employee_service_prices_and_automatic_cash.sql",
);
const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("migration 041 employee service prices and automatic cash", () => {
  it("allows employee service overrides while retaining the product guard", () => {
    expect(sql).toMatch(/pg_get_functiondef/i);
    expect(sql).toMatch(/service_price_override/i);
    expect(sql).toMatch(/selected_service_id\s+is\s+null/i);
    expect(sql).toMatch(/product_price_overrides/i);
    expect(sql).toMatch(/PRICE_OVERRIDE_NOT_ALLOWED_FOR_EMPLOYEE/i);
    expect(sql).toMatch(/CREATE_INCOME_EMPLOYEE_SERVICE_OVERRIDE_REPAIR_FAILED/i);
  });

  it("sets or updates the current live opening balance under the manager identity", () => {
    expect(sql).toMatch(/create or replace function public\.set_daily_cash_opening_balance/i);
    expect(sql).toMatch(/role_id in\s*\(\s*1\s*,\s*2\s*\)/i);
    expect(sql).toMatch(/opening_source\s*=\s*'initial_balance'/i);
    expect(sql).toMatch(/closed_at is null/i);
    expect(sql).toMatch(/CASH_ALREADY_CLOSED/i);
    expect(sql).toMatch(/INVALID_OPENING_BALANCE/i);

    const insert =
      sql.match(
        /insert into public\.daily_cash_registers\s*\([\s\S]+?returning \* into register_record;/i,
      )?.[0] ?? "";
    expect(insert).toMatch(/\bopening_balance\b/i);
    expect(insert).not.toMatch(/\(\s*[\s\S]*?\bnew_opening_balance\b[\s\S]*?\)\s*values/i);
    expect(insert).toMatch(/\)\s*values\s*\([\s\S]*?new_opening_balance/i);
  });

  it("removes manual lifecycle operations but preserves automatic close and confirmation", () => {
    expect(sql).toMatch(/drop function if exists public\.open_daily_cash\(uuid, date, bigint\)/i);
    expect(sql).toMatch(/drop function if exists public\.close_daily_cash\(uuid, date, bigint\)/i);
    expect(sql).toMatch(/grant execute on function public\.set_daily_cash_opening_balance/i);
    expect(sql).not.toMatch(/drop function if exists public\.confirm_daily_cash/i);
    expect(sql).not.toMatch(/drop function if exists public\.close_pending_daily_cash/i);
  });
});
