import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/queries/027_expense_void_contract_repair.sql", "utf8").toLowerCase();

describe("migration 027", () => {
  it("promotes only the optimistic expense void contract", () => {
    expect(sql).toContain("drop function if exists public.void_expense(uuid, uuid, text)");
    expect(sql).toContain("expected_updated_at timestamptz");
    expect(sql).toContain("old_expense.updated_at <> expected_updated_at");
    expect(sql).toContain("message = 'expense_conflict'");
    expect(sql).toContain("void_reason = trim($4)");
    expect(sql).not.toContain("void_reason = trim(void_reason)");
    expect(sql).toContain("insert into public.expense_revisions");
    expect(sql).toContain("to service_role");
  });

  it("does not touch incomes or cash registers", () => {
    expect(sql).not.toContain("update public.incomes");
    expect(sql).not.toContain("daily_cash_registers");
  });
});
