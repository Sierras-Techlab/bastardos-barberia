import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repair028 = readFileSync(
  "supabase/queries/028_open_cash_projection_repair.sql",
  "utf8",
).toLowerCase();
const repair036 = readFileSync(
  "supabase/queries/036_live_cash_charged_projection_repair.sql",
  "utf8",
).toLowerCase();

describe("migration 036 live Caja projection repair", () => {
  it("supports both clean and upgraded financial helper names", () => {
    for (const sql of [repair028, repair036]) {
      expect(sql).toContain("public.cash_financial_day_as_json");
      expect(sql).toContain("public.cash_day_base_as_json");
      expect(sql).toContain("cash_financial_projection_missing");
    }
  });

  it("reconciles live line totals from charged item snapshots", () => {
    for (const sql of [repair028, repair036]) {
      expect(sql).toContain("sum(ii.charged_subtotal)");
      expect(sql).toContain("'{summary,servicetotal}'");
      expect(sql).toContain("'{summary,producttotal}'");
    }
  });

  it("restores the subscription kind overwritten by migration 028", () => {
    expect(repair036).toContain("i.source_type='fixed_subscription'");
    expect(repair036).toContain("to_jsonb('subscription'::text)");
  });

  it("uses the adjustment-aware expected cash helper", () => {
    for (const sql of [repair028, repair036]) {
      expect(sql).toContain("expected_value := public.current_cash_expected");
      expect(sql).not.toContain("register_record.opening_balance + coalesce(sum(ip.amount),0)");
    }
  });
});
