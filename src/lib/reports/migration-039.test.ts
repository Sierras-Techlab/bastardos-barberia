import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/queries/039_business_reports.sql", "utf8");

describe("migration 039 business reports", () => {
  it("installs one canonical manager-only report RPC", () => {
    expect(sql).toMatch(/create or replace function public\.get_business_report\([\s\S]*actor_user_id uuid,[\s\S]*target_month text[\s\S]*\)/i);
    expect(sql).toContain("perform public.assert_expense_manager(actor_user_id)");
    expect(sql).toContain("REPORT_MONTH_INVALID");
    expect(sql).toContain("REPORT_MONTH_FUTURE");
  });

  it("uses authoritative active financial snapshots without Caja", () => {
    expect(sql).toContain("i.status = 'active'");
    expect(sql).toContain("e.status = 'active'");
    expect(sql).toContain("i.commission_total");
    expect(sql).toContain("i.barbershop_net");
    expect(sql).toContain("ii.charged_subtotal");
    expect(sql).toContain("ii.item_type in ('service', 'product')");
    expect(sql).not.toMatch(/daily_cash_(registers|sales|adjustments)/);
  });

  it("uses Buenos Aires equivalent periods and complete generated days", () => {
    expect(sql).toContain("America/Argentina/Buenos_Aires");
    expect(sql).toContain("generate_series(1, selected_elapsed_days)");
    expect(sql).toContain("comparison_month_end");
    expect(sql).toContain("selected_month_end");
  });

  it("groups immutable snapshots and orders rankings deterministically", () => {
    expect(sql).toContain("ip.method_name_snapshot");
    expect(sql).toContain("ii.name_snapshot");
    expect(sql).toContain("extensions.digest");
    expect(sql).toMatch(/order by x\.amount desc, x\.name asc, x\.id asc/);
  });

  it("combines responsible-user economics with attendance overlap", () => {
    expect(sql).toContain("'teamPerformance'");
    expect(sql).toContain("public.employee_work_sessions");
    expect(sql).toContain("i.outside_work_session");
    expect(sql).toContain("i.employee_id");
    expect(sql).toContain("worked_minutes");
    expect(sql).toContain("extract(epoch from");
    expect(sql).not.toContain("pg_catalog.extract(epoch from");
    expect(sql).toMatch(/order by[\s\S]*current_gross desc[\s\S]*display_name asc[\s\S]*user_id asc/i);
  });

  it("returns the strict camelCase projection and safe grants", () => {
    for (const key of ["availableMonths", "generatedAt", "previousSummary", "operatingMarginBps", "incomeComposition", "paymentComposition", "expenseComposition", "serviceRanking", "productRanking", "teamPerformance", "bestDay", "worstDay"]) {
      expect(sql).toContain(`'${key}'`);
    }
    expect(sql).toMatch(/revoke all on function public\.get_business_report\(uuid, text\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.get_business_report\(uuid, text\) to service_role/i);
  });
});
