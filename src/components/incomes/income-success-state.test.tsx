import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EmployeeIncomeListItem, IncomeListItem } from "@/types/income";
import { IncomeSuccessState } from "./income-success-state";

const managerIncome: IncomeListItem = {
  id: "20000000-0000-4000-8000-000000000001",
  employee: { id: "00000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "Pérez" },
  registeredBy: { id: "00000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "Pérez" },
  customer: null,
  service: { id: "30000000-0000-4000-8000-000000000001", name: "Corte", price: 16000, commission: { subtotal: 16000, rate: 0, amount: 0, fullCommission: false, authorizedBy: null } },
  products: [],
  payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", methodName: "Efectivo", amount: 16000 }],
  commission: { total: 0, barbershopNet: 16000 },
  total: 16000,
  createdAt: "2026-08-07T12:00:00.000Z",
  businessDate: "2026-08-07",
  status: "active",
};

const employeeIncome: EmployeeIncomeListItem = {
  id: "20000000-0000-4000-8000-000000000001",
  createdAt: "2026-08-07T12:00:00.000Z",
  businessDate: "2026-08-07",
  customer: null,
  concepts: [{ id: "10000000-0000-4000-8000-000000000001", type: "service", name: "Corte", quantity: 1, earning: 8000 }],
  employeeCommission: 8000,
  status: "active",
};

describe("IncomeSuccessState", () => {
  it("shows the created amount and both next actions for the manager projection", async () => {
    const onReset = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<IncomeSuccessState income={managerIncome} viewerRole="owner" onReset={onReset} />);

    expect(screen.getByRole("heading", { name: /ingreso registrado/i })).toBeVisible();
    expect(screen.getByText(/16\.000/)).toBeVisible();
    expect(screen.queryByText(/tu comisión/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /volver al dashboard/i })).toHaveAttribute("href", "/");

    await user.click(screen.getByRole("button", { name: /cargar otro ingreso/i }));
    expect(onReset).toHaveBeenCalledOnce();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("renders the employee sanitized projection without ever accessing total", () => {
    render(<IncomeSuccessState income={employeeIncome} viewerRole="employee" onReset={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /ingreso registrado/i })).toBeVisible();
    expect(screen.getByText(/8\.000/)).toBeVisible();
    expect(screen.getAllByText(/tu comisión/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/16\.000/)).not.toBeInTheDocument();
  });
});
