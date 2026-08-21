import { beforeEach, describe, expect, it, vi } from "vitest";

import { workSessionClient } from "@/lib/work-sessions/client";

const id = "10000000-0000-4000-8000-000000000001";
const fetchMock = vi.fn<typeof fetch>();

describe("workSessionClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async () => Response.json({ data: {} }));
  });

  it("reads current and history with no-store", async () => {
    await workSessionClient.current();
    await workSessionClient.list({
      employeeId: id,
      dateFrom: "2026-08-01",
      dateTo: "2026-08-15",
      page: 2,
      pageSize: 12,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/work-sessions/current",
      { cache: "no-store" },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/work-sessions?employeeId=${id}&dateFrom=2026-08-01&dateTo=2026-08-15&page=2&pageSize=12`,
      { cache: "no-store" },
    );
  });

  it("starts and ends without sending client-controlled timestamps", async () => {
    await workSessionClient.start();
    await workSessionClient.end();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/work-sessions/start", {
      method: "POST",
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/work-sessions/end", {
      method: "POST",
      cache: "no-store",
    });
  });

  it("sends only a correction payload through the manager endpoint", async () => {
    await workSessionClient.correct(id, {
      startedAt: "2026-08-15T09:00:00-03:00",
      endedAt: "2026-08-15T17:00:00-03:00",
      reason: "Corrección de fichada",
    });

    expect(fetchMock).toHaveBeenCalledWith(`/api/work-sessions/${id}`, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startedAt: "2026-08-15T09:00:00-03:00",
        endedAt: "2026-08-15T17:00:00-03:00",
        reason: "Corrección de fichada",
      }),
    });
  });
});
