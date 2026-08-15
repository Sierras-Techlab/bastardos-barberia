import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "queries",
  "017_product_category_deletion.sql",
);

const migration = () => readFileSync(migrationPath, "utf8");

describe("migration 017 product category deletion", () => {
  it("replaces unconditional protection with manager-only unused deletion", () => {
    const sql = migration();

    expect(sql).toMatch(
      /drop trigger if exists product_categories_prevent_delete/i,
    );
    expect(sql).toMatch(
      /create or replace function public\.delete_product_category/i,
    );
    expect(sql).toMatch(/role_id in \(1, 2\)/i);
    expect(sql).toMatch(
      /from public\.products[\s\S]*category_id = category_record\.id/i,
    );
    expect(sql).toContain("PRODUCT_CATEGORY_HAS_PRODUCTS");
    expect(sql).toMatch(/delete from public\.product_categories/i);
    expect(sql).toMatch(
      /grant execute on function public\.delete_product_category\(uuid, uuid\)[\s\S]*to service_role/i,
    );
    expect(sql).toContain("notify pgrst, 'reload schema'");
  });
});
