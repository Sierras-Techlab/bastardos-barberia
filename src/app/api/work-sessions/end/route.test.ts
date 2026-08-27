import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, endWorkSession } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  endWorkSession: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireUser }));
vi.mock("@/lib/work-sessions/service", () => ({ endWorkSession }));

import { POST } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000003" };

describe("POST /api/work-sessions/end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user: actor });
    endWorkSession.mockResolvedValue({ id: "session" });
  });

  it("ends with only the authenticated actor and does not read a body", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(endWorkSession).toHaveBeenCalledWith(actor);
  });
});
