import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CustomerEditorDialog } from "@/components/customers/customer-editor-dialog";

it("keeps optional email and draft state when async creation fails", async () => {
  const user = userEvent.setup(); const onSave = vi.fn().mockRejectedValue(new Error("Ya existe un cliente con ese teléfono."));
  render(<CustomerEditorDialog mode="create" customer={null} customers={[]} onClose={vi.fn()} onSave={onSave} />);
  await user.type(screen.getByLabelText("Nombre"), "Ana"); await user.type(screen.getByLabelText("Apellido"), "Pérez"); await user.type(screen.getByLabelText("Teléfono"), "3515550101");
  await user.click(screen.getByRole("button", { name: "Crear cliente" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe un cliente con ese teléfono.");
  expect(onSave).toHaveBeenCalledWith({ firstName: "Ana", lastName: "Pérez", phone: "3515550101", email: null });
  expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
});
