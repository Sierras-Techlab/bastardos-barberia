import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/queries/047_income_free_customer_name.sql", "utf8");

describe("migration 047 free customer names", () => {
  it("stores a trimmed bounded name and enforces mutual exclusion on the income row", () => {
    expect(sql).toMatch(/add column if not exists customer_name text/i);
    expect(sql).toMatch(/customer_id is not null and customer_name is not null/i);
    expect(sql).toMatch(/length\(customer_name\) between 1 and 80/i);
    expect(sql).toMatch(/btrim\(selected_customer_name, E'/i);
  });

  it("serializes retries and rejects reuse of the request id with a different free name", () => {
    expect(sql).toMatch(/pg_advisory_xact_lock[\s\S]*income-free-customer/);
    expect(sql).toMatch(/prior_name is distinct from normalized_name/);
    expect(sql).toMatch(/INCOME_REQUEST_CONFLICT/);
    expect(sql).toMatch(/public\.create_income\([\s\S]*product_price_overrides\s*\n\s*\)/);
  });

  it("adds the free name to both role projections and server-side search before pagination", () => {
    expect(sql).toMatch(/income_as_json_047_base[\s\S]*'customerName', i\.customer_name/i);
    expect(sql).toMatch(/income_as_employee_json_047_base[\s\S]*'customerName', i\.customer_name/i);
    expect(sql).toMatch(/normalize_catalog_name\(coalesce\(i\.customer_name,[\s\S]*normalized_query/i);
  });
});
