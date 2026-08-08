import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const { requireManagerPage } = vi.hoisted(() => ({
  requireManagerPage: vi.fn().mockResolvedValue({
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      firstName: "Ana",
      lastName: "García",
      username: "ana.garcia",
      role: { id: 1, name: "owner" },
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-08-07T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    },
  }),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireManagerPage }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import UsersLayout from "./layout";

it("provides a live manager shell for every user route", async () => {
  render(await UsersLayout({ children: <p>Contenido de usuarios</p> }));

  expect(requireManagerPage).toHaveBeenCalledOnce();
  expect(screen.getByText("Contenido de usuarios")).toBeVisible();
  expect(screen.getByText("Ana García")).toBeVisible();
  expect(screen.getByRole("link", { name: "Usuarios" })).toHaveAttribute(
    "data-active",
  );
});
