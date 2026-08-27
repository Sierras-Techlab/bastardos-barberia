import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, startWorkSession } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  startWorkSession: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireUser }));
vi.mock("@/lib/work-sessions/service", () => ({ startWorkSession }));

import { unauthenticatedError } from "@/lib/auth/errors";

import { POST } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000003" };

describe("POST /api/work-sessions/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user: actor });
    startWorkSession.mockResolvedValue({ id: "session" });
  });

  it("starts with only the authenticated actor and does not read a body", async () => {
    const response = await POST();

    expect(response.status).toBe(201);
    expect(startWorkSession).toHaveBeenCalledWith(actor);
  });

  it("authorizes before any possible request validation", async () => {
    requireUser.mockRejectedValue(unauthenticatedError());

    const response = await POST();

    expect(response.status).toBe(401);
    expect(startWorkSession).not.toHaveBeenCalled();
  });
});
