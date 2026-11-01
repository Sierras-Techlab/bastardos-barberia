import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { IncomeFilters } from "./income-filters";
import type { IncomeListFilters } from "@/types/income";

const filters: IncomeListFilters = { dateFrom: "2026-10-13", dateTo: "2026-10-16", query: "Milton", employeeId: "employee-1", paymentMethodId: "cash", kind: "service" };
const employees = [{ id: "employee-1", firstName: "Milton", lastName: "Delich" }];
const paymentMethods = [{ id: "cash", name: "Efectivo", isActive: true }];

it("shows the complete filter scope and resets only the concept when rentals are excluded", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<IncomeFilters role="owner" value={filters} employees={employees} paymentMethods={paymentMethods} onChange={onChange} onClear={vi.fn()} canClear />);
  const scope = screen.getByRole("region", { name: "Qué incluyen estos importes" });
  expect(scope).toHaveTextContent("Milton Delich");
  expect(scope).toHaveTextContent(/13.*oct.*2026/);
  expect(scope).toHaveTextContent(/16.*oct.*2026/);
  expect(scope).toHaveTextContent("Solo servicios");
  expect(scope).toHaveTextContent("Efectivo");
  expect(scope).toHaveTextContent("Búsqueda: Milton");
  expect(scope).toHaveTextContent("Este filtro no incluye alquileres de silla");
  expect(scope).toHaveTextContent("Los importes muestran el total de esas operaciones");
  await user.click(within(scope).getByRole("button", { name: "Ver todos los conceptos" }));
  expect(onChange).toHaveBeenCalledWith({ ...filters, kind: "all" });
});

it("does not offer rentals or unsupported monthly filters to an employee", async () => {
  const user = userEvent.setup();
  render(<IncomeFilters role="employee" value={{ ...filters, employeeId: "", kind: "all" }} employees={employees} paymentMethods={paymentMethods} onChange={vi.fn()} onClear={vi.fn()} canClear />);
  await user.click(screen.getByRole("button", { name: "Más filtros" }));
  expect(screen.queryByRole("option", { name: "Alquiler de silla" })).not.toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Mensualidades" })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Empleado" })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Qué incluyen estos importes" })).toHaveTextContent("Tus ventas");
  expect(screen.getByRole("region", { name: "Qué incluyen estos importes" })).not.toHaveTextContent("Los importes muestran el total");
  expect(screen.getByRole("region", { name: "Qué incluyen estos importes" })).toHaveTextContent("Tu comisión");
});
