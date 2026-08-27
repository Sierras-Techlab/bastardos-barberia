import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase", "queries", "038_cash_close_charged_snapshot_repair.sql"),
  "utf8",
).toLowerCase();

describe("cash close charged snapshot repair", () => {
  it("routes manual and automatic closure through the charged snapshot helper", () => {
    expect(sql.match(/perform public\.snapshot_daily_cash\([^;]+\);/g)).toHaveLength(2);
    expect(sql).toContain("create or replace function public.close_daily_cash");
    expect(sql).toContain("create or replace function public.close_pending_daily_cash");
  });

  it("backfills the canonical expected-cash helper for upgraded databases", () => {
    expect(sql).toContain("create or replace function public.current_cash_expected");
    expect(sql).toContain("pm.system_code = 'cash'");
  });

  it("allows audited zero-total sales in closure snapshots", () => {
    expect(sql).toMatch(/daily_cash_sales_economics_check[\s\S]*gross_total >= 0/);
    expect(sql).not.toMatch(/daily_cash_sales_economics_check[\s\S]*gross_total > 0/);
  });

  it("removes the obsolete lifecycle-bearing snapshot overload", () => {
    expect(sql).toContain("drop function if exists public.snapshot_daily_cash(uuid, date, text, bigint)");
  });
});
