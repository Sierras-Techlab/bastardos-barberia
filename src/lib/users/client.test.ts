import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PaginatedUsers, SafeUser } from "@/lib/auth/types";
import {
  AdminApiError,
  createAdminUser,
  deleteAdminUser,
  listAdminRoles,
  listAdminUsers,
  resetAdminUserPassword,
  setAdminUserActive,
  updateAdminUser,
} from "./client";

const user: SafeUser = {
  id: "00000000-0000-4000-8000-000000000002",
  firstName: "Lucía",
  lastName: "Ferreyra",
  username: "lucia.ferreyra",
  role: { id: 3, name: "employee" },
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
};

const emptyPage: PaginatedUsers = {
  items: [],
  page: 2,
  pageSize: 20,
  total: 0,
  totalPages: 0,
};

describe("admin users API client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("serializes only populated user filters", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: emptyPage }));

    await listAdminUsers({
      page: 2,
      pageSize: 20,
      search: " Ana ",
      status: "active",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/users?page=2&pageSize=20&search=Ana&status=active",
      { signal: undefined },
    );
  });

  it("loads the fixed role catalog", async () => {
    const roles = [{ id: 1 as const, name: "owner" as const }];
    fetchMock.mockResolvedValue(Response.json({ data: roles }));

    await expect(listAdminRoles()).resolves.toEqual(roles);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/roles", undefined);
  });

  it("creates a user with JSON credentials", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: user }, { status: 201 }));
    const input = {
      firstName: "Lucía",
      lastName: "Ferreyra",
      roleId: 3 as const,
      password: "Bastardos-2026",
    };

    await expect(createAdminUser(input)).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it("updates profile and activation through PATCH", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ data: user }))
      .mockResolvedValueOnce(Response.json({ data: user }));

    await updateAdminUser(user.id, { firstName: "Luz" });
    await setAdminUserActive(user.id, false);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/admin/users/" + user.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "Luz" }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/users/" + user.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
  });

  it("replaces passwords and deletes with their dedicated methods", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ data: user }))
      .mockResolvedValueOnce(Response.json({ data: { id: user.id } }));

    await resetAdminUserPassword(user.id, "Nueva-clave-2026");
    await deleteAdminUser(user.id);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/users/" + user.id + "/password",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "Nueva-clave-2026" }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/users/" + user.id, {
      method: "DELETE",
    });
  });

  it("preserves the server error contract", async () => {
    fetchMock.mockResolvedValue(Response.json({
      error: {
        code: "LAST_OWNER_REQUIRED",
        message: "Debe quedar al menos un owner activo.",
      },
    }, { status: 409 }));

    await expect(deleteAdminUser(user.id)).rejects.toEqual(
      expect.objectContaining({
        name: "AdminApiError",
        status: 409,
        code: "LAST_OWNER_REQUIRED",
        message: "Debe quedar al menos un owner activo.",
      }),
    );
    expect(AdminApiError.prototype).toBeInstanceOf(Error);
  });
});
