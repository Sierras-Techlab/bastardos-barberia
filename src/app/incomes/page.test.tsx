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
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import IncomesPage, { metadata } from "./page";
import IncomesLayout from "./layout";

it("composes the Bastardos income history route", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  render(await IncomesLayout({ children: await IncomesPage() }));

  expect(screen.getByRole("heading", { name: /ingresos/i })).toBeVisible();
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

it("does not render the income history when leaf session validation fails", async () => {
  requirePageUser.mockRejectedValueOnce(new Error("revoked session"));

  await expect(Promise.resolve().then(() => IncomesPage())).rejects.toThrow("revoked session");
});
