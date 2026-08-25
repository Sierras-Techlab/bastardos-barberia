import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Role } from "@/lib/auth/types";
import { UserEditorDialog } from "./user-editor-dialog";

const roles: Role[] = [
  { id: 1, name: "owner" },
  { id: 2, name: "admin" },
  { id: 3, name: "employee" },
];

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
