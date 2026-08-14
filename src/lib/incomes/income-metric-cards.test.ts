import { expect, it } from "vitest";
import { buildIncomeMetricCards } from "./income-metric-cards";

const metrics = { grossTotal: 100000, count: 4, average: 25000, cashTotal: 50000, transferTotal: 50000, commissionTotal: 42000, barbershopNet: 58000 };

it("uses the authoritative gross total", () => {
  const cards = buildIncomeMetricCards(metrics, "owner");
  expect(cards[0].value).toContain("100.000");
});

it("builds employee sales metrics without barbershop net", () => {
  const cards = buildIncomeMetricCards(metrics, "employee");
  expect(cards.map((card) => card.label)).toEqual(["Total vendido", "Mi comisión", "Ventas", "Promedio por venta"]);
  expect(cards.some((card) => card.label === "Neto barbería")).toBe(false);
});

it("builds manager business metrics", () => {
  expect(buildIncomeMetricCards(metrics, "owner").map((card) => card.label)).toEqual(["Facturación bruta", "Comisiones", "Neto barbería", "Ventas"]);
});

it("formats zero-valued canonical economics", () => {
  const cards = buildIncomeMetricCards({ ...metrics, commissionTotal: 0, barbershopNet: 0 }, "admin");
  expect(cards[1].value).toMatch(/0/);
  expect(cards[2].value).toMatch(/0/);
});
