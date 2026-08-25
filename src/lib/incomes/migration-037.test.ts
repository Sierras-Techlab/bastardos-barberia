import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSql = (name: string) =>
  readFileSync(join(process.cwd(), "supabase", "queries", name), "utf8").toLowerCase();

describe("income RPC overload cleanup", () => {
  it("removes legacy overloads from clean and upgraded installations", () => {
    for (const sql of [
      readSql("020_income_pricing_owner_commissions_and_employee_privacy.sql"),
      readSql("037_remove_legacy_income_overloads.sql"),
    ]) {
      expect(sql).toMatch(/drop function if exists public\.create_income\([\s\S]*uuid, jsonb, jsonb, boolean[\s\S]*\)/);
      expect(sql).toMatch(/drop function if exists public\.list_incomes\([\s\S]*date, date, text, text, text, text, integer, integer[\s\S]*\)/);
    }
  });

  it("reloads PostgREST after incremental cleanup", () => {
    expect(readSql("037_remove_legacy_income_overloads.sql")).toContain("notify pgrst, 'reload schema'");
  });
});
