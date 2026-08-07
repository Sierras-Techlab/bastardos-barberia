import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { IncomeMetrics } from "./income-metrics";

it("shows totals, sales average and payment distribution", () => {
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
  expect(screen.getByText("42")).toBeVisible();
  expect(screen.getByText(/20\.810/)).toBeVisible();
  expect(screen.getByText(/60% efectivo/i)).toBeVisible();
  expect(screen.getByText(/40% transferencia/i)).toBeVisible();
});

it("shows a zero distribution when there are no active incomes", () => {
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

  expect(screen.getByText(/0% efectivo/i)).toBeVisible();
  expect(screen.getByText(/0% transferencia/i)).toBeVisible();
});
