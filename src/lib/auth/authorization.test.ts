import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  redirect,
  getSessionCookie,
  getCurrentSession,
} = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionCookie: vi.fn(),
  getCurrentSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./cookie", () => ({ getSessionCookie }));
vi.mock("./session", () => ({ getCurrentSession }));

import { assertManager, requireManagerPage } from "./authorization";
import { AppError } from "./errors";
import type { SafeUser } from "./types";

const user = (name: "owner" | "admin" | "employee") => ({
  id: "user-id", firstName: "Ana", lastName: "García", username: "ana.garcia",
  role: { id: name === "owner" ? 1 : name === "admin" ? 2 : 3, name }, isActive: true,
  lastLoginAt: null, createdAt: "2026-08-07T00:00:00.000Z", updatedAt: "2026-08-07T00:00:00.000Z",
}) as SafeUser;

describe("assertManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionCookie.mockResolvedValue("session-token");
  });

  it.each(["owner", "admin"] as const)("accepts %s", (role) => {
    expect(assertManager(user(role))).toEqual(user(role));
  });

  it("rejects employees", () => {
    expect(() => assertManager(user("employee"))).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("redirects unauthenticated manager pages to login", async () => {
    getCurrentSession.mockRejectedValue(
      new AppError("UNAUTHORIZED", "Sesión requerida.", 401),
    );

    await expect(requireManagerPage()).rejects.toThrow("REDIRECT:/login");

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects employees away from manager pages", async () => {
    getCurrentSession.mockResolvedValue({
      sessionId: "session-id",
      expiresAt: "2026-08-09T00:00:00.000Z",
      user: user("employee"),
    });

    await expect(requireManagerPage()).rejects.toThrow("REDIRECT:/");

    expect(redirect).toHaveBeenCalledWith("/");
  });

  it.each(["owner", "admin"] as const)(
    "returns the live %s session for manager pages",
    async (role) => {
      const session = {
        sessionId: "session-id",
        expiresAt: "2026-08-09T00:00:00.000Z",
        user: user(role),
      };
      getCurrentSession.mockResolvedValue(session);

      await expect(requireManagerPage()).resolves.toEqual(session);

      expect(redirect).not.toHaveBeenCalled();
    },
  );
});
