import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { Income } from "@/types/income";
import { IncomeSuccessState } from "./income-success-state";

const income: Income = {
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

it("shows the created amount and both next actions", async () => {
  const onReset = vi.fn();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const user = userEvent.setup();
  render(<IncomeSuccessState income={income} onReset={onReset} />);

  expect(screen.getByRole("heading", { name: /ingreso registrado/i })).toBeVisible();
  expect(screen.getByText(/16\.000/)).toBeVisible();
  expect(screen.getByRole("link", { name: /volver al dashboard/i })).toHaveAttribute(
    "href",
    "/",
  );

  await user.click(screen.getByRole("button", { name: /cargar otro ingreso/i }));
  expect(onReset).toHaveBeenCalledOnce();
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});
