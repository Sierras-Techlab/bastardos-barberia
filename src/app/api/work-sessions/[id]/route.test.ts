import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireManager, correctWorkSession } = vi.hoisted(() => ({
  requireManager: vi.fn(),
  correctWorkSession: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/work-sessions/service", () => ({ correctWorkSession }));

import { unauthenticatedError } from "@/lib/auth/errors";

import { PATCH } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000001" };
const id = "10000000-0000-4000-8000-000000000001";

describe("PATCH /api/work-sessions/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireManager.mockResolvedValue({ user: actor });
    correctWorkSession.mockResolvedValue({ id });
  });

  it("awaits the dynamic id and passes only the strict correction input", async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/work-sessions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          startedAt: "2026-08-15T09:00:00-03:00",
          endedAt: "2026-08-15T17:00:00-03:00",
          reason: "Corrección de fichada",
        }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(200);
    expect(correctWorkSession).toHaveBeenCalledWith(actor, id, {
      startedAt: "2026-08-15T09:00:00-03:00",
      endedAt: "2026-08-15T17:00:00-03:00",
      reason: "Corrección de fichada",
    });
  });

  it("authorizes before resolving params or parsing a body", async () => {
    requireManager.mockRejectedValue(unauthenticatedError());

    const response = await PATCH(
      new Request("http://localhost/api/work-sessions/not-a-uuid", {
        method: "PATCH",
        body: "not-json",
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    expect(response.status).toBe(401);
    expect(correctWorkSession).not.toHaveBeenCalled();
  });

  it("rejects extra correction properties", async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/work-sessions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          startedAt: "2026-08-15T09:00:00-03:00",
          endedAt: null,
          reason: "Corrección de fichada",
          employeeId: "20000000-0000-4000-8000-000000000001",
        }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(400);
    expect(correctWorkSession).not.toHaveBeenCalled();
  });
});
