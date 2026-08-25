import { describe, expect, it } from "vitest";

import {
  cashDaySchema,
  cashHistoryQuerySchema,
  closeCashInputSchema,
  confirmCashInputSchema,
  openCashInputSchema,
  paginatedCashHistorySchema,
} from "@/lib/cash/schemas";

const id = "00000000-0000-4000-8000-000000000001";

const baseLifecycle = {
  openingBalance: 0,
  openingSource: "first_income",
  openedAt: "2026-08-14T12:00:00.000Z",
  openedBy: { id, firstName: "Uriel", lastName: "Alessandro" },
  expectedCash: 31000,
  countedCash: 30000,
  difference: -1000,
  closeMode: "automatic",
  reconciliationState: "pending_confirmation",
};

const cashDay = {
  id,
  businessDate: "2026-08-14",
  state: "closed",
  closedAt: "2026-08-15T03:00:00.000Z",
  lifecycle: baseLifecycle,
  summary: {
    salesGrossTotal: 31000,
    salesCommissionTotal: 7200,
    salesBarbershopNet: 23800,
    adjustmentGrossTotal: -13000,
    adjustmentCommissionTotal: -5850,
    adjustmentBarbershopNet: -7150,
    grossTotal: 18000,
    commissionTotal: 1350,
    barbershopNet: 16650,
    serviceTotal: 3000,
    productTotal: 15000,
    saleCount: 2,
    activeSaleCount: 1,
    voidedSaleCount: 1,
    adjustmentCount: 1,
  },
  payments: [
    {
      paymentMethodId: id,
      name: "Efectivo",
      salesAmount: 31000,
      adjustmentAmount: -13000,
      netAmount: 18000,
    },
  ],
  sales: [
    {
      id,
      createdAt: "2026-08-14T15:00:00.000Z",
      employee: { id, firstName: "Uriel", lastName: "Alessandro" },
      customerName: "Pedro Castañeda",
      kind: "combined",
      statusAtClose: "active",
      currentStatus: "voided",
      grossTotal: 31000,
      commissionTotal: 7200,
      barbershopNet: 23800,
    },
  ],
  adjustments: [
    {
      id,
      sourceIncomeId: id,
      originalBusinessDate: "2026-08-13",
      createdAt: "2026-08-14T18:00:00.000Z",
      createdBy: { id, firstName: "Lautaro", lastName: "Bastardos" },
      grossDelta: -13000,
      commissionDelta: -5850,
      barbershopNetDelta: -7150,
    },
  ],
};

describe("cashDaySchema", () => {
  it("accepts an internally reconciled closed cash snapshot", () => {
    expect(cashDaySchema.parse(cashDay)).toEqual(cashDay);
  });

  it("accepts a live manually opened register with its persisted ID", () => {
    const opened = {
      ...cashDay,
      state: "live",
      closedAt: null,
      lifecycle: {
        ...baseLifecycle,
        openingSource: "manual",
        countedCash: null,
        difference: null,
        closeMode: null,
        reconciliationState: "not_applicable",
      },
    };

    expect(cashDaySchema.safeParse(opened).success).toBe(true);
  });

  it("rejects unknown database keys", () => {
    expect(
      cashDaySchema.safeParse({ ...cashDay, internalNote: "hidden" }).success,
    ).toBe(false);
  });

  it("rejects broken gross, commission and net identities", () => {
    const invalid = {
      ...cashDay,
      summary: { ...cashDay.summary, barbershopNet: 1 },
    };

    expect(cashDaySchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects positive post-close adjustment deltas", () => {
    const invalid = {
      ...cashDay,
      adjustments: [{ ...cashDay.adjustments[0], grossDelta: 13000 }],
    };

    expect(cashDaySchema.safeParse(invalid).success).toBe(false);
  });
});

describe("cash lifecycle", () => {
  it("rejects counted cash with no difference", () => {
    const result = cashDaySchema.safeParse({
      ...cashDay,
      lifecycle: { ...baseLifecycle, countedCash: 1000, difference: null },
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched difference and counted cash", () => {
    const result = cashDaySchema.safeParse({
      ...cashDay,
      lifecycle: { ...baseLifecycle, countedCash: 30000, difference: 1000 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a confirmed state without counted cash", () => {
    const result = cashDaySchema.safeParse({
      ...cashDay,
      lifecycle: { ...baseLifecycle, countedCash: null, difference: null, reconciliationState: "confirmed" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts not_applicable lifecycle without close mode", () => {
    const lifecycle = {
      openingBalance: 0,
      openingSource: null,
      openedAt: null,
      openedBy: null,
      expectedCash: 0,
      countedCash: null,
      difference: null,
      closeMode: null,
      reconciliationState: "not_applicable",
    };
    expect(cashDaySchema.safeParse({ ...cashDay, lifecycle }).success).toBe(true);
  });
});

describe("cash input schemas", () => {
  it("rejects negative opening balance", () => {
    expect(openCashInputSchema.safeParse({ openingBalance: -1 }).success).toBe(false);
  });

  it("rejects negative counted cash on close or confirm", () => {
    expect(closeCashInputSchema.safeParse({ countedCash: -100 }).success).toBe(false);
    expect(confirmCashInputSchema.safeParse({ countedCash: -100 }).success).toBe(false);
  });

  it("accepts a zero opening balance and zero counted cash", () => {
    expect(openCashInputSchema.safeParse({ openingBalance: 0 }).success).toBe(true);
    expect(closeCashInputSchema.safeParse({ countedCash: 0 }).success).toBe(true);
    expect(confirmCashInputSchema.safeParse({ countedCash: 0 }).success).toBe(true);
  });
});

describe("cashHistoryQuerySchema", () => {
  it("normalizes pagination without accepting a browser-selected actor", () => {
    expect(
      cashHistoryQuerySchema.parse({ page: "2", pageSize: "10" }),
    ).toEqual({ page: 2, pageSize: 10 });
    expect(
      cashHistoryQuerySchema.safeParse({
        page: "1",
        pageSize: "10",
        actorId: id,
      }).success,
    ).toBe(false);
  });
});

describe("paginatedCashHistorySchema", () => {
  it("accepts the complete closed-day projection returned by list_daily_cash", () => {
    expect(
      paginatedCashHistorySchema.parse({
        items: [cashDay],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      }).items[0],
    ).toMatchObject({ id, state: "closed", payments: cashDay.payments });
  });
});
