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
    expect(sql).toMatch(/customer_id is not null/i);
  });

  it("promotes canonical list_customers without _v2", () => {
    expect(sql).toMatch(/create or replace function public\.list_customers/i);
    expect(sql).not.toMatch(/create or replace function public\.get_customer_visits/i);
    expect(sql).toMatch(/'lastVisitBusinessDate'/);
  });

  it("rejects unauthorized actors before reading customers", () => {
    expect(sql).toMatch(/INVALID_ACTOR/);
  });

  it("ignores fixed-subscription incomes and voids when deriving the last visit", () => {
    const listBody = sql.match(/create or replace function public\.list_customers[\s\S]+?return result;\s+end;/i)?.[0] ?? "";
    expect(listBody).toMatch(/i\.status\s*=\s*'active'/i);
    expect(listBody).toMatch(/i\.source_type\s*=\s*'sale'/i);
    expect(listBody).toMatch(/i\.customer_id\s+is\s+not\s+null/i);
  });

  it("picks the newest active normal sale per customer with distinct on plus ordered business_date and created_at", () => {
    expect(sql).toMatch(/distinct on \(i\.customer_id\)/i);
    expect(sql).toMatch(/order by i\.customer_id, i\.business_date desc, i\.created_at desc/i);
  });

  it("returns NULL lastVisitBusinessDate when the customer has no active normal sales", () => {
    expect(sql).toMatch(/left join latest_sale ls on ls\.customer_id = c\.id/i);
  });

  it("projects the last visit through the America/Argentina/Buenos_Aires business_date", () => {
    expect(sql).toMatch(/business_date at time zone 'America\/Argentina\/Buenos_Aires'/i);
    expect(sql).toMatch(/YYYY-MM-DD/i);
  });

  it("keeps fixed subscriptions out of paginated visit history", () => {
    const visitsBody = sql.match(/create or replace function public\.list_customer_visits[\s\S]+?return result;\s+end;/i)?.[0] ?? "";

    expect(visitsBody).toMatch(/i\.status\s*=\s*'active'/i);
    expect(visitsBody).toMatch(/i\.source_type\s*=\s*'sale'/i);
  });

  it("decrements the visit counter only when voiding a normal sale", () => {
    const voidBody = sql.match(/create or replace function public\.void_income[\s\S]+?return income_record\.id;\s+end;/i)?.[0] ?? "";

    expect(voidBody).toMatch(/select id, customer_id, status, source_type into income_record/i);
    expect(voidBody).toMatch(/income_record\.source_type = 'sale'[\s\S]+set visits = greatest\(visits - 1, 0\)/i);
  });
});
