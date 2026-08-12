import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import mock from "@/data/incomes.mock.json";
import type { IncomeListData } from "@/types/income";
import { IncomeDetailSheet } from "./income-detail-sheet";

const data = mock as IncomeListData;

it("shows the complete read-only income detail", () => {
  const income = data.incomes.find(
    (item) => item.service && item.products.length > 0,
  );

  expect(income).toBeDefined();

  render(
    <IncomeDetailSheet
      income={income ?? null}
      open
      onOpenChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("heading", { name: /detalle del ingreso/i })).toBeVisible();
  expect(screen.getByText(income?.service?.name ?? "")).toBeVisible();
  expect(screen.getByText(/19\.000/)).toBeVisible();
  expect(
    screen.getByText(new RegExp(income?.products[0].name ?? "", "i")),
  ).toBeVisible();
  expect(screen.getByText(/transferencia|efectivo/i)).toBeVisible();
  expect(
    screen.getByText(
      `${income?.employee.firstName} ${income?.employee.lastName}`,
    ),
  ).toBeVisible();
  expect(screen.queryByRole("button", { name: /anular venta/i })).not.toBeInTheDocument();
  expect(screen.getByText(/solo lectura/i)).toBeVisible();
});

it("does not render content without a selected income", () => {
  render(
    <IncomeDetailSheet income={null} open={false} onOpenChange={vi.fn()} />,
  );

  expect(screen.queryByText(/detalle del ingreso/i)).not.toBeInTheDocument();
});
