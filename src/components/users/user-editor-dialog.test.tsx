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

  it("forces owner commission inputs to zero and prevents editing them", async () => {
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
    await browser.type(serviceRate, "45");
    await browser.selectOptions(screen.getByLabelText("Rol del usuario"), "1");

    expect(serviceRate).toBeDisabled();
    expect(productRate).toBeDisabled();
    expect(serviceRate).toHaveValue(0);
    expect(productRate).toHaveValue(0);

    await browser.type(screen.getByLabelText("Nombre"), "Lucía");
    await browser.type(screen.getByLabelText("Apellido"), "Ferreyra");
    await browser.type(screen.getByLabelText(/Contrase.a inicial/), "Bastardos-2026");
    await browser.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      roleId: 1,
      serviceCommissionRate: 0,
      productCommissionRate: 0,
    })));
  });
});
