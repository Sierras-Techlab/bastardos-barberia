import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireManager,
  getUser,
  updateUser,
  deleteUser,
} = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/users/service", () => ({
  getUser,
  updateUser,
  deleteUser,
}));

import { DELETE, PATCH } from "./route";
import { unauthenticatedError } from "@/lib/auth/errors";

const targetId = "00000000-0000-4000-8000-000000000002";

describe("/api/admin/users/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireManager.mockResolvedValue({ user: { id: "manager-id" } });
  });

  it("logically deletes a validated user as a manager", async () => {
    deleteUser.mockResolvedValue({ id: targetId });

    const response = await DELETE(
      new Request(`http://localhost/api/admin/users/${targetId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: targetId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { id: targetId } });
    expect(deleteUser).toHaveBeenCalledWith({ id: "manager-id" }, targetId);
  });

  it("updates commission rates through the manager boundary", async () => {
    updateUser.mockResolvedValue({ id: targetId, serviceCommissionRate: 50, productCommissionRate: 15 });

    const response = await PATCH(
      new Request(`http://localhost/api/admin/users/${targetId}`, {
        method: "PATCH",
        body: JSON.stringify({ serviceCommissionRate: 50, productCommissionRate: 15 }),
      }),
      { params: Promise.resolve({ id: targetId }) },
    );

    expect(response.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith(
      { id: "manager-id" },
      targetId,
      { serviceCommissionRate: 50, productCommissionRate: 15 },
    );
  });

  it("returns the stable authentication error when no manager session exists", async () => {
    requireManager.mockRejectedValue(unauthenticatedError());

    const response = await DELETE(
      new Request(`http://localhost/api/admin/users/${targetId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: targetId }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Debés iniciar sesión.",
      },
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
