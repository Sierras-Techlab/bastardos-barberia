import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { IncomeMetrics } from "./income-metrics";

it("shows canonical manager economics", () => {
  render(
    <IncomeMetrics
      metrics={{
        grossTotal: 874000,
        commissionTotal: 174800,
        barbershopNet: 699200,
        count: 42,
        average: 20810,
        paymentTotals: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", name: "Efectivo", amount: 874000 }],
      }}
    />,
  );

  expect(screen.getByText(/874\.000/)).toBeVisible();
  expect(screen.getByText(/174\.800/)).toBeVisible();
  expect(screen.getByText(/699\.200/)).toBeVisible();
  expect(screen.getByText("42")).toBeVisible();
});

it("shows commission and barbershop net", () => {
  render(<IncomeMetrics metrics={{ grossTotal: 100000, count: 4, average: 25000, paymentTotals: [], commissionTotal: 42000, barbershopNet: 58000 }} />);
  expect(screen.getByText(/42\.000/)).toBeVisible();
  expect(screen.getByText(/58\.000/)).toBeVisible();
});

it("shows zero sales when there are no active incomes", () => {
  render(
    <IncomeMetrics
      metrics={{
        grossTotal: 0,
        commissionTotal: 0,
        barbershopNet: 0,
        count: 0,
        average: 0,
        paymentTotals: [],
      }}
    />,
  );

  expect(screen.getByText("Ventas")).toBeVisible();
  expect(screen.getAllByText("0").length).toBeGreaterThan(0);
});

it("shows employee metrics from the sanitized employeeCommissionTotal and never leaks manager totals", () => {
  render(<IncomeMetrics role="employee" metrics={{ count: 2, employeeCommissionTotal: 10000 }} />);
  expect(screen.getByText("Tu ingreso")).toBeVisible();
  expect(screen.getByText("Tu ganancia promedio")).toBeVisible();
  expect(screen.queryByText("Neto barbería")).not.toBeInTheDocument();
  expect(screen.queryByText("Facturación bruta")).not.toBeInTheDocument();
  expect(screen.queryByText("Mi comisión")).not.toBeInTheDocument();
});
