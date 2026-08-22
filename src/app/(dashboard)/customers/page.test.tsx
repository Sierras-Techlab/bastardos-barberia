import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const { requirePageUser, listCustomers, listPaymentMethods, listUsers } = vi.hoisted(() => ({
  requirePageUser: vi.fn().mockResolvedValue({
    user: { id: "owner", firstName: "Lautaro", lastName: "Bastardos", username: "lautaro.bastardos", role: { id: 1, name: "owner" }, isActive: true, lastLoginAt: null, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" },
  }),
  listCustomers: vi.fn().mockResolvedValue({ customers: [] }),
  listPaymentMethods: vi.fn().mockResolvedValue([]),
  listUsers: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0, totalPages: 0 }),
}));

vi.mock("@/lib/auth/authorization", () => ({ requirePageUser, assertManager: (actor: { role: { name: string } }) => actor }));
vi.mock("@/lib/customers/service", () => ({ listCustomers }));
vi.mock("@/lib/payment-methods/service", () => ({ listPaymentMethods }));
vi.mock("@/lib/users/service", () => ({ listUsers }));
vi.mock("next/navigation", () => ({ usePathname: () => "/customers", useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import CustomersPage, { metadata } from "./page";
import DashboardLayout from "../layout";

it("composes the authenticated customer route for managers", async () => {
  render(await DashboardLayout({ children: await CustomersPage() }));
  expect(screen.getByRole("heading", { name: "Clientes" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute("href", "/customers");
  expect(screen.getByRole("button", { name: "Nuevo cliente" })).toBeVisible();
  expect(metadata.title).toBe("Clientes");
});

it("revalidates authentication", async () => {
  requirePageUser.mockClear();
  listCustomers.mockClear();
  await CustomersPage();
  expect(requirePageUser).toHaveBeenCalledOnce();
  expect(listCustomers).toHaveBeenCalledOnce();
});
