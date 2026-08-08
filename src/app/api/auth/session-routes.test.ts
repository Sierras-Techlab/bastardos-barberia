import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, getSessionCookie, revokeSession, clearSessionCookie } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getSessionCookie: vi.fn(),
  revokeSession: vi.fn(),
  clearSessionCookie: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireUser }));
vi.mock("@/lib/auth/cookie", () => ({ getSessionCookie, clearSessionCookie }));
vi.mock("@/lib/auth/session", () => ({ revokeSession }));

import { GET as getCurrentUser } from "./me/route";
import { POST as logOut } from "./logout/route";

describe("auth session routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the current safe user", async () => {
    const user = { id: "user-1", username: "ada.lovelace" };
    requireUser.mockResolvedValue({ sessionId: "session-1", user });

    const response = await getCurrentUser();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { user } });
  });

  it("revokes the current session and clears its cookie", async () => {
    getSessionCookie.mockResolvedValue("opaque-token");

    const response = await logOut();

    expect(revokeSession).toHaveBeenCalledWith("opaque-token");
    expect(clearSessionCookie).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it("still clears the cookie when revocation fails", async () => {
    getSessionCookie.mockResolvedValue("opaque-token");
    revokeSession.mockRejectedValue(new Error("database detail"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await logOut();

    expect(clearSessionCookie).toHaveBeenCalledOnce();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("database detail");
  });
});
