import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const { requirePageUser } = vi.hoisted(() => ({
  requirePageUser: vi.fn().mockResolvedValue({
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      firstName: "Lautaro",
      lastName: "Bastardos",
      username: "lautaro.bastardos",
      role: { id: 1, name: "owner" },
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-08-07T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    },
  }),
}));

vi.mock("@/lib/auth/authorization", () => ({ requirePageUser }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/incomes",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import DashboardLayout from "./layout";

it("keeps one authenticated application shell around private route content", async () => {
  render(await DashboardLayout({ children: <p>Contenido privado</p> }));

  expect(requirePageUser).toHaveBeenCalledOnce();
  expect(screen.getByText("Contenido privado")).toBeVisible();
  expect(screen.getByAltText("Bastardos Barbería")).toBeVisible();
  expect(screen.getByText("Lautaro Bastardos")).toBeVisible();
  expect(screen.getByRole("main")).toHaveAttribute("data-slot", "sidebar-inset");
  expect(await screen.findByLabelText(/^Notificaciones/)).toBeInTheDocument();
});
