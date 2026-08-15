import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "queries",
  "016_payment_methods.sql",
);

const migration = () => readFileSync(migrationPath, "utf8");

describe("migration 016 dynamic payment contract", () => {
  it("projects product availability before validating locked sale rows", () => {
    const sql = migration();

    expect(sql).toMatch(
      /for product_record in\s+select p\.id, p\.name, p\.price, p\.stock, p\.is_active, requested\.quantity,[\s\S]*?for update of p\s+loop[\s\S]*?if not product_record\.is_active then/,
    );
  });
});
