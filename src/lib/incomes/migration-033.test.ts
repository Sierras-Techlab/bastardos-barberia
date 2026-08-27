import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration020 = readFileSync(
  "supabase/queries/020_income_pricing_owner_commissions_and_employee_privacy.sql",
  "utf8",
).toLowerCase();
const repair033 = readFileSync(
  "supabase/queries/033_create_income_product_price_type_repair.sql",
  "utf8",
).toLowerCase();

describe("migration 033 create-income product price type repair", () => {
  it("casts both JSON prices used by integer snapshot columns", () => {
    expect(migration020).toContain(
      "(row->>'price')::integer, (row->>'price')::integer, line_charged",
    );
  });

  it("patches the canonical function without creating a versioned contract", () => {
    expect(repair033).toContain("pg_get_functiondef(target_function)");
    expect(repair033).toContain("(row->>''price'')::integer");
    expect(repair033).not.toContain("create_income_v2");
    expect(repair033).toContain("to service_role");
  });
});
