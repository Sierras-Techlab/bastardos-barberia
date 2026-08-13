import { describe, expect, it, vi } from "vitest";

import { login, type LoginDependencies } from "./authentication";
import type { CredentialUser } from "./types";

const now = new Date("2026-08-07T12:00:00.000Z");
const user: CredentialUser = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Juan",
  lastName: "Pérez",
  username: "juan.perez",
  role: { id: 1, name: "owner" },
  isActive: true,
  serviceCommissionRate: 0,
  productCommissionRate: 0,
  passwordHash: "$argon2id$v=19$hash",
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};

const dependencies = (overrides: Partial<LoginDependencies> = {}) => ({
  users: {
    findCredentialsByUsername: vi.fn().mockResolvedValue(user),
    recordFailedLogin: vi.fn().mockResolvedValue(undefined),
    recordSuccessfulLogin: vi.fn().mockResolvedValue(undefined),
  },
  sessions: { create: vi.fn().mockResolvedValue("session-id") },
  verifyPassword: vi.fn().mockResolvedValue(true),
  generateToken: vi.fn().mockReturnValue("raw-session-token"),
  hashToken: vi.fn().mockReturnValue("hashed-session-token"),
  ...overrides,
}) as unknown as LoginDependencies;

describe("login", () => {
  it("creates a twelve-hour session storing only the token hash", async () => {
    const deps = dependencies();
    const result = await login({ username: "juan.perez", password: "password-2026" }, deps, now);

    expect(deps.sessions.create).toHaveBeenCalledWith(
      user.id,
      "hashed-session-token",
      "2026-08-08T00:00:00.000Z",
    );
    expect(result.token).toBe("raw-session-token");
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(deps.users.recordSuccessfulLogin).toHaveBeenCalledWith(user.id, now.toISOString());
  });

  it("locks the account on the fifth failed attempt", async () => {
    const lockedUser = { ...user, failedLoginAttempts: 4 };
    const deps = dependencies({
      users: {
        ...dependencies().users,
        findCredentialsByUsername: vi.fn().mockResolvedValue(lockedUser),
        recordFailedLogin: vi.fn().mockResolvedValue(undefined),
      } as never,
      verifyPassword: vi.fn().mockResolvedValue(false),
    });

    await expect(login({ username: user.username, password: "incorrecta" }, deps, now))
      .rejects.toMatchObject({ code: "INVALID_CREDENTIALS", status: 401 });
    expect(deps.users.recordFailedLogin).toHaveBeenCalledWith(
      user.id,
      5,
      "2026-08-07T12:00:00.000Z",
      "2026-08-07T12:15:00.000Z",
    );
  });
});
