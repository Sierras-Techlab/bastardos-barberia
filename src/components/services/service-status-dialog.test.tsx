import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ServiceStatusDialog } from "@/components/services/service-status-dialog";

const service = { id: "service-beard", name: "Barba", price: 13000, isActive: true };

it("only changes status after explicit confirmation", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(<ServiceStatusDialog service={service} onClose={onClose} onConfirm={onConfirm} />);
  expect(screen.getByText(/Barba dejará de estar disponible/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Desactivar servicio" }));
  expect(onConfirm).toHaveBeenCalledOnce();
});
