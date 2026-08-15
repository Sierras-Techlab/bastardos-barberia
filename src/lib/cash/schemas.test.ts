import { describe, expect, it } from "vitest";

import {
  cashDaySchema,
  cashHistoryQuerySchema,
} from "@/lib/cash/schemas";

const id = "00000000-0000-4000-8000-000000000001";

const cashDay = {
  id,
  businessDate: "2026-08-14",
  state: "closed",
  closedAt: "2026-08-15T03:00:00.000Z",
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
