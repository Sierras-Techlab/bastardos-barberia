import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration020 = readFileSync(
  "supabase/queries/020_income_pricing_owner_commissions_and_employee_privacy.sql",
  "utf8",
).toLowerCase();
const repair032 = readFileSync(
  "supabase/queries/032_create_income_product_payment_total_repair.sql",
  "utf8",
).toLowerCase();

describe("migration 032 create-income product total repair", () => {
  it("calculates charged products before building the sale total", () => {
    const chargedTotal = migration020.indexOf("into product_charged");
    const saleTotal = migration020.indexOf("sale_total := service_charged + product_charged");

    expect(chargedTotal).toBeGreaterThan(-1);
    expect(chargedTotal).toBeLessThan(saleTotal);
  });

  it("patches only the canonical function and restores server-only execution", () => {
    expect(repair032).toContain("pg_get_functiondef(target_function)");
    expect(repair032).toContain("into product_charged");
    expect(repair032).not.toContain("create_income_v2");
    expect(repair032).toContain("from public, anon, authenticated");
    expect(repair032).toContain("to service_role");
  });
});
