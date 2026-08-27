import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration020 = readFileSync(
  "supabase/queries/020_income_pricing_owner_commissions_and_employee_privacy.sql",
  "utf8",
).toLowerCase();
const repair031 = readFileSync(
  "supabase/queries/031_income_item_charged_subtotal_repair.sql",
  "utf8",
).toLowerCase();

describe("migration 031 charged subtotal repair", () => {
  it("removes the generated expression in clean and upgraded installations", () => {
    expect(migration020).toContain("alter column subtotal drop expression if exists");
    expect(repair031).toContain("alter column subtotal drop expression if exists");
  });

  it("reconciles legacy subtotal fields to the charged snapshot and permits zero", () => {
    for (const sql of [migration020, repair031]) {
      expect(sql).toContain("subtotal >= 0 and subtotal = charged_subtotal");
      expect(sql).toContain("line_subtotal >= 0");
      expect(sql).toContain("line_subtotal = charged_subtotal");
    }
  });

  it("does not rewrite historical income-item values", () => {
    expect(repair031).not.toMatch(/update\s+public\.income_items/);
    expect(repair031).not.toContain("delete from public.income_items");
  });
});
