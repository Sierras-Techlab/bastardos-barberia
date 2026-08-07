import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import mock from "@/data/incomes.mock.json";
import type { IncomeListData } from "@/types/income";
import { IncomesView } from "./incomes-view";

const data = mock as IncomeListData;

it("combines metrics, filters and the income history", async () => {
  const user = userEvent.setup();

  render(<IncomesView data={data} />);

  expect(screen.getByText("Total facturado")).toBeVisible();
  expect(screen.getByRole("table", { name: /historial de ingresos/i })).toBeVisible();
  expect(screen.getByText(/24 movimientos/i)).toBeVisible();

  const target = data.incomes.find((income) => income.customer)?.customer;
  expect(target).toBeDefined();
  const matchingCount = data.incomes.filter(
    (income) => income.customer?.firstName === target?.firstName,
  ).length;

  await user.type(
    screen.getByRole("searchbox", { name: /buscar ingresos/i }),
    target?.firstName ?? "",
  );

  expect(
    screen.getByText(
      `${matchingCount} ${matchingCount === 1 ? "movimiento" : "movimientos"}`,
    ),
  ).toBeVisible();
  await user.click(screen.getAllByRole("button", { name: /abrir ingreso/i })[0]);
  expect(screen.getByRole("dialog", { name: /detalle del ingreso/i })).toBeVisible();
});

it("shows an actionable empty state when filters have no matches", async () => {
  const user = userEvent.setup();

  render(<IncomesView data={data} />);

  await user.type(
    screen.getByRole("searchbox", { name: /buscar ingresos/i }),
    "cliente inexistente",
  );

  expect(screen.getByText(/no encontramos ingresos/i)).toBeVisible();
  const clearButtons = screen.getAllByRole("button", {
    name: /limpiar filtros/i,
  });
  await user.click(clearButtons.at(-1)!);
  expect(screen.getByText(/24 movimientos/i)).toBeVisible();
});

it("limits employees to their own incomes", () => {
  const employeeData: IncomeListData = {
    ...data,
    currentUser: { ...data.employees[1], role: "employee" },
  };

  render(<IncomesView data={employeeData} />);

  const ownCount = data.incomes.filter(
    (income) => income.employee.id === employeeData.currentUser.id,
  ).length;

  expect(screen.getByText(`${ownCount} movimientos`)).toBeVisible();
  expect(
    screen.queryByRole("combobox", { name: /empleado/i }),
  ).not.toBeInTheDocument();
});
