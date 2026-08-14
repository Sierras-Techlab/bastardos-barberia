import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const { requirePageUser, listServices, listProducts, listCustomers, listUsers } = vi.hoisted(() => ({
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
  listServices: vi.fn().mockResolvedValue([]),
  listProducts: vi.fn().mockResolvedValue([]),
  listCustomers: vi.fn().mockResolvedValue([]),
  listUsers: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0, totalPages: 0 }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requirePageUser,
}));
vi.mock("@/lib/services/repository", () => ({ serviceRepository: { list: listServices } }));
vi.mock("@/lib/products/repository", () => ({ productRepository: { list: listProducts } }));
vi.mock("@/lib/customers/repository", () => ({ customerRepository: { list: listCustomers } }));
vi.mock("@/lib/users/repository", () => ({ userRepository: { list: listUsers } }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/incomes/new",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import NewIncomePage, { metadata } from "./page";
import DashboardLayout from "../../layout";

it("composes the Bastardos income form route", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  render(await DashboardLayout({ children: await NewIncomePage() }));

  expect(screen.getByRole("heading", { name: /cargar ingreso/i })).toBeVisible();
  expect(screen.getByText("Venta nueva")).toBeVisible();
  expect(screen.getByAltText("Bastardos Barbería")).toBeVisible();
  expect(
    screen.getByRole("link", { name: /volver a ingresos/i }),
  ).toHaveAttribute("href", "/incomes");
  expect(screen.getByRole("button", { name: /revisar ingreso/i })).toBeVisible();
  expect(metadata.title).toBe("Cargar ingreso");
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

it("revalidates the session at the income form boundary", async () => {
  requirePageUser.mockClear();
  await NewIncomePage();

  expect(requirePageUser).toHaveBeenCalledOnce();
});

it("forwards the persisted commission rates to the sale preview", async () => {
  listUsers.mockResolvedValueOnce({
    items: [{
      id: "00000000-0000-4000-8000-000000000001",
      firstName: "Owner",
      lastName: "Bastardos",
      username: "owner.bastardos",
      role: { id: 1, name: "owner" },
      isActive: true,
      serviceCommissionRate: 45,
      productCommissionRate: 12,
      lastLoginAt: null,
      createdAt: "2026-08-07T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    }],
    page: 1,
    pageSize: 100,
    total: 1,
    totalPages: 1,
  });

  render(await DashboardLayout({ children: await NewIncomePage() }));

  expect(screen.getByText(/Servicio 45%.*Productos 12%/)).toBeVisible();
});

it("loads every active-user page for the responsible employee selector", async () => {
  const baseUser = {
    id: "00000000-0000-4000-8000-000000000001",
    firstName: "Owner",
    lastName: "Bastardos",
    username: "owner.bastardos",
    role: { id: 1, name: "owner" as const },
    isActive: true,
    serviceCommissionRate: 0,
    productCommissionRate: 0,
    lastLoginAt: null,
    createdAt: "2026-08-07T00:00:00.000Z",
    updatedAt: "2026-08-07T00:00:00.000Z",
  };
  listUsers
    .mockResolvedValueOnce({ items: [baseUser], page: 1, pageSize: 100, total: 101, totalPages: 2 })
    .mockResolvedValueOnce({
      items: [{ ...baseUser, id: "00000000-0000-4000-8000-000000000101", firstName: "Empleado", lastName: "Ciento Uno", username: "empleado.101", role: { id: 3, name: "employee" as const } }],
      page: 2,
      pageSize: 100,
      total: 101,
      totalPages: 2,
    });

  render(await DashboardLayout({ children: await NewIncomePage() }));

  expect(listUsers).toHaveBeenCalledWith({ page: 2, pageSize: 100, status: "active" });
  expect(screen.getByRole("option", { name: "Empleado Ciento Uno" })).toBeVisible();
});

it("does not render the income form after session revocation", async () => {
  requirePageUser.mockRejectedValueOnce(new Error("revoked session"));

  await expect(NewIncomePage()).rejects.toThrow("revoked session");
});
