import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { PaymentMethodsDialog } from "@/components/incomes/payment-methods-dialog";
import { DashboardToaster } from "@/components/ui/dashboard-toaster";
import { PaymentMethodApiError } from "@/lib/payment-methods/client";

const active = { id: "60000000-0000-4000-8000-000000000001", name: "Efectivo", isActive: true };
const inactive = { id: "60000000-0000-4000-8000-000000000002", name: "Transferencia", isActive: false };

const createClient = () => ({
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
  remove: vi.fn(),
});

it("shows active methods by default and keeps inactive methods in a separate view", async () => {
  const user = userEvent.setup();
  const paymentMethodClient = createClient();

  render(
    <PaymentMethodsDialog
      methods={[active, inactive]}
      paymentMethodClient={paymentMethodClient}
      onMethodsChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  expect(screen.getByText("Efectivo")).toBeVisible();
  expect(screen.queryByText("Transferencia")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Ver desactivados (1)" }));

  expect(screen.queryByText("Efectivo")).not.toBeInTheDocument();
  expect(screen.getByText("Transferencia")).toBeVisible();
  expect(screen.getByRole("button", { name: "Volver a activos" })).toBeVisible();
});

it("creates, renames, deactivates and reactivates payment methods with canonical mutations", async () => {
  const user = userEvent.setup();
  const created = { id: "60000000-0000-4000-8000-000000000003", name: "Tarjeta", isActive: true };
  const renamed = { ...active, name: "Efectivo en caja" };
  const deactivated = { ...renamed, isActive: false };
  const reactivated = { ...inactive, isActive: true };
  const paymentMethodClient = {
    ...createClient(),
    create: vi.fn().mockResolvedValue(created),
    update: vi.fn().mockResolvedValueOnce(renamed).mockResolvedValueOnce(reactivated),
    deactivate: vi.fn().mockResolvedValue(deactivated),
  };
  const onMethodsChange = vi.fn();
  render(<><PaymentMethodsDialog methods={[active, inactive]} paymentMethodClient={paymentMethodClient} onMethodsChange={onMethodsChange} onClose={vi.fn()} /><DashboardToaster /></>);

  await user.type(screen.getByLabelText("Nuevo medio de pago"), "Tarjeta");
  await user.click(screen.getByRole("button", { name: "Agregar medio" }));
  expect(paymentMethodClient.create).toHaveBeenCalledWith({ name: "Tarjeta" });
  expect(await screen.findByText("Medio de pago creado correctamente.")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Renombrar Efectivo" }));
  const dialog = screen.getByRole("dialog");
  const rename = within(dialog).getByLabelText("Nombre del medio de pago");
  await user.clear(rename);
  await user.type(rename, "Efectivo en caja");
  await user.click(within(dialog).getByRole("button", { name: "Guardar nombre" }));
  expect(paymentMethodClient.update).toHaveBeenNthCalledWith(1, active.id, { name: "Efectivo en caja" });

  await user.click(screen.getByRole("button", { name: "Desactivar Efectivo en caja" }));
  expect(paymentMethodClient.deactivate).toHaveBeenCalledWith(active.id);
  expect(screen.queryByText("Efectivo en caja")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Ver desactivados (2)" }));
  await user.click(screen.getByRole("button", { name: "Reactivar Transferencia" }));
  expect(paymentMethodClient.update).toHaveBeenNthCalledWith(2, inactive.id, { isActive: true });
  expect(paymentMethodClient.update).not.toHaveBeenCalledWith(expect.anything(), { isActive: false });
  expect(onMethodsChange).toHaveBeenLastCalledWith([deactivated, reactivated, created]);
});

it("deletes only after explicit confirmation and removes the method from shared state", async () => {
  const user = userEvent.setup();
  const paymentMethodClient = {
    ...createClient(),
    remove: vi.fn().mockResolvedValue({ id: active.id }),
  };
  const onMethodsChange = vi.fn();

  render(<><PaymentMethodsDialog methods={[active, inactive]} paymentMethodClient={paymentMethodClient} onMethodsChange={onMethodsChange} onClose={vi.fn()} /><DashboardToaster /></>);

  await user.click(screen.getByRole("button", { name: "Eliminar Efectivo" }));
  expect(paymentMethodClient.remove).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Eliminar medio de pago" }));

  expect(paymentMethodClient.remove).toHaveBeenCalledWith(active.id);
  expect(onMethodsChange).toHaveBeenLastCalledWith([inactive]);
  expect(await screen.findByText("Medio de pago eliminado correctamente.")).toBeVisible();
});

it("keeps an in-use method and shows the backend guidance", async () => {
  const user = userEvent.setup();
  const paymentMethodClient = {
    ...createClient(),
    remove: vi.fn().mockRejectedValue(new PaymentMethodApiError(
      409,
      "PAYMENT_METHOD_IN_USE",
      "Este medio de pago tiene ventas registradas. Desactivalo para ocultarlo sin perder el historial.",
    )),
  };
  const onMethodsChange = vi.fn();

  render(<PaymentMethodsDialog methods={[active]} paymentMethodClient={paymentMethodClient} onMethodsChange={onMethodsChange} onClose={vi.fn()} />);

  await user.click(screen.getByRole("button", { name: "Eliminar Efectivo" }));
  await user.click(screen.getByRole("button", { name: "Eliminar medio de pago" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Este medio de pago tiene ventas registradas. Desactivalo para ocultarlo sin perder el historial.");
  expect(onMethodsChange).not.toHaveBeenCalled();
});

it("keeps the last-active conflict visible", async () => {
  const user = userEvent.setup();
  const paymentMethodClient = {
    ...createClient(),
    deactivate: vi.fn().mockRejectedValue(Object.assign(new Error("Debe quedar al menos un medio de pago activo."), { code: "LAST_ACTIVE_PAYMENT_METHOD" })),
  };
  render(<PaymentMethodsDialog methods={[active]} paymentMethodClient={paymentMethodClient} onMethodsChange={vi.fn()} onClose={vi.fn()} />);

  await user.click(screen.getByRole("button", { name: "Desactivar Efectivo" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Debe quedar al menos un medio de pago activo.");
});

it("shows useful empty states for active and inactive views", async () => {
  const user = userEvent.setup();
  render(<PaymentMethodsDialog methods={[]} paymentMethodClient={createClient()} onMethodsChange={vi.fn()} onClose={vi.fn()} />);

  expect(screen.getByText("Todavía no hay medios de pago activos.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Ver desactivados (0)" }));
  expect(screen.getByText("No hay medios de pago desactivados.")).toBeVisible();
});
