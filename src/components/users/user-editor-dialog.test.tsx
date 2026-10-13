import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Role } from "@/lib/auth/types";
import type { SafeUser } from "@/lib/auth/types";
import { UserEditorDialog } from "./user-editor-dialog";

const roles: Role[] = [
  { id: 1, name: "owner" },
  { id: 2, name: "admin" },
  { id: 3, name: "employee" },
];

describe("UserEditorDialog", () => {
  it("locks rates disabled by an employee agreement and does not submit them", async () => {
    const browser = userEvent.setup();
    const onUpdate = vi.fn(async () => undefined);
    const user: SafeUser = {
      id: "00000000-0000-4000-8000-000000000003",
      firstName: "Lucía",
      lastName: "Ferreyra",
      username: "lucia.ferreyra",
      role: { id: 3, name: "employee" },
      isActive: true,
      serviceCommissionRate: 45,
      productCommissionRate: 10,
      serviceCommissionEnabled: false,
      productCommissionEnabled: false,
      lastLoginAt: null,
      createdAt: "2026-08-08T12:00:00.000Z",
      updatedAt: "2026-08-08T12:00:00.000Z",
    };

    render(
      <UserEditorDialog
        mode="edit"
        user={user}
        roles={roles}
        createdUser={null}
        pending={false}
        error={null}
        onClose={vi.fn()}
        onCreate={vi.fn(async () => true)}
        onUpdate={onUpdate}
      />,
    );

    const [serviceRate, productRate] = screen.getAllByRole("spinbutton");
    expect(serviceRate).toBeDisabled();
    expect(productRate).toBeDisabled();
    expect(serviceRate).toHaveValue(0);
    expect(productRate).toHaveValue(0);
    expect(screen.getAllByText(/Deshabilitada por acuerdo/)).toHaveLength(2);

    await browser.clear(screen.getByLabelText("Nombre"));
    await browser.type(screen.getByLabelText("Nombre"), "Lucía nueva");
    await browser.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ firstName: "Lucía nueva" }));
  });

  it("clears the plaintext password as soon as creation succeeds", async () => {
    const browser = userEvent.setup();
    const onCreate = vi.fn(async () => true);
    render(
      <UserEditorDialog
        mode="create"
        user={null}
        roles={roles}
        createdUser={null}
        pending={false}
        error={null}
        onClose={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn()}
      />,
    );

    await browser.type(screen.getByLabelText("Nombre"), "Lucia");
    await browser.type(screen.getByLabelText("Apellido"), "Ferreyra");
    await browser.type(
      screen.getByLabelText(/Contrase.a inicial/),
      "Bastardos-2026",
    );
    await browser.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText(/Contrase.a inicial/)).toHaveValue("");
  });

  it("allows editing owner commission rates and preserves them", async () => {
    const browser = userEvent.setup();
    const onCreate = vi.fn(async () => true);

    render(
      <UserEditorDialog
        mode="create"
        user={null}
        roles={roles}
        createdUser={null}
        pending={false}
        error={null}
        onClose={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn()}
      />,
    );

    const serviceRate = screen.getByLabelText("Comisión por servicios (%)");
    const productRate = screen.getByLabelText("Comisión por productos (%)");
    await browser.clear(serviceRate);
    expect(serviceRate).toHaveValue(null);
    await browser.type(serviceRate, "35");
    await browser.clear(productRate);
    expect(productRate).toHaveValue(null);
    await browser.type(productRate, "12");
    await browser.selectOptions(screen.getByLabelText("Rol del usuario"), "1");

    expect(serviceRate).not.toBeDisabled();
    expect(productRate).not.toBeDisabled();
    expect(serviceRate).toHaveValue(35);
    expect(productRate).toHaveValue(12);

    await browser.type(screen.getByLabelText("Nombre"), "Lucía");
    await browser.type(screen.getByLabelText("Apellido"), "Ferreyra");
    await browser.type(screen.getByLabelText(/Contrase.a inicial/), "Bastardos-2026");
    await browser.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      roleId: 1,
      serviceCommissionRate: 35,
      productCommissionRate: 12,
    })));
  });
});
