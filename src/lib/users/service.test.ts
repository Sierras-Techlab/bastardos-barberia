import { describe, expect, it, vi } from "vitest";

import {
  createUser,
  deleteUser,
  resetUserPassword,
  updateUser,
  type UserServiceDependencies,
} from "./service";
import type { SafeUser } from "@/lib/auth/types";

const owner: SafeUser = {
  id: "00000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "García",
  username: "ana.garcia", role: { id: 1, name: "owner" }, isActive: true,
  serviceCommissionRate: 0, productCommissionRate: 0,
  lastLoginAt: null, createdAt: "2026-08-07T00:00:00.000Z", updatedAt: "2026-08-07T00:00:00.000Z",
};

const dependencies = () => ({
  users: {
    findById: vi.fn().mockResolvedValue(owner),
    create: vi.fn().mockResolvedValue(owner),
    update: vi.fn().mockResolvedValue(owner),
    softDelete: vi.fn().mockResolvedValue(owner.id),
    countActiveOwners: vi.fn().mockResolvedValue(1),
  },
  sessions: { revokeAllForUser: vi.fn().mockResolvedValue(undefined) },
  hashPassword: vi.fn().mockResolvedValue("$argon2id$v=19$hash"),
}) as unknown as UserServiceDependencies;

describe("user lifecycle", () => {
  it("hashes the password before creating a user", async () => {
    const deps = dependencies();
    await createUser(owner, { firstName: "Luis", lastName: "Pérez", password: "password-2026", roleId: 3, serviceCommissionRate: 0, productCommissionRate: 0 }, deps);
    expect(deps.users.create).toHaveBeenCalledWith(expect.objectContaining({
      passwordHash: "$argon2id$v=19$hash", createdBy: owner.id,
      serviceCommissionRate: 0, productCommissionRate: 0,
    }));
  });

  it("passes configured commission rates to account persistence", async () => {
    const deps = dependencies();
    await createUser(owner, {
      firstName: "Luis",
      lastName: "Pérez",
      password: "password-2026",
      roleId: 3,
      serviceCommissionRate: 45,
      productCommissionRate: 12,
    }, deps);

    expect(deps.users.create).toHaveBeenCalledWith(expect.objectContaining({
      serviceCommissionRate: 45,
      productCommissionRate: 12,
    }));
  });

  it("persists the submitted commission rates when creating an owner", async () => {
    const deps = dependencies();

    await createUser(owner, {
      firstName: "Lucía",
      lastName: "Ferreyra",
      password: "password-2026",
      roleId: 1,
      serviceCommissionRate: 35,
      productCommissionRate: 12,
    }, deps);

    expect(deps.users.create).toHaveBeenCalledWith(expect.objectContaining({
      roleId: 1,
      serviceCommissionRate: 35,
      productCommissionRate: 12,
    }));
  });

  it("preserves submitted commission rates when promoting a user to owner", async () => {
    const deps = dependencies();
    const employee = { ...owner, id: "00000000-0000-4000-8000-000000000002", role: { id: 3 as const, name: "employee" as const } };
    vi.mocked(deps.users.findById).mockResolvedValue(employee);

    await updateUser(owner, employee.id, {
      roleId: 1,
      serviceCommissionRate: 35,
      productCommissionRate: 12,
    }, deps);

    expect(deps.users.update).toHaveBeenCalledWith(employee.id, expect.objectContaining({
      roleId: 1,
      serviceCommissionRate: 35,
      productCommissionRate: 12,
    }));
  });

  it("persists updated commission rates for an owner", async () => {
    const deps = dependencies();

    await updateUser(owner, owner.id, {
      serviceCommissionRate: 45,
      productCommissionRate: 12,
    }, deps);

    expect(deps.users.update).toHaveBeenCalledWith(owner.id, expect.objectContaining({
      serviceCommissionRate: 45,
      productCommissionRate: 12,
    }));
  });

  it("prevents self-deactivation", async () => {
    const deps = dependencies();
    await expect(updateUser(owner, owner.id, { isActive: false }, deps))
      .rejects.toMatchObject({ code: "CANNOT_DEACTIVATE_SELF", status: 409 });
  });

  it("prevents demoting the final active owner", async () => {
    const deps = dependencies();
    await expect(updateUser({ ...owner, id: "manager-id" }, owner.id, { roleId: 2 }, deps))
      .rejects.toMatchObject({ code: "LAST_OWNER_REQUIRED", status: 409 });
  });

  it("resets the password and revokes every target session", async () => {
    const deps = dependencies();
    await resetUserPassword(owner, owner.id, "new-password-2026", deps, new Date("2026-08-07T12:00:00.000Z"));
    expect(deps.users.update).toHaveBeenCalledWith(owner.id, expect.objectContaining({
      passwordHash: "$argon2id$v=19$hash", failedLoginAttempts: 0, lockedUntil: null,
    }));
    expect(deps.sessions.revokeAllForUser).toHaveBeenCalledWith(owner.id, "2026-08-07T12:00:00.000Z");
  });

  it("prevents self-deletion before touching persistence", async () => {
    const deps = dependencies();

    await expect(deleteUser(owner, owner.id, deps))
      .rejects.toMatchObject({ code: "CANNOT_DELETE_SELF", status: 409 });

    expect(deps.users.softDelete).not.toHaveBeenCalled();
  });

  it("logically deletes through the atomic repository operation", async () => {
    const deps = dependencies();
    const target = { ...owner, id: "00000000-0000-4000-8000-000000000002" };
    vi.mocked(deps.users.findById).mockResolvedValue(target);
    vi.mocked(deps.users.softDelete).mockResolvedValue(target.id);

    await expect(deleteUser(
      owner,
      target.id,
      deps,
      new Date("2026-08-08T12:00:00.000Z"),
    )).resolves.toEqual({ id: target.id });

    expect(deps.users.softDelete).toHaveBeenCalledWith(
      target.id,
      owner.id,
      "2026-08-08T12:00:00.000Z",
    );
  });

  it("reports a missing or already deleted target", async () => {
    const deps = dependencies();
    vi.mocked(deps.users.findById).mockResolvedValue(null);

    await expect(deleteUser(
      owner,
      "00000000-0000-4000-8000-000000000099",
      deps,
    )).rejects.toMatchObject({ code: "USER_NOT_FOUND", status: 404 });

    expect(deps.users.softDelete).not.toHaveBeenCalled();
  });
});
