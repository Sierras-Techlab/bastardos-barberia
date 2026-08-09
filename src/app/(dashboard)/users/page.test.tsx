import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const { requireManagerPage, listAdminRoles, listAdminUsers } = vi.hoisted(() => ({
  requireManagerPage: vi.fn().mockResolvedValue({
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      firstName: "Ana",
      lastName: "García",
      username: "ana.garcia",
      role: { id: 1, name: "owner" },
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-08-07T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    },
  }),
  listAdminRoles: vi.fn().mockResolvedValue([]),
  listAdminUsers: vi.fn().mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  }),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireManagerPage }));
vi.mock("@/lib/users/client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/users/client")>(),
  listAdminRoles,
  listAdminUsers,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

import UsersPage, { metadata } from "./page";

it("renders the user workspace after a live manager check", async () => {
  render(await UsersPage());

  expect(requireManagerPage).toHaveBeenCalledOnce();
  expect(screen.getByRole("heading", { name: "Usuarios" })).toBeVisible();
  expect(metadata.title).toBe("Usuarios");
});

it("does not render users when the leaf manager check fails", async () => {
  requireManagerPage.mockRejectedValueOnce(new Error("revoked manager"));

  await expect(Promise.resolve().then(() => UsersPage()))
    .rejects.toThrow("revoked manager");
});
