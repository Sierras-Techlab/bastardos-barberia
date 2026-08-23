import { describe, expect, it } from "vitest";

import {
  cashDaySchema,
  cashHistoryQuerySchema,
  closeCashInputSchema,
  confirmCashInputSchema,
  openCashInputSchema,
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

  it("accepts an open persisted register with no closure yet", () => {
    const lifecycle = {
      openingBalance: 0,
      openingSource: "first_income" as const,
      openedAt: "2026-08-15T12:00:00.000Z",
      openedBy: { id: "00000000-0000-4000-8000-000000000001", firstName: "Lautaro", lastName: "Bastardos" },
      expectedCash: 0,
      countedCash: null,
      difference: null,
      closeMode: null,
      reconciliationState: "not_applicable" as const,
    };
    const openPersisted = {
      id: null,
      businessDate: "2026-08-15",
      state: "live" as const,
      closedAt: null,
      lifecycle,
      summary: {
        salesGrossTotal: 0,
        salesCommissionTotal: 0,
        salesBarbershopNet: 0,
        adjustmentGrossTotal: 0,
        adjustmentCommissionTotal: 0,
        adjustmentBarbershopNet: 0,
        grossTotal: 0,
        commissionTotal: 0,
        barbershopNet: 0,
        serviceTotal: 0,
        productTotal: 0,
        saleCount: 0,
        activeSaleCount: 0,
        voidedSaleCount: 0,
        adjustmentCount: 0,
      },
      payments: [],
      sales: [],
      adjustments: [],
    };
    expect(cashDaySchema.safeParse(openPersisted).success).toBe(true);
  });

  it("accepts a manual confirmed close with zero or non-zero difference", () => {
    const lifecycle = {
      openingBalance: 0,
      openingSource: "manual" as const,
      openedAt: "2026-08-15T12:00:00.000Z",
      openedBy: { id: "00000000-0000-4000-8000-000000000001", firstName: "Lautaro", lastName: "Bastardos" },
      expectedCash: 16500,
      countedCash: 16500,
      difference: 0,
      closeMode: "manual" as const,
      reconciliationState: "confirmed" as const,
    };
    const manualConfirmedClose = { ...cashDay, lifecycle };
    expect(cashDaySchema.safeParse(manualConfirmedClose).success).toBe(true);
  });

  it("accepts an automatic pending close without counted cash", () => {
    const lifecycle = {
      openingBalance: 0,
      openingSource: "first_income" as const,
      openedAt: "2026-08-15T12:00:00.000Z",
      openedBy: { id: "00000000-0000-4000-8000-000000000001", firstName: "Lautaro", lastName: "Bastardos" },
      expectedCash: 0,
      countedCash: null,
      difference: null,
      closeMode: "automatic" as const,
      reconciliationState: "pending_confirmation" as const,
    };
    const automaticPendingClose = { ...cashDay, lifecycle };
    expect(cashDaySchema.safeParse(automaticPendingClose).success).toBe(true);
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
