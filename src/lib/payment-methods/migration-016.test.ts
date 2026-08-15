import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "queries",
  "016_payment_methods.sql",
);

const incomeMigrationPath = join(
  process.cwd(),
  "supabase",
  "queries",
  "010_income_commissions_and_split_payments.sql",
);

const migration = () => readFileSync(migrationPath, "utf8");
const incomeMigration = () => readFileSync(incomeMigrationPath, "utf8");

describe("migration 016 dynamic payment contract", () => {
  it("projects product availability before validating locked sale rows", () => {
    const sql = migration();

    expect(sql).toMatch(
      /for product_record in\s+select p\.id, p\.name, p\.price, p\.stock, p\.is_active, requested\.quantity,[\s\S]*?for update of p\s+loop[\s\S]*?if not product_record\.is_active then/,
    );
  });

  it("installs and repairs the responsible role snapshot required by the sale RPC", () => {
    const initialSql = incomeMigration();
    const repairSql = migration();

    for (const sql of [initialSql, repairSql]) {
      expect(sql).toMatch(
        /add column if not exists responsible_role_snapshot text/,
      );
      expect(sql).toContain("responsible_role_snapshot = case responsible.role_id");
      expect(sql).toMatch(
        /alter column responsible_role_snapshot set not null/,
      );
    }
  });

  it("releases the legacy payment method column before dynamic payment inserts", () => {
    const sql = migration();
    const compatibilityRepair = sql.indexOf(
      "alter column method drop not null",
    );
    const dynamicIncomeFunction = sql.indexOf(
      "create or replace function public.create_income(",
    );

    expect(compatibilityRepair).toBeGreaterThan(-1);
    expect(compatibilityRepair).toBeLessThan(dynamicIncomeFunction);
  });
});
