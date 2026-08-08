import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/auth/authorization", () => ({
  requirePageUser: vi.fn().mockResolvedValue({
    user: {
      id: "00000000-0000-4000-8000-000000000003",
      firstName: "Fernanda",
      lastName: "P\u00e9rez",
      username: "fernanda.perez",
      role: { id: 3, name: "employee" },
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-08-07T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import IncomesLayout from "./layout";

it("provides one authenticated shell for every incomes child route", async () => {
  render(await IncomesLayout({ children: <p>Contenido de la ruta</p> }));

  expect(screen.getByText("Contenido de la ruta")).toBeVisible();
  expect(screen.getByAltText("Bastardos Barbería")).toBeVisible();
  expect(screen.getByText("Fernanda P\u00e9rez")).toBeVisible();
  expect(screen.getByRole("link", { name: "Ingresos" })).toHaveAttribute(
    "data-active",
  );
  expect(screen.getByRole("main")).toHaveAttribute(
    "data-slot",
    "sidebar-inset",
  );
});
