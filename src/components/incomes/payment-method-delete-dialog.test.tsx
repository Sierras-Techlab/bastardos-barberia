import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { PaymentMethodDeleteDialog } from "@/components/incomes/payment-method-delete-dialog";
import { PaymentMethodApiError } from "@/lib/payment-methods/client";

const method = {
  id: "60000000-0000-4000-8000-000000000001",
  name: "Efectivo",
  isActive: true,
};

it("deletes the named method only after explicit confirmation", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();

  render(
    <PaymentMethodDeleteDialog
      method={method}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );

  expect(screen.getByText(/“Efectivo”/)).toBeVisible();
  expect(onConfirm).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Eliminar medio de pago" }),
  );

  expect(onConfirm).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
});

it("cancels without deleting", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <PaymentMethodDeleteDialog
      method={method}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Cancelar" }));

  expect(onClose).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
});

it("blocks closing and duplicate confirmation while deletion is pending", async () => {
  const user = userEvent.setup();
  let resolveDeletion: (() => void) | undefined;
  const onConfirm = vi.fn(
    () => new Promise<void>((resolve) => { resolveDeletion = resolve; }),
  );
  const onClose = vi.fn();

  render(
    <PaymentMethodDeleteDialog
      method={method}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );

  await user.click(
    screen.getByRole("button", { name: "Eliminar medio de pago" }),
  );

  expect(screen.getByRole("button", { name: "Eliminando..." })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  expect(onConfirm).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();

  resolveDeletion?.();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
});

it("keeps the public in-use guidance visible", async () => {
  const user = userEvent.setup();
  const message = "Este medio de pago tiene ventas registradas. Desactivalo para ocultarlo sin perder el historial.";
  const onConfirm = vi.fn().mockRejectedValue(
    new PaymentMethodApiError(409, "PAYMENT_METHOD_IN_USE", message),
  );
  const onClose = vi.fn();

  render(
    <PaymentMethodDeleteDialog
      method={method}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );

  await user.click(
    screen.getByRole("button", { name: "Eliminar medio de pago" }),
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(onClose).not.toHaveBeenCalled();
});
