import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, getCurrentWorkSession } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getCurrentWorkSession: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireUser }));
vi.mock("@/lib/work-sessions/service", () => ({ getCurrentWorkSession }));

import { GET } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000003" };

describe("GET /api/work-sessions/current", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user: actor });
    getCurrentWorkSession.mockResolvedValue(null);
  });

  it("gets the authenticated employee current session", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(getCurrentWorkSession).toHaveBeenCalledWith(actor);
    await expect(response.json()).resolves.toEqual({ data: null });
  });
});
