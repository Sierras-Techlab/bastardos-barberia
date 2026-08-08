import { describe, expect, it, vi } from "vitest";

import { createUser, resetUserPassword, updateUser, type UserServiceDependencies } from "./service";
import type { SafeUser } from "@/lib/auth/types";

const owner: SafeUser = {
  id: "00000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "García",
  username: "ana.garcia", role: { id: 1, name: "owner" }, isActive: true,
  lastLoginAt: null, createdAt: "2026-08-07T00:00:00.000Z", updatedAt: "2026-08-07T00:00:00.000Z",
};

const dependencies = () => ({
  users: {
    findById: vi.fn().mockResolvedValue(owner),
    create: vi.fn().mockResolvedValue(owner),
    update: vi.fn().mockResolvedValue(owner),
    countActiveOwners: vi.fn().mockResolvedValue(1),
  },
  sessions: { revokeAllForUser: vi.fn().mockResolvedValue(undefined) },
  hashPassword: vi.fn().mockResolvedValue("$argon2id$v=19$hash"),
}) as unknown as UserServiceDependencies;

describe("user lifecycle", () => {
  it("hashes the password before creating a user", async () => {
    const deps = dependencies();
    await createUser(owner, { firstName: "Luis", lastName: "Pérez", password: "password-2026", roleId: 3 }, deps);
    expect(deps.users.create).toHaveBeenCalledWith(expect.objectContaining({
      passwordHash: "$argon2id$v=19$hash", createdBy: owner.id,
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
});
