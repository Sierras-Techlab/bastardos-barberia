import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const owner = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Owner",
  lastName: "Bastardos",
  username: "owner.bastardos",
  role: { id: 1, name: "owner" },
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
};

const { requirePageUser, listProducts, listProductCategories } = vi.hoisted(() => ({
  requirePageUser: vi.fn(),
  listProducts: vi.fn(),
  listProductCategories: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requirePageUser }));
vi.mock("@/lib/products/service", () => ({ listProducts }));
vi.mock("@/lib/product-categories/service", () => ({ listProductCategories }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/products",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import ProductsPage, { metadata } from "./page";
import DashboardLayout from "../layout";

beforeEach(() => {
  vi.clearAllMocks();
  requirePageUser.mockResolvedValue({ user: owner });
  listProducts.mockResolvedValue({ products: [] });
  listProductCategories.mockResolvedValue({ categories: [] });
});

it("composes the authenticated persistent product catalog route", async () => {
  render(await DashboardLayout({ children: await ProductsPage() }));

  expect(screen.getByRole("heading", { name: "Productos" })).toBeVisible();
  expect(screen.getByText(/catálogo de venta/i)).toBeVisible();
  expect(screen.queryByText(/datos de demostración/i)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /^productos$/i })).toHaveAttribute(
    "href",
    "/products",
  );
  expect(metadata.title).toBe("Productos");
  expect(screen.getByLabelText("Estado del producto")).toBeVisible();
  expect(listProducts).toHaveBeenCalledWith(owner);
  expect(listProductCategories).toHaveBeenCalledWith(owner);
});

it("revalidates the session at the product catalog boundary", async () => {
  await ProductsPage();

  expect(requirePageUser).toHaveBeenCalledOnce();
});

it("does not load products after session revocation", async () => {
  requirePageUser.mockRejectedValueOnce(new Error("revoked session"));

  await expect(ProductsPage()).rejects.toThrow("revoked session");
  expect(listProducts).not.toHaveBeenCalled();
  expect(listProductCategories).not.toHaveBeenCalled();
});

it("loads an employee-scoped catalog without management filters", async () => {
  const employee = {
    ...owner,
    id: "00000000-0000-4000-8000-000000000003",
    firstName: "Fer",
    username: "fer.bastardos",
    role: { id: 3, name: "employee" },
  };
  requirePageUser.mockResolvedValueOnce({ user: employee });

  render(await DashboardLayout({ children: await ProductsPage() }));

  expect(listProducts).toHaveBeenCalledWith(employee);
  expect(listProductCategories).toHaveBeenCalledWith(employee);
  expect(screen.queryByLabelText("Estado del producto")).not.toBeInTheDocument();
});
