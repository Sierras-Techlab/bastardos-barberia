import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Role, SafeUser } from "@/lib/auth/types";
import { UserEditorDialog } from "./user-editor-dialog";

const roles: Role[] = [
  { id: 1, name: "owner" },
  { id: 2, name: "admin" },
  { id: 3, name: "employee" },
];

const employee: SafeUser = {
  id: "00000000-0000-4000-8000-000000000002",
  firstName: "Lucía",
  lastName: "Ferreyra",
  username: "lucia.ferreyra",
  role: roles[2],
  isActive: true,
  serviceCommissionRate: 45,
  productCommissionRate: 0,
  lastLoginAt: null,
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
};

describe("UserEditorDialog", () => {
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

  it("allows replacing a zero product commission with a numeric percentage", async () => {
    const browser = userEvent.setup();
    const onUpdate = vi.fn(async () => undefined);

    render(
      <UserEditorDialog
        mode="edit"
        user={employee}
        roles={roles}
        createdUser={null}
        pending={false}
        error={null}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
      />,
    );

    const input = screen.getByLabelText("Comisión por productos (%)");
    await browser.clear(input);
    expect(input).toHaveValue(null);
    await browser.type(input, "20");
    await browser.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onUpdate).toHaveBeenCalledWith({ productCommissionRate: 20 });
  });

  it("rejects an empty commission on submission", async () => {
    const browser = userEvent.setup();
    const onUpdate = vi.fn(async () => undefined);

    render(
      <UserEditorDialog
        mode="edit"
        user={employee}
        roles={roles}
        createdUser={null}
        pending={false}
        error={null}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
      />,
    );

    await browser.clear(screen.getByLabelText("Comisión por productos (%)"));
    await browser.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Las comisiones deben ser porcentajes enteros entre 0 y 100.",
    );
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("hides owner commission fields and submits zero rates", async () => {
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

    await browser.type(screen.getByLabelText("Nombre"), "Lautaro");
    await browser.type(screen.getByLabelText("Apellido"), "Bastardos");
    await browser.clear(screen.getByLabelText("Comisión por servicios (%)"));
    await browser.type(screen.getByLabelText("Comisión por servicios (%)"), "45");
    await browser.clear(screen.getByLabelText("Comisión por productos (%)"));
    await browser.type(screen.getByLabelText("Comisión por productos (%)"), "20");
    await browser.selectOptions(screen.getByLabelText("Rol del usuario"), "1");

    expect(screen.queryByLabelText("Comisión por servicios (%)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Comisión por productos (%)")).not.toBeInTheDocument();
    expect(screen.getByText(/Los ingresos del dueño pertenecen íntegramente a la barbería/)).toBeVisible();

    await browser.type(screen.getByLabelText("Contraseña inicial"), "Bastardos-2026");
    await browser.click(screen.getByRole("button", { name: "Crear usuario" }));

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      roleId: 1,
      serviceCommissionRate: 0,
      productCommissionRate: 0,
    }));
  });
});
