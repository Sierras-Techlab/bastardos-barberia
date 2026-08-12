import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { IncomeMetrics } from "./income-metrics";

it("shows manager totals and explicit pending backend economics", () => {
  render(
    <IncomeMetrics
      metrics={{
        total: 874000,
        count: 42,
        average: 20810,
        cashTotal: 524000,
        transferTotal: 350000,
      }}
    />,
  );

  expect(screen.getByText(/874\.000/)).toBeVisible();
  expect(screen.getAllByText("Pendiente de backend")).toHaveLength(2);
  expect(screen.getByText("42")).toBeVisible();
});

it("shows commission and barbershop net when the V2 backend provides them", () => {
  render(<IncomeMetrics metrics={{ total: 100000, count: 4, average: 25000, cashTotal: 50000, transferTotal: 50000, commissionTotal: 42000, barbershopNet: 58000 }} />);
  expect(screen.getByText(/42\.000/)).toBeVisible();
  expect(screen.getByText(/58\.000/)).toBeVisible();
});

it("shows zero sales when there are no active incomes", () => {
  render(
    <IncomeMetrics
      metrics={{
        total: 0,
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
  render(<IncomeMetrics role="employee" metrics={{ total: 50000, count: 2, average: 25000, cashTotal: 50000, transferTotal: 0, commissionTotal: 22500 }} />);
  expect(screen.getByText("Total vendido")).toBeVisible();
  expect(screen.getByText("Mi comisión")).toBeVisible();
  expect(screen.queryByText("Neto barbería")).not.toBeInTheDocument();
});
