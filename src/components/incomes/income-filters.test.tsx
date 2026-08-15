import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { IncomeListFilters } from "@/types/income";
import { IncomeFilters } from "./income-filters";

const filters: IncomeListFilters = {
  query: "",
  dateFrom: "2026-08-01",
  dateTo: "2026-08-31",
  employeeId: "",
  paymentMethodId: "all",
  kind: "all",
};

const employees = [
  { id: "employee-lautaro", firstName: "Lautaro", lastName: "Bastardos" },
  { id: "employee-fer", firstName: "Fernanda", lastName: "Pérez" },
];
const paymentMethods = [
  { id: "60000000-0000-4000-8000-000000000001", name: "Efectivo", isActive: true },
  { id: "60000000-0000-4000-8000-000000000003", name: "Crédito histórico", isActive: false },
];

it("updates search and owner-only filters with complete values", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();

  render(
    <IncomeFilters
      role="owner"
      employees={employees}
      paymentMethods={paymentMethods}
      value={filters}
      onChange={onChange}
      onClear={vi.fn()}
      canClear={false}
    />,
  );

  await user.type(
    screen.getByRole("searchbox", { name: /buscar ingresos/i }),
    "tomas",
  );
  expect(onChange).toHaveBeenLastCalledWith({ ...filters, query: "s" });

  await user.selectOptions(
    screen.getByRole("combobox", { name: /empleado/i }),
    "employee-fer",
  );
  expect(onChange).toHaveBeenLastCalledWith({
    ...filters,
    employeeId: "employee-fer",
  });

  await user.selectOptions(
    screen.getByRole("combobox", { name: /medio de pago/i }),
    paymentMethods[1].id,
  );
  expect(onChange).toHaveBeenLastCalledWith({
    ...filters,
    paymentMethodId: paymentMethods[1].id,
  });
});

it("hides the employee filter from employees and clears active filters", async () => {
  const onClear = vi.fn();
  const user = userEvent.setup();

  render(
    <IncomeFilters
      role="employee"
      employees={employees}
      paymentMethods={paymentMethods}
      value={{ ...filters, kind: "products" }}
      onChange={vi.fn()}
      onClear={onClear}
      canClear
    />,
  );

  expect(
    screen.queryByRole("combobox", { name: /empleado/i }),
  ).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /limpiar filtros/i }));
  expect(onClear).toHaveBeenCalledOnce();
});

it("opens the compact mobile filters", async () => {
  const user = userEvent.setup();

  render(
    <IncomeFilters
      role="owner"
      employees={employees}
      paymentMethods={paymentMethods}
      value={filters}
      onChange={vi.fn()}
      onClear={vi.fn()}
      canClear={false}
    />,
  );

  await user.click(screen.getByRole("button", { name: /^filtrar$/i }));

  expect(
    screen.getByRole("dialog", { name: /filtros de ingresos/i }),
  ).toBeVisible();
});
