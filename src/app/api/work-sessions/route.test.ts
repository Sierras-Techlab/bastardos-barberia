import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, listWorkSessions } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  listWorkSessions: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireUser }));
vi.mock("@/lib/work-sessions/service", () => ({ listWorkSessions }));

import { unauthenticatedError } from "@/lib/auth/errors";

import { GET } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000003" };

describe("GET /api/work-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user: actor });
    listWorkSessions.mockResolvedValue({ items: [], pagination: {} });
  });

  it("authorizes before parsing list filters", async () => {
    const response = await GET(
      new Request("http://localhost/api/work-sessions?dateFrom=bad-date"),
    );

    expect(response.status).toBe(400);
    expect(requireUser.mock.invocationCallOrder[0]).toBeLessThan(
      listWorkSessions.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it("returns unauthenticated before inspecting malformed filters", async () => {
    requireUser.mockRejectedValue(unauthenticatedError());

    const response = await GET(
      new Request("http://localhost/api/work-sessions?employeeId=not-a-uuid"),
    );

    expect(response.status).toBe(401);
    expect(listWorkSessions).not.toHaveBeenCalled();
  });

  it("forwards optional manager filters and stable pagination", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/work-sessions?employeeId=10000000-0000-4000-8000-000000000001&dateFrom=2026-08-01&dateTo=2026-08-15&page=2&pageSize=24",
      ),
    );

    expect(response.status).toBe(200);
    expect(listWorkSessions).toHaveBeenCalledWith(actor, {
      employeeId: "10000000-0000-4000-8000-000000000001",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-15",
      page: 2,
      pageSize: 24,
    });
  });
});
