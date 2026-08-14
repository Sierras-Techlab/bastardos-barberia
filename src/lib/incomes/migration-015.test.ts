import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, expectTypeOf, it } from "vitest";

import type { IncomeItemRow } from "@/lib/supabase/database.types";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "queries",
  "015_product_item_commissions.sql",
);

const migration = () => readFileSync(migrationPath, "utf8");

describe("migration 015 item commission contract", () => {
  it("exposes the persisted item snapshot fields to server adapters", () => {
    expectTypeOf<IncomeItemRow>().toHaveProperty("line_subtotal");
    expectTypeOf<IncomeItemRow>().toHaveProperty("commission_rate");
    expectTypeOf<IncomeItemRow>().toHaveProperty("commission_amount");
    expectTypeOf<IncomeItemRow>().toHaveProperty("full_commission");
    expectTypeOf<IncomeItemRow>().toHaveProperty(
      "full_commission_authorized_by",
    );
  });

  it("installs immutable item snapshots in one transaction", () => {
    const sql = migration();

    expect(sql).toMatch(/^begin;/m);
    expect(sql).toMatch(/commit;\s*$/);
    for (const column of [
      "line_subtotal",
      "commission_rate",
      "commission_amount",
      "full_commission",
      "full_commission_authorized_by",
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain("INCOME_ITEM_COMMISSION_BACKFILL_MISMATCH");
  });

  it("promotes the canonical sale RPC and includes product flags in idempotency", () => {
    const sql = migration();

    expect(sql).toMatch(/create function public\.create_income\s*\(/);
    expect(sql).toContain("grantFullCommission");
    expect(sql).toContain("INVALID_PRODUCT_COMMISSION_OVERRIDE");
    expect(sql).toContain("'products', normalized_products");
    expect(sql).toMatch(/drop function public\.create_income_v2\s*\(/);
  });

  it("returns itemized commission JSON and grants only the canonical RPC", () => {
    const sql = migration();

    expect(sql).toContain("'commission', jsonb_build_object(");
    expect(sql).toContain("'subtotal', ii.line_subtotal");
    expect(sql).toContain("'fullCommission', ii.full_commission");
    expect(sql).toMatch(
      /grant execute on function public\.create_income\([\s\S]*?\)\s+to service_role;/,
    );
    expect(sql).toMatch(
      /revoke execute on function public\.create_income\([\s\S]*?\)\s+from public, anon, authenticated;/,
    );
  });
});
