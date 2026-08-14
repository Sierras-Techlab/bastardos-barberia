import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const { requirePageUser, listIncomes, listIncomeResponsibleEmployees } = vi.hoisted(() => ({
  requirePageUser: vi.fn().mockResolvedValue({
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      firstName: "Owner",
      lastName: "Bastardos",
      username: "owner.bastardos",
      role: { id: 1, name: "owner" },
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-08-07T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    },
  }),
  listIncomes: vi.fn().mockResolvedValue({ items: [], metrics: { total: 0, count: 0, average: 0, cashTotal: 0, transferTotal: 0 }, pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }),
  listIncomeResponsibleEmployees: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requirePageUser,
}));
vi.mock("@/lib/incomes/service", () => ({ listIncomes, listIncomeResponsibleEmployees }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/incomes",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import IncomesPage, { metadata } from "./page";
import DashboardLayout from "../layout";

it("composes the Bastardos income history route", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  render(await DashboardLayout({ children: await IncomesPage() }));

  expect(screen.getByRole("heading", { level: 1, name: /ingresos/i })).toBeVisible();
  expect(screen.getByText(/historial de ventas/i)).toBeVisible();
  expect(screen.getByAltText("Bastardos Barbería")).toBeVisible();
  expect(screen.getByRole("link", { name: /cargar ingreso/i })).toHaveAttribute(
    "href",
    "/incomes/new",
  );
  expect(screen.getByRole("link", { name: /^ingresos$/i })).toHaveAttribute(
    "href",
    "/incomes",
  );
  expect(metadata.title).toBe("Ingresos");
  expect(consoleError).not.toHaveBeenCalled();

  consoleError.mockRestore();
});

it("revalidates the session at the income history boundary", async () => {
  requirePageUser.mockClear();
  listIncomes.mockClear();
  await IncomesPage();

  expect(requirePageUser).toHaveBeenCalledOnce();
  expect(listIncomes).toHaveBeenCalledOnce();
});

it("loads historical responsible users for the manager filter", async () => {
  listIncomeResponsibleEmployees.mockResolvedValueOnce([{
    id: "00000000-0000-4000-8000-000000000099",
    firstName: "Empleado",
    lastName: "Histórico",
  }]);

  render(await DashboardLayout({ children: await IncomesPage() }));

  expect(listIncomeResponsibleEmployees).toHaveBeenCalledWith(expect.objectContaining({ id: "00000000-0000-4000-8000-000000000001" }));
  expect(screen.getByRole("option", { name: "Empleado Histórico" })).toBeVisible();
});

it("does not render income history after session revocation", async () => {
  requirePageUser.mockRejectedValueOnce(new Error("revoked session"));

  await expect(IncomesPage()).rejects.toThrow("revoked session");
});
