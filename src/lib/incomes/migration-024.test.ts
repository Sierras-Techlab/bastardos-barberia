import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "queries", "024_income_list_contract_repair.sql");

describe("migration 024 income list contract repair", () => {
  it("ships an incremental repair for databases that already installed 020", () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/^begin;/m);
    expect(sql).toContain("'paymentTotals'");
    expect(sql).toContain("'employeeCommissionTotal'");
    expect(sql).toContain("effective_can_view_all");
    expect(sql).toMatch(/coalesce\(ii\.service_id, ii\.product_id\)/i);
    expect(sql).toMatch(/commit;\s*$/);
  });
});
