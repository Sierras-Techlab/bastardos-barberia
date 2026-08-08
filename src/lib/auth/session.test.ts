import { describe, expect, it, vi } from "vitest";

import { getCurrentSession, type SessionDependencies } from "./session";

const now = new Date("2026-08-07T12:00:00.000Z");
const session = {
  id: "session-id",
  userId: "user-id",
  expiresAt: "2026-08-08T00:00:00.000Z",
  revokedAt: null,
  user: {
    id: "user-id", firstName: "Juan", lastName: "Pérez", username: "juan.perez",
    role: { id: 1 as const, name: "owner" as const }, isActive: true,
    lastLoginAt: null, createdAt: now.toISOString(), updatedAt: now.toISOString(),
  },
};

const deps = (value = session) => ({
  sessions: {
    findByTokenHash: vi.fn().mockResolvedValue(value),
    touch: vi.fn().mockResolvedValue(undefined),
    revoke: vi.fn().mockResolvedValue(undefined),
  },
  hashToken: vi.fn().mockReturnValue("hashed-token"),
}) as unknown as SessionDependencies;

describe("getCurrentSession", () => {
  it("loads and touches a valid database session", async () => {
    const dependencies = deps();
    await expect(getCurrentSession("raw-token", dependencies, now)).resolves.toMatchObject({ sessionId: "session-id" });
    expect(dependencies.sessions.findByTokenHash).toHaveBeenCalledWith("hashed-token");
    expect(dependencies.sessions.touch).toHaveBeenCalledWith("session-id", now.toISOString());
  });

  it("rejects and revokes an expired session", async () => {
    const dependencies = deps({ ...session, expiresAt: "2026-08-07T11:59:59.000Z" });
    await expect(getCurrentSession("raw-token", dependencies, now))
      .rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
    expect(dependencies.sessions.revoke).toHaveBeenCalledWith("session-id", now.toISOString());
  });
});
