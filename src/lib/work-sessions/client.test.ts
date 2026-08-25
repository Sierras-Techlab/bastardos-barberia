import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import {
  WorkSessionApiError,
  workSessionClient,
} from "@/lib/work-sessions/client";

const id = "10000000-0000-4000-8000-000000000001";
const fetchMock = vi.fn<typeof fetch>();
const employeeSession = {
  id,
  employee: {
    id: "00000000-0000-4000-8000-000000000003",
    firstName: "Fernanda",
    lastName: "Pérez",
  },
  businessDate: "2026-08-15",
  startedAt: "2026-08-15T09:00:00.000-03:00",
  endedAt: "2026-08-15T17:00:00.000-03:00",
  updatedAt: "2026-08-15T17:00:00.123-03:00",
  state: "closed" as const,
  metrics: {
    workedMinutes: 480,
    saleCount: 4,
    employeeCommission: 18000,
  },
};
const managerSession = {
  ...employeeSession,
  metrics: {
    ...employeeSession.metrics,
    grossTotal: 52000,
    barbershopNet: 34000,
  },
};
const pagination = { page: 1, pageSize: 12, total: 1, totalPages: 1 };

describe("workSessionClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("parses current and employee history with no-store", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ data: employeeSession }))
      .mockResolvedValueOnce(
        Response.json({ data: { items: [employeeSession], pagination } }),
      );

    await expect(workSessionClient.current()).resolves.toEqual(employeeSession);
    await expect(
      workSessionClient.list(
        {
          employeeId: id,
          dateFrom: "2026-08-01",
          dateTo: "2026-08-15",
          page: 2,
          pageSize: 12,
        },
        "employee",
      ),
    ).resolves.toEqual({ items: [employeeSession], pagination });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/work-sessions/current", {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/work-sessions?employeeId=${id}&dateFrom=2026-08-01&dateTo=2026-08-15&page=2&pageSize=12`,
      { cache: "no-store" },
    );
  });

  it("accepts a null current session", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: null }));

    await expect(workSessionClient.current()).resolves.toBeNull();
  });

  it("rejects manager-only fields in employee success payloads", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ data: { items: [managerSession], pagination } }),
    );

    await expect(
      workSessionClient.list({ page: 1, pageSize: 12 }, "employee"),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("requires manager-shaped history for manager viewers", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ data: { items: [managerSession], pagination } }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { items: [employeeSession], pagination } }),
      );

    await expect(
      workSessionClient.list({ page: 1, pageSize: 12 }, "owner"),
    ).resolves.toEqual({ items: [managerSession], pagination });
    await expect(
      workSessionClient.list({ page: 1, pageSize: 12 }, "admin"),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("parses start and end without sending client-controlled timestamps", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ data: employeeSession }))
      .mockResolvedValueOnce(Response.json({ data: employeeSession }));

    await expect(workSessionClient.start()).resolves.toEqual(employeeSession);
    await expect(workSessionClient.end()).resolves.toEqual(employeeSession);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/work-sessions/start", {
      method: "POST",
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/work-sessions/end", {
      method: "POST",
      cache: "no-store",
    });
  });

  it("parses a manager correction and sends only its public payload", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: managerSession }));
    const input = {
      expectedUpdatedAt: "2026-08-15T12:00:00.123-03:00",
      startedAt: "2026-08-15T09:00:00-03:00",
      endedAt: "2026-08-15T17:00:00-03:00",
      reason: "Corrección de fichada",
    };

    await expect(workSessionClient.correct(id, input)).resolves.toEqual(
      managerSession,
    );

    expect(fetchMock).toHaveBeenCalledWith(`/api/work-sessions/${id}`, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it("preserves structured 409 API error details", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          error: {
            code: "WORK_SESSION_CONFLICT",
            message: "La jornada cambió mientras la estabas editando.",
            fields: { expectedUpdatedAt: ["Actualizá la jornada."] },
          },
        },
        { status: 409 },
      ),
    );

    const failure = workSessionClient.correct(id, {
      expectedUpdatedAt: "2026-08-15T12:00:00.123-03:00",
      startedAt: "2026-08-15T09:00:00-03:00",
      endedAt: "2026-08-15T17:00:00-03:00",
      reason: "Corrección de fichada",
    });

    await expect(failure).rejects.toBeInstanceOf(WorkSessionApiError);
    await expect(failure).rejects.toMatchObject({
      status: 409,
      code: "WORK_SESSION_CONFLICT",
      message: "La jornada cambió mientras la estabas editando.",
      fields: { expectedUpdatedAt: ["Actualizá la jornada."] },
    });
  });
});
