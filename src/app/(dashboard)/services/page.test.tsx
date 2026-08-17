import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const { requirePageUser, listServices } = vi.hoisted(() => ({
  requirePageUser: vi.fn().mockResolvedValue({
    user: { id: "owner", firstName: "Lautaro", lastName: "Bastardos", username: "lautaro.bastardos", role: { id: 1, name: "owner" }, isActive: true, lastLoginAt: null, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" },
  }),
  listServices: vi.fn().mockResolvedValue({ services: [] }),
}));

vi.mock("@/lib/auth/authorization", () => ({ requirePageUser }));
vi.mock("@/lib/services/service", () => ({ listServices }));
vi.mock("next/navigation", () => ({ usePathname: () => "/services", useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import ServicesPage, { metadata } from "./page";
import DashboardLayout from "../layout";

it("composes the authenticated services route", async () => {
  render(await DashboardLayout({ children: await ServicesPage() }));
  expect(screen.getByRole("heading", { name: "Servicios" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Servicios" })).toHaveAttribute("href", "/services");
  expect(screen.getByRole("button", { name: "Nuevo servicio" })).toBeVisible();
  expect(metadata.title).toBe("Servicios");
});

it("revalidates authentication", async () => {
  requirePageUser.mockClear();
  listServices.mockClear();
  await ServicesPage();
  expect(requirePageUser).toHaveBeenCalledOnce();
  expect(listServices).toHaveBeenCalledOnce();
});
