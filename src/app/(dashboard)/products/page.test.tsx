import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const { requirePageUser } = vi.hoisted(() => ({
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
}));

vi.mock("@/lib/auth/authorization", () => ({ requirePageUser }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/products",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import ProductsPage, { metadata } from "./page";
import DashboardLayout from "../layout";

it("composes the authenticated product catalog route", async () => {
  render(await DashboardLayout({ children: await ProductsPage() }));

  expect(screen.getByRole("heading", { name: "Productos" })).toBeVisible();
  expect(screen.getByText(/catálogo de venta/i)).toBeVisible();
  expect(screen.getByText(/datos de demostración/i)).toBeVisible();
  expect(screen.getByRole("link", { name: /^productos$/i })).toHaveAttribute(
    "href",
    "/products",
  );
  expect(metadata.title).toBe("Productos");
});

it("revalidates the session at the product catalog boundary", async () => {
  requirePageUser.mockClear();

  await ProductsPage();

  expect(requirePageUser).toHaveBeenCalledOnce();
});

it("does not render products after session revocation", async () => {
  requirePageUser.mockRejectedValueOnce(new Error("revoked session"));

  await expect(ProductsPage()).rejects.toThrow("revoked session");
});
