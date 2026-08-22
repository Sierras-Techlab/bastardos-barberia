import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase", "queries", "023_customer_last_visit.sql"), "utf8");

describe("migration 023 customer last visit", () => {
  it("does not introduce version-suffixed objects", () => {
    expect(sql).not.toMatch(/_v2/i);
  });

  it("adds a partial index on active normal sales per customer", () => {
    expect(sql).toMatch(/create index if not exists incomes_active_sale_customer_business_idx/i);
    expect(sql).toMatch(/where status = 'active'/i);
    expect(sql).toMatch(/source_type = 'sale'/i);
  });

  it("promotes canonical list_customers and get_customer_visits without _v2", () => {
    expect(sql).toMatch(/create or replace function public\.list_customers/i);
    expect(sql).toMatch(/create or replace function public\.get_customer_visits/i);
    expect(sql).toMatch(/'lastVisitBusinessDate'/);
  });

  it("rejects unauthorized actors before reading customers", () => {
    expect(sql).toMatch(/INVALID_ACTOR/);
  });
});