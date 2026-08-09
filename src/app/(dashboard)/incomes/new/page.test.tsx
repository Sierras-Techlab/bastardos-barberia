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

vi.mock("@/lib/auth/authorization", () => ({
  requirePageUser,
}));

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

it("does not render the income form after session revocation", async () => {
  requirePageUser.mockRejectedValueOnce(new Error("revoked session"));

  await expect(NewIncomePage()).rejects.toThrow("revoked session");
});
