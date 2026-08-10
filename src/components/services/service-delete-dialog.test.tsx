import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ServiceDeleteDialog } from "@/components/services/service-delete-dialog";

const service = { id: "service-beard", name: "Barba", price: 13000, isActive: true };

it("only deletes the named service after explicit confirmation", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  render(
    <ServiceDeleteDialog
      service={service}
      onClose={onClose}
      onConfirm={onConfirm}
    />,
  );

  expect(
    screen.getByText(/¿Querés eliminar el servicio “Barba”\?/),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Eliminar servicio" }));
  expect(onConfirm).toHaveBeenCalledOnce();
});
