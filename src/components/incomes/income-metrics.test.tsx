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
        cashTotal: 524000,
        transferTotal: 350000,
      }}
    />,
  );

  expect(screen.getByText(/874\.000/)).toBeVisible();
  expect(screen.getByText(/174\.800/)).toBeVisible();
  expect(screen.getByText(/699\.200/)).toBeVisible();
  expect(screen.getByText("42")).toBeVisible();
});

it("shows commission and barbershop net", () => {
  render(<IncomeMetrics metrics={{ grossTotal: 100000, count: 4, average: 25000, cashTotal: 50000, transferTotal: 50000, commissionTotal: 42000, barbershopNet: 58000 }} />);
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
        cashTotal: 0,
        transferTotal: 0,
      }}
    />,
  );

  expect(screen.getByText("Ventas")).toBeVisible();
  expect(screen.getAllByText("0").length).toBeGreaterThan(0);
});

it("shows employee metrics without barbershop net", () => {
  render(<IncomeMetrics role="employee" metrics={{ grossTotal: 50000, count: 2, average: 25000, cashTotal: 50000, transferTotal: 0, commissionTotal: 22500, barbershopNet: 27500 }} />);
  expect(screen.getByText("Total vendido")).toBeVisible();
  expect(screen.getByText("Mi comisión")).toBeVisible();
  expect(screen.queryByText("Neto barbería")).not.toBeInTheDocument();
});
