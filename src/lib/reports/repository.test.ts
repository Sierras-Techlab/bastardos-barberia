import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));

import { reportRepository } from "./repository";

const report = {
  month: "2026-08",
  generatedAt: "2026-08-25T15:00:00Z",
  period: { from: "2026-08-01", to: "2026-08-25", elapsedDays: 25, daysInMonth: 31, isCurrentMonth: true },
  comparison: { month: "2026-07", from: "2026-07-01", to: "2026-07-25" },
  summary: { grossIncome: 0, commission: 0, barbershopNet: 0, expenses: 0, operatingResult: 0, operatingMarginBps: null },
  previousSummary: { grossIncome: 0, commission: 0, barbershopNet: 0, expenses: 0, operatingResult: 0, operatingMarginBps: null },
  projection: { grossIncome: 0, commission: 0, barbershopNet: 0, expenses: 0, operatingResult: 0, operatingMarginBps: null },
  daily: [{ day: 1, selected: { grossIncome: 0, expenses: 0, operatingResult: 0 }, previous: { grossIncome: 0, expenses: 0, operatingResult: 0 } }],
  incomeComposition: [{ key: "services", amount: 0 }, { key: "products", amount: 0 }, { key: "subscriptions", amount: 0 }],
  paymentComposition: [],
  expenseComposition: [{ key: "fixed", amount: 0 }, { key: "variable", amount: 0 }, { key: "supplies", amount: 0 }],
  serviceRanking: [], productRanking: [], highlights: { bestDay: null, worstDay: null },
};

describe("report repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls the canonical RPC with only server-owned actor identity and month", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: report, error: null });
    getSupabaseAdmin.mockReturnValue({ rpc });

    await expect(reportRepository.get("00000000-0000-4000-8000-000000000001", "2026-08")).resolves.toEqual(report);
    expect(rpc).toHaveBeenCalledWith("get_business_report", {
      actor_user_id: "00000000-0000-4000-8000-000000000001",
      target_month: "2026-08",
    });
  });

  it.each([
    ["REPORT_MONTH_FUTURE", "REPORT_MONTH_FUTURE", 400, undefined],
    ["MANAGER_REQUIRED", "FORBIDDEN", 403, undefined],
    ["function missing", "REPORT_RPC_OUTDATED", 503, "PGRST202"],
  ])("maps %s without exposing database details", async (message, code, status, dbCode) => {
    getSupabaseAdmin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message, code: dbCode } }) });
    await expect(reportRepository.get("00000000-0000-4000-8000-000000000001", "2026-08"))
      .rejects.toMatchObject({ code, status });
  });

  it("rejects a malformed successful projection", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    getSupabaseAdmin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: { ...report, employee: {} }, error: null }) });
    await expect(reportRepository.get("00000000-0000-4000-8000-000000000001", "2026-08"))
      .rejects.toThrow("No se pudo completar la consulta de reportes.");
  });
});
