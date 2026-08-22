import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));

import { cashRepository } from "@/lib/cash/repository";

const actorId = "00000000-0000-4000-8000-000000000001";
const cashId = "10000000-0000-4000-8000-000000000001";
const paymentMethodId = "60000000-0000-4000-8000-000000000001";

const summary = {
  salesGrossTotal: 16000,
  salesCommissionTotal: 7200,
  salesBarbershopNet: 8800,
  adjustmentGrossTotal: 0,
  adjustmentCommissionTotal: 0,
  adjustmentBarbershopNet: 0,
  grossTotal: 16000,
  commissionTotal: 7200,
  barbershopNet: 8800,
  serviceTotal: 16000,
  productTotal: 0,
  saleCount: 1,
  activeSaleCount: 1,
  voidedSaleCount: 0,
  adjustmentCount: 0,
};

const day = {
  id: cashId,
  businessDate: "2026-08-14",
  state: "closed",
  closedAt: "2026-08-15T03:00:00.000Z",
  lifecycle: {
    openingBalance: 0,
    openingSource: "first_income",
    openedAt: "2026-08-14T12:00:00.000Z",
    openedBy: { id: actorId, firstName: "Uriel", lastName: "Alessandro" },
    expectedCash: 16000,
    countedCash: 16000,
    difference: 0,
    closeMode: "automatic",
    reconciliationState: "confirmed",
  },
  summary,
  payments: [
    {
      paymentMethodId,
      name: "Efectivo",
      salesAmount: 16000,
      adjustmentAmount: 0,
      netAmount: 16000,
    },
  ],
  sales: [
    {
      id: cashId,
      createdAt: "2026-08-14T12:00:00.000Z",
      employee: { id: actorId, firstName: "Uriel", lastName: "Alessandro" },
      customerName: null,
      kind: "service",
      statusAtClose: "active",
      currentStatus: "active",
      grossTotal: 16000,
      commissionTotal: 7200,
      barbershopNet: 8800,
    },
  ],
  adjustments: [],
};

describe("cashRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps manager identity and filters to the authoritative cash RPCs", async () => {
    const history = {
      items: [
        {
          id: cashId,
          businessDate: day.businessDate,
          state: "closed",
          closedAt: day.closedAt,
          lifecycle: day.lifecycle,
          summary,
        },
      ],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    };
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: day, error: null })
      .mockResolvedValueOnce({ data: history, error: null });
    getSupabaseAdmin.mockReturnValue({ rpc });

    await expect(
      cashRepository.getDay(actorId, "2026-08-14"),
    ).resolves.toEqual(day);
    await expect(
      cashRepository.list(actorId, {
        dateFrom: "2026-08-01",
        dateTo: "2026-08-14",
        page: 1,
        pageSize: 12,
      }),
    ).resolves.toEqual(history);

    expect(rpc).toHaveBeenNthCalledWith(1, "get_daily_cash", {
      requesting_user_id: actorId,
      target_business_date: "2026-08-14",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "list_daily_cash", {
      requesting_user_id: actorId,
      filter_date_from: "2026-08-01",
      filter_date_to: "2026-08-14",
      page_number: 1,
      page_size: 12,
    });
  });

  it("returns null for a historical date without activity", async () => {
    getSupabaseAdmin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(
      cashRepository.getDay(actorId, "2026-08-01"),
    ).resolves.toBeNull();
  });

  it("rejects malformed database JSON instead of leaking it to the UI", async () => {
    getSupabaseAdmin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: { ...day, privateInternalValue: 12 },
        error: null,
      }),
    });

    await expect(
      cashRepository.getDay(actorId, day.businessDate),
    ).rejects.toThrow("No se pudo consultar la caja.");
  });

  it("maps database authorization and date sentinels to stable errors", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "MANAGER_REQUIRED", code: "42501" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "INVALID_CASH_DATE", code: "22023" },
      });
    getSupabaseAdmin.mockReturnValue({ rpc });

    await expect(
      cashRepository.getDay(actorId, day.businessDate),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(
      cashRepository.getDay(actorId, "2026-08-16"),
    ).rejects.toMatchObject({ code: "INVALID_CASH_DATE", status: 400 });
  });
});
