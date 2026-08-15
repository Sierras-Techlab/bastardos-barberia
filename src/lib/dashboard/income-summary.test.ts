import { expect, it } from "vitest";

import { buildDashboardIncomeSummary, getBuenosAiresSevenDayRange } from "@/lib/dashboard/income-summary";
import type { IncomeListItem } from "@/types/income";

const cashId = "60000000-0000-4000-8000-000000000001";
const transferId = "60000000-0000-4000-8000-000000000002";
const cardId = "60000000-0000-4000-8000-000000000003";

const income = (overrides: Partial<IncomeListItem>): IncomeListItem => {
  const item = {
    id: crypto.randomUUID(),
    createdAt: "2026-08-12T15:00:00.000Z",
    businessDate: "2026-08-12",
    employee: { id: "employee-1", firstName: "Uriel", lastName: "Alessandro" },
    customer: null,
    service: null,
    products: [],
    total: 16000,
    status: "active" as const,
    ...overrides,
  };

  return {
    ...item,
    registeredBy: overrides.registeredBy ?? item.employee,
    payments: overrides.payments ?? [{ paymentMethodId: cashId, methodName: "Efectivo", amount: item.total }],
    commission: overrides.commission ?? { total: 0, barbershopNet: item.total },
  };
};

it("builds an exact seven-day Buenos Aires range", () => {
  expect(getBuenosAiresSevenDayRange(new Date("2026-08-13T01:30:00.000Z"))).toEqual({
    dateFrom: "2026-08-06",
    dateTo: "2026-08-12",
    dates: ["2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12"],
  });
});

it("summarizes active daily incomes, split payments and zero-value days", () => {
  const summary = buildDashboardIncomeSummary([
    income({ id: "income-1", total: 16000 }),
    income({ id: "income-2", total: 19000, payments: [{ paymentMethodId: cashId, methodName: "Efectivo", amount: 6000 }, { paymentMethodId: transferId, methodName: "Transferencia", amount: 7000 }, { paymentMethodId: cardId, methodName: "Tarjeta", amount: 6000 }] }),
    income({ id: "income-3", businessDate: "2026-08-10", total: 13000 }),
    income({ id: "income-4", status: "voided", total: 50000 }),
  ], "2026-08-12");

  expect(summary.today).toEqual({ total: 35000, count: 2, average: 17500, paymentTotals: [
    { paymentMethodId: cashId, name: "Efectivo", amount: 22000 },
    { paymentMethodId: transferId, name: "Transferencia", amount: 7000 },
    { paymentMethodId: cardId, name: "Tarjeta", amount: 6000 },
  ] });
  expect(summary.series).toHaveLength(7);
  expect(summary.series.find(({ date }) => date === "2026-08-10")).toMatchObject({ total: 13000, count: 1 });
  expect(summary.series.find(({ date }) => date === "2026-08-11")).toMatchObject({ total: 0, count: 0 });
});
