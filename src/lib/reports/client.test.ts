import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReportApiError, reportClient } from "./client";

const emptyReport = {
  month: "2026-08", availableMonths: ["2026-08"], generatedAt: "2026-08-25T15:00:00Z",
  period: { from: "2026-08-01", to: "2026-08-25", elapsedDays: 25, daysInMonth: 31, isCurrentMonth: true },
  comparison: { month: "2026-07", from: "2026-07-01", to: "2026-07-25" },
  summary: { grossIncome: 0, commission: 0, barbershopNet: 0, expenses: 0, operatingResult: 0, operatingMarginBps: null },
  previousSummary: { grossIncome: 0, commission: 0, barbershopNet: 0, expenses: 0, operatingResult: 0, operatingMarginBps: null },
  projection: null,
  daily: [],
  incomeComposition: [{ key: "services", amount: 0 }, { key: "products", amount: 0 }, { key: "subscriptions", amount: 0 }],
  paymentComposition: [],
  expenseComposition: [{ key: "fixed", amount: 0 }, { key: "variable", amount: 0 }, { key: "supplies", amount: 0 }],
  serviceRanking: [], productRanking: [], highlights: { bestDay: null, worstDay: null },
};
const fetchMock = vi.fn<typeof fetch>();

describe("report client", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });

  it("loads an encoded month without browser caching", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: emptyReport }));
    await expect(reportClient.get("2026-08")).resolves.toEqual(emptyReport);
    expect(fetchMock).toHaveBeenCalledWith("/api/reports/business?month=2026-08", { cache: "no-store" });
  });

  it("preserves stable API failures", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: { code: "REPORT_RPC_OUTDATED", message: "Migración pendiente" } }, { status: 503 }));
    await expect(reportClient.get("2026-08")).rejects.toEqual(new ReportApiError(503, "REPORT_RPC_OUTDATED", "Migración pendiente"));
  });

  it("rejects extra fields in successful payloads", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: { ...emptyReport, employee: {} } }));
    await expect(reportClient.get("2026-08")).rejects.toThrow();
  });
});
