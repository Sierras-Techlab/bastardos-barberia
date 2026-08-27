import { describe, expect, it } from "vitest";

import { calculateDifference, differenceLabel, expectedPhysicalCash } from "@/lib/cash/reconciliation";
import type { CashPaymentTotal } from "@/types/cash";

const payment = (overrides: Partial<CashPaymentTotal>): CashPaymentTotal => ({
  paymentMethodId: "00000000-0000-4000-8000-000000000001",
  name: "Efectivo",
  salesAmount: 0,
  adjustmentAmount: 0,
  netAmount: 0,
  ...overrides,
});

describe("cash reconciliation", () => {
  it("computes expected physical cash from opening + Efectivo net", () => {
    const payments: CashPaymentTotal[] = [
      payment({ paymentMethodId: "00000000-0000-4000-8000-000000000001", netAmount: 12000 }),
      payment({ paymentMethodId: "00000000-0000-4000-8000-000000000002", name: "Transferencia", netAmount: 8000 }),
    ];
    expect(expectedPhysicalCash(5000, payments, "00000000-0000-4000-8000-000000000001")).toBe(17000);
  });

  it("ignores non-physical payment methods", () => {
    const payments: CashPaymentTotal[] = [
      payment({ paymentMethodId: "qr", name: "QR", netAmount: 15000 }),
      payment({ paymentMethodId: "transfer", name: "Transferencia", netAmount: 9000 }),
    ];
    expect(expectedPhysicalCash(2000, payments, "efectivo")).toBe(2000);
  });

  it("computes the difference between expected and counted cash", () => {
    expect(calculateDifference(17000, 17000)).toBe(0);
    expect(calculateDifference(17000, 16500)).toBe(-500);
    expect(calculateDifference(17000, 17500)).toBe(500);
  });

  it("labels differences in spanish", () => {
    expect(differenceLabel(null)).toBe("Sin conteo");
    expect(differenceLabel(0)).toBe("Sin diferencia");
    expect(differenceLabel(500)).toMatch(/Sobran/);
    expect(differenceLabel(-500)).toMatch(/Faltan/);
  });
});