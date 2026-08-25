import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration020 = readFileSync(
  "supabase/queries/020_income_pricing_owner_commissions_and_employee_privacy.sql",
  "utf8",
).toLowerCase();
const repair034 = readFileSync(
  "supabase/queries/034_create_income_complete_flow_repair.sql",
  "utf8",
).toLowerCase();

describe("migration 034 complete income flow repair", () => {
  it("marks only actually overridden product lines", () => {
    expect(migration020).toContain("when override_entry.value is null then null");
    expect(repair034).toContain("when override_entry.value is null then null");
  });

  it("reconciles catalog bases with gross total and allows authorized zero prices", () => {
    for (const sql of [migration020, repair034]) {
      expect(sql).toContain("service_commission_base + product_commission_base = gross_total");
      expect(sql).toContain("incomes_total_check check (total >= 0)");
      expect(sql).toContain("income_items_price_check check (unit_price >= 0)");
    }
  });

  it("locks and validates every active payment method", () => {
    expect(migration020).toContain("for share of pm");
    expect(migration020).toContain("found_payment_count <> requested_payment_count");
    expect(migration020).toContain("payment_method_not_available");
    expect(repair034).toContain("payment_method_not_available");
  });

  it("rejects percentage splits that produce non-positive payment rows", () => {
    for (const sql of [migration020, repair034]) {
      expect(sql).toContain("if iteration_amount <= 0 then");
    }
  });

  it("preserves the canonical function and server-only permissions", () => {
    expect(repair034).toContain("pg_get_functiondef(target_function)");
    expect(repair034).not.toContain("create_income_v2");
    expect(repair034).toContain("from public, anon, authenticated");
    expect(repair034).toContain("to service_role");
  });
});
