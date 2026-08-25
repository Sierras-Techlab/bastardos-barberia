import { expect, it } from "vitest";
import { buildIncomeMetricCards } from "./income-metric-cards";

const managerMetrics = { grossTotal: 100000, count: 4, average: 25000, paymentTotals: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", name: "Efectivo", amount: 100000 }], commissionTotal: 42000, barbershopNet: 58000 };

const employeeMetrics = { count: 4, employeeCommissionTotal: 42000 };

it("uses the authoritative gross total for managers", () => {
  const cards = buildIncomeMetricCards(managerMetrics, "owner");
  expect(cards[0].value).toContain("100.000");
});

it("builds employee sales metrics from the sanitized employeeCommissionTotal without leaking gross or net", () => {
  const cards = buildIncomeMetricCards(employeeMetrics, "employee");
  expect(cards.map((card) => card.label)).toEqual(["Tu ingreso", "Ventas", "Tu ganancia promedio"]);
  expect(cards.some((card) => card.label === "Neto barbería")).toBe(false);
  expect(cards.some((card) => card.label === "Facturación bruta")).toBe(false);
  expect(cards[0].value).toContain("42.000");
});

it("builds manager business metrics", () => {
  expect(buildIncomeMetricCards(managerMetrics, "owner").map((card) => card.label)).toEqual(["Facturación bruta", "Comisiones", "Neto barbería", "Ventas"]);
});

it("formats zero-valued canonical economics", () => {
  const cards = buildIncomeMetricCards({ ...managerMetrics, commissionTotal: 0, barbershopNet: 0 }, "admin");
  expect(cards[1].value).toMatch(/0/);
  expect(cards[2].value).toMatch(/0/);
});
