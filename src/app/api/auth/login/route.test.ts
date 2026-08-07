import { beforeEach, describe, expect, it, vi } from "vitest";

const { login, setSessionCookie } = vi.hoisted(() => ({
  login: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("@/lib/auth/authentication", () => ({ login }));
vi.mock("@/lib/auth/cookie", () => ({ setSessionCookie }));

import { POST } from "./route";

describe("POST /api/auth/login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates the session cookie and returns only the safe user", async () => {
    const user = { id: "user-1", username: "ada.lovelace" };
    login.mockResolvedValue({ user, token: "opaque-token", expiresAt: "tomorrow" });

    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "Ada.Lovelace", password: "a-password" }),
    }));

    expect(login).toHaveBeenCalledWith({ username: "ada.lovelace", password: "a-password" });
    expect(setSessionCookie).toHaveBeenCalledWith("opaque-token");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { user } });
  });

  it("rejects invalid input without calling authentication", async () => {
    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "x", password: "" }),
    }));

    expect(response.status).toBe(400);
    expect(login).not.toHaveBeenCalled();
  });
});
