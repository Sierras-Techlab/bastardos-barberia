import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { requirePageUser, getCurrentWorkSession } = vi.hoisted(() => ({
  requirePageUser: vi.fn(),
  getCurrentWorkSession: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requirePageUser }));
vi.mock("@/lib/work-sessions/service", () => ({ getCurrentWorkSession }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/incomes",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import DashboardLayout from "./layout";

const owner = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Lautaro",
  lastName: "Bastardos",
  username: "lautaro.bastardos",
  role: { id: 1 as const, name: "owner" as const },
  isActive: true,
  serviceCommissionRate: 0,
  productCommissionRate: 0,
  lastLoginAt: null,
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
};

const employee = {
  ...owner,
  id: "00000000-0000-4000-8000-000000000003",
  firstName: "Fernanda",
  lastName: "Pérez",
  username: "fernanda.perez",
  role: { id: 3 as const, name: "employee" as const },
};

beforeEach(() => {
  vi.clearAllMocks();
  requirePageUser.mockResolvedValue({ user: owner });
  getCurrentWorkSession.mockResolvedValue(null);
});

it("keeps one authenticated application shell around private route content", async () => {
  render(await DashboardLayout({ children: <p>Contenido privado</p> }));

  expect(requirePageUser).toHaveBeenCalledOnce();
  expect(screen.getByText("Contenido privado")).toBeVisible();
  expect(screen.getByAltText("Bastardos Barbería")).toBeVisible();
  expect(screen.getByText("Lautaro Bastardos")).toBeVisible();
  expect(screen.getByRole("main")).toHaveAttribute("data-slot", "sidebar-inset");
  expect(screen.getByRole("main")).toHaveClass("min-w-0");
  expect(await screen.findByLabelText(/^Notificaciones/)).toBeInTheDocument();
});

it("server-loads and renders the persistent clock only for employees", async () => {
  requirePageUser.mockResolvedValueOnce({ user: employee });

  render(await DashboardLayout({ children: <p>Contenido privado</p> }));

  expect(getCurrentWorkSession).toHaveBeenCalledWith(employee);
  expect(screen.getByRole("complementary", { name: "Control de jornada" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Marcar entrada" })).toBeVisible();
  expect(screen.queryByText("Ventas brutas")).not.toBeInTheDocument();
  expect(screen.queryByText("Neto barbería")).not.toBeInTheDocument();
});

it("never loads or renders the employee clock for managers", async () => {
  render(await DashboardLayout({ children: <p>Contenido privado</p> }));

  expect(getCurrentWorkSession).not.toHaveBeenCalled();
  expect(screen.queryByRole("complementary", { name: "Control de jornada" })).not.toBeInTheDocument();
});
