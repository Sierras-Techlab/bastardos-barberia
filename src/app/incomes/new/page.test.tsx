import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/auth/authorization", () => ({
  requirePageUser: vi.fn().mockResolvedValue({
    user: {
      id: "user-1",
      firstName: "Lautaro",
      lastName: "Bastardos",
      username: "lautaro.bastardos",
      role: { id: 1, name: "owner" },
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import NewIncomePage, { metadata } from "./page";

it("composes the Bastardos income form route", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  render(await NewIncomePage());

  expect(screen.getByRole("heading", { name: /cargar ingreso/i })).toBeVisible();
  expect(screen.getByText("Venta nueva")).toBeVisible();
  expect(screen.getByAltText("Bastardos Barbería")).toBeVisible();
  expect(screen.getByRole("button", { name: /revisar ingreso/i })).toBeVisible();
  expect(metadata.title).toBe("Cargar ingreso");
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});
