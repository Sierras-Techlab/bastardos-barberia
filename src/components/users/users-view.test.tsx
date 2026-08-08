import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PaginatedUsers, Role, SafeUser } from "@/lib/auth/types";
import { AdminApiError } from "@/lib/users/client";

const {
  replace,
  listAdminRoles,
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  resetAdminUserPassword,
  setAdminUserActive,
  deleteAdminUser,
} = vi.hoisted(() => ({
  replace: vi.fn(),
  listAdminRoles: vi.fn(),
  listAdminUsers: vi.fn(),
  createAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
  resetAdminUserPassword: vi.fn(),
  setAdminUserActive: vi.fn(),
  deleteAdminUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/users/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/users/client")>();
  return {
    ...original,
    listAdminRoles,
    listAdminUsers,
    createAdminUser,
    updateAdminUser,
    resetAdminUserPassword,
    setAdminUserActive,
    deleteAdminUser,
  };
});

import { UsersView } from "./users-view";

const owner: SafeUser = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Ana",
  lastName: "García",
  username: "ana.garcia",
  role: { id: 1, name: "owner" },
  isActive: true,
  lastLoginAt: "2026-08-08T15:00:00.000Z",
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
};

const employee: SafeUser = {
  id: "00000000-0000-4000-8000-000000000002",
  firstName: "Lucía",
  lastName: "Ferreyra",
  username: "lucia.ferreyra",
  role: { id: 3, name: "employee" },
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
};

const roles: Role[] = [
  { id: 1, name: "owner" },
  { id: 2, name: "admin" },
  { id: 3, name: "employee" },
];

const page: PaginatedUsers = {
  items: [owner, employee],
  page: 1,
  pageSize: 20,
  total: 2,
  totalPages: 1,
};

describe("UsersView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAdminRoles.mockResolvedValue(roles);
    listAdminUsers.mockResolvedValue(page);
  });

  it("loads users and applies manager filters", async () => {
    const browser = userEvent.setup();
    render(<UsersView currentUser={owner} />);

    expect(screen.getByRole("heading", { name: "Usuarios" })).toBeVisible();
    expect(await screen.findByText("@lucia.ferreyra")).toBeVisible();
    expect(screen.getByText("2 en esta página")).toBeVisible();
    expect(screen.getByText("2 activos")).toBeVisible();

    await browser.selectOptions(screen.getByLabelText("Estado"), "inactive");

    await waitFor(() => {
      expect(listAdminUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
          status: "inactive",
        }),
        expect.any(AbortSignal),
      );
    });
  });

  it("shows a useful empty state after filters", async () => {
    listAdminUsers.mockResolvedValue({ ...page, items: [], total: 0, totalPages: 0 });

    render(<UsersView currentUser={owner} />);

    expect(await screen.findByText("No encontramos usuarios")).toBeVisible();
    expect(screen.getByRole("button", { name: "Restablecer filtros" })).toBeVisible();
  });

  it("creates a user and reveals the generated username", async () => {
    const browser = userEvent.setup();
    createAdminUser.mockResolvedValue({
      ...employee,
      id: "00000000-0000-4000-8000-000000000003",
      username: "lucia.ferreyra2",
    });
    render(<UsersView currentUser={owner} />);
    await screen.findByText("@lucia.ferreyra");

    await browser.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    await browser.type(screen.getByLabelText("Nombre"), "Lucía");
    await browser.type(screen.getByLabelText("Apellido"), "Ferreyra");
    await browser.selectOptions(screen.getByLabelText("Rol del usuario"), "3");
    await browser.type(
      screen.getByLabelText("Contraseña inicial"),
      "Bastardos-2026",
    );
    await browser.click(screen.getByRole("button", { name: "Crear usuario" }));

    expect(await screen.findByText("lucia.ferreyra2")).toBeVisible();
    expect(createAdminUser).toHaveBeenCalledWith({
      firstName: "Lucía",
      lastName: "Ferreyra",
      roleId: 3,
      password: "Bastardos-2026",
    });
  });

  it("edits profile fields without changing the username", async () => {
    const browser = userEvent.setup();
    updateAdminUser.mockResolvedValue({ ...employee, firstName: "Luz" });
    render(<UsersView currentUser={owner} />);
    await screen.findByText("@lucia.ferreyra");

    await browser.click(
      screen.getByRole("button", { name: "Acciones de Lucía Ferreyra" }),
    );
    await browser.click(screen.getByRole("menuitem", { name: "Editar datos" }));

    expect(screen.getByLabelText("Usuario")).toHaveValue("lucia.ferreyra");
    expect(screen.getByLabelText("Usuario")).toHaveAttribute("readonly");
    await browser.clear(screen.getByLabelText("Nombre"));
    await browser.type(screen.getByLabelText("Nombre"), "Luz");
    await browser.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(updateAdminUser).toHaveBeenCalledWith(employee.id, {
        firstName: "Luz",
      });
    });
  });

  it("requires matching passwords before replacing credentials", async () => {
    const browser = userEvent.setup();
    resetAdminUserPassword.mockResolvedValue(employee);
    render(<UsersView currentUser={owner} />);
    await screen.findByText("@lucia.ferreyra");

    await browser.click(
      screen.getByRole("button", { name: "Acciones de Lucía Ferreyra" }),
    );
    await browser.click(
      screen.getByRole("menuitem", { name: "Cambiar contraseña" }),
    );
    await browser.type(
      screen.getByLabelText("Nueva contraseña"),
      "Nueva-clave-2026",
    );
    await browser.type(
      screen.getByLabelText("Confirmar contraseña"),
      "Otra-clave-2026",
    );
    await browser.click(
      screen.getByRole("button", { name: "Cambiar contraseña" }),
    );

    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeVisible();
    expect(resetAdminUserPassword).not.toHaveBeenCalled();

    await browser.clear(screen.getByLabelText("Confirmar contraseña"));
    await browser.type(
      screen.getByLabelText("Confirmar contraseña"),
      "Nueva-clave-2026",
    );
    await browser.click(
      screen.getByRole("button", { name: "Cambiar contraseña" }),
    );

    await waitFor(() => {
      expect(resetAdminUserPassword).toHaveBeenCalledWith(
        employee.id,
        "Nueva-clave-2026",
      );
    });
  });

  it("deactivates an active user only after confirmation", async () => {
    const browser = userEvent.setup();
    setAdminUserActive.mockResolvedValue({ ...employee, isActive: false });
    render(<UsersView currentUser={owner} />);
    await screen.findByText("@lucia.ferreyra");

    await browser.click(
      screen.getByRole("button", { name: "Acciones de Lucía Ferreyra" }),
    );
    await browser.click(
      screen.getByRole("menuitem", { name: "Desactivar usuario" }),
    );

    expect(setAdminUserActive).not.toHaveBeenCalled();
    expect(screen.getByText(/sesiones abiertas se cerrarán/i)).toBeVisible();
    await browser.click(
      screen.getByRole("button", { name: "Desactivar usuario" }),
    );

    await waitFor(() => {
      expect(setAdminUserActive).toHaveBeenCalledWith(employee.id, false);
    });
  });

  it("reactivates an inactive user", async () => {
    const browser = userEvent.setup();
    const inactive = { ...employee, isActive: false };
    listAdminUsers.mockResolvedValue({ ...page, items: [owner, inactive] });
    setAdminUserActive.mockResolvedValue({ ...inactive, isActive: true });
    render(<UsersView currentUser={owner} />);
    await screen.findByText("@lucia.ferreyra");

    await browser.click(
      screen.getByRole("button", { name: "Acciones de Lucía Ferreyra" }),
    );
    await browser.click(
      screen.getByRole("menuitem", { name: "Activar usuario" }),
    );
    await browser.click(
      screen.getByRole("button", { name: "Activar usuario" }),
    );

    await waitFor(() => {
      expect(setAdminUserActive).toHaveBeenCalledWith(employee.id, true);
    });
  });

  it("logically deletes a named user after destructive confirmation", async () => {
    const browser = userEvent.setup();
    deleteAdminUser.mockResolvedValue({ id: employee.id });
    render(<UsersView currentUser={owner} />);
    await screen.findByText("@lucia.ferreyra");

    await browser.click(
      screen.getByRole("button", { name: "Acciones de Lucía Ferreyra" }),
    );
    await browser.click(
      screen.getByRole("menuitem", { name: "Eliminar usuario" }),
    );

    expect(screen.getByText(/Lucía Ferreyra dejará de aparecer/i)).toBeVisible();
    expect(deleteAdminUser).not.toHaveBeenCalled();
    await browser.click(
      screen.getByRole("button", { name: "Eliminar usuario" }),
    );

    await waitFor(() => {
      expect(deleteAdminUser).toHaveBeenCalledTimes(1);
      expect(deleteAdminUser).toHaveBeenCalledWith(employee.id);
    });
  });

  it("disables destructive controls for the current manager", async () => {
    const browser = userEvent.setup();
    render(<UsersView currentUser={owner} />);
    await screen.findByText("@ana.garcia");

    await browser.click(
      screen.getByRole("button", { name: "Acciones de Ana García" }),
    );

    expect(
      screen.getByRole("menuitem", { name: "Desactivar usuario" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("menuitem", { name: "Eliminar usuario" }),
    ).toBeDisabled();
  });

  it("keeps final-owner errors visible in the confirmation", async () => {
    const browser = userEvent.setup();
    deleteAdminUser.mockRejectedValue(
      new AdminApiError(
        409,
        "LAST_OWNER_REQUIRED",
        "Debe quedar al menos un owner activo.",
      ),
    );
    render(<UsersView currentUser={owner} />);
    await screen.findByText("@lucia.ferreyra");

    await browser.click(
      screen.getByRole("button", { name: "Acciones de Lucía Ferreyra" }),
    );
    await browser.click(
      screen.getByRole("menuitem", { name: "Eliminar usuario" }),
    );
    await browser.click(
      screen.getByRole("button", { name: "Eliminar usuario" }),
    );

    expect(
      await screen.findByText("Debe quedar al menos un owner activo."),
    ).toBeVisible();
  });
});
