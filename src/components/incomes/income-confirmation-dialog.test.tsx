import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import incomeFormMock from "@/data/income-form.mock.json";
import type { IncomeFormValues } from "@/lib/incomes/income-schema";
import type { IncomeFormData } from "@/types/income";
import { IncomeConfirmationDialog } from "./income-confirmation-dialog";

const data = incomeFormMock as IncomeFormData;
const values: IncomeFormValues = {
  employeeId: data.currentUser.id,
  customerId: null,
  serviceId: "service-haircut-eyebrows",
  products: [{ productId: "product-hair-wax", quantity: 2, grantFullCommission: false }],
  paymentMode: "cash",
  payments: [{ method: "cash", amount: 39800 }],
  grantFullServiceCommission: false,
};

it("reviews the exact draft before allowing confirmation", async () => {
  const onBack = vi.fn();
  const onConfirm = vi.fn();
  const user = userEvent.setup();
  render(
    <IncomeConfirmationDialog
      open
      values={values}
      data={data}
      pending={false}
      onBack={onBack}
      onConfirm={onConfirm}
    />,
  );

  expect(screen.getByRole("dialog", { name: /confirmar ingreso/i })).toBeVisible();
  expect(screen.getByText("Corte de pelo y perfilado de cejas")).toBeVisible();
  expect(screen.getByText("Cera para pelo × 2")).toBeVisible();
  expect(screen.getAllByText(/39\.800/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Cera para pelo · 0%/)).toBeVisible();

  await user.click(screen.getByRole("button", { name: /volver y editar/i }));
  expect(onBack).toHaveBeenCalledOnce();

  await user.click(screen.getByRole("button", { name: /^confirmar ingreso$/i }));
  expect(onConfirm).toHaveBeenCalledOnce();
});

it("locks confirmation actions while the income is pending", () => {
  render(
    <IncomeConfirmationDialog
      open
      values={values}
      data={data}
      pending
      onBack={vi.fn()}
      onConfirm={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: /volver y editar/i })).toBeDisabled();
  expect(screen.getByRole("button", { name: /registrando ingreso/i })).toBeDisabled();
});

it("returns to editing when the close button is pressed", async () => {
  const onBack = vi.fn();
  const user = userEvent.setup();
  render(
    <IncomeConfirmationDialog
      open
      values={values}
      data={data}
      pending={false}
      onBack={onBack}
      onConfirm={vi.fn()}
    />,
  );

  await user.click(screen.getByRole("button", { name: /close/i }));
  expect(onBack).toHaveBeenCalledOnce();
});
