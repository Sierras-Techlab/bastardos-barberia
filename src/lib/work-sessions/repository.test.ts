import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));

import { workSessionRepository } from "@/lib/work-sessions/repository";

const employeeId = "00000000-0000-4000-8000-000000000003";
const managerId = "00000000-0000-4000-8000-000000000001";
const sessionId = "10000000-0000-4000-8000-000000000001";

const employeeSession = {
  id: sessionId,
  employee: { id: employeeId, firstName: "Juan", lastName: "Pérez" },
  businessDate: "2026-08-21",
  startedAt: "2026-08-21T09:00:00.000-03:00",
  endedAt: null,
  state: "open",
  metrics: {
    workedMinutes: 60,
    saleCount: 1,
    employeeCommission: 4500,
  },
};
const managerSession = {
  ...employeeSession,
  metrics: {
    ...employeeSession.metrics,
    grossTotal: 10000,
    barbershopNet: 5500,
  },
};
const pagination = { page: 1, pageSize: 12, total: 1, totalPages: 1 };

describe("workSessionRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls exact lifecycle RPC names and actor-only arguments", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: employeeSession, error: null });
    getSupabaseAdmin.mockReturnValue({ rpc });

    await workSessionRepository.getCurrent(employeeId);
    await workSessionRepository.start(employeeId);
    await workSessionRepository.end(employeeId);

    expect(rpc).toHaveBeenNthCalledWith(1, "get_current_work_session", {
      employee_user_id: employeeId,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "start_work_session", {
      employee_user_id: employeeId,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "end_work_session", {
      employee_user_id: employeeId,
    });
  });

  it("passes exact role-scoped history and correction arguments", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: { items: [employeeSession], pagination },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { items: [managerSession], pagination },
        error: null,
      })
      .mockResolvedValueOnce({ data: managerSession, error: null });
    getSupabaseAdmin.mockReturnValue({ rpc });
    const query = {
      employeeId,
      dateFrom: "2026-08-01",
      dateTo: "2026-08-21",
      page: 1,
      pageSize: 12,
    };
    const correction = {
      startedAt: "2026-08-21T08:50:00.000-03:00",
      endedAt: "2026-08-21T12:30:00.000-03:00",
      reason: "Olvidó registrar la salida",
    };

    await workSessionRepository.listEmployee(employeeId, query);
    await workSessionRepository.listManager(managerId, query);
    await workSessionRepository.correct(managerId, sessionId, correction);

    expect(rpc).toHaveBeenNthCalledWith(1, "list_work_sessions", {
      requesting_user_id: employeeId,
      filter_employee_id: employeeId,
      filter_date_from: "2026-08-01",
      filter_date_to: "2026-08-21",
      page_number: 1,
      page_size: 12,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "list_work_sessions", {
      requesting_user_id: managerId,
      filter_employee_id: employeeId,
      filter_date_from: "2026-08-01",
      filter_date_to: "2026-08-21",
      page_number: 1,
      page_size: 12,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "correct_work_session", {
      manager_user_id: managerId,
      target_session_id: sessionId,
      corrected_started_at: correction.startedAt,
      corrected_ended_at: correction.endedAt,
      correction_reason: correction.reason,
    });
  });

  it("returns null for no current session and rejects manager fields in employee JSON", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { items: [managerSession], pagination },
        error: null,
      });
    getSupabaseAdmin.mockReturnValue({ rpc });

    await expect(workSessionRepository.getCurrent(employeeId)).resolves.toBeNull();
    await expect(
      workSessionRepository.listEmployee(employeeId, {
        employeeId,
        page: 1,
        pageSize: 12,
      }),
    ).rejects.toThrow("No se pudo consultar las jornadas.");
  });

  it.each([
    ["WORK_SESSION_ALREADY_OPEN", "WORK_SESSION_ALREADY_OPEN", 409],
    ["WORK_SESSION_NOT_OPEN", "WORK_SESSION_NOT_OPEN", 409],
    ["WORK_SESSION_CONFLICT", "WORK_SESSION_CONFLICT", 409],
    ["INVALID_WORK_SESSION_RANGE", "INVALID_WORK_SESSION_RANGE", 400],
    ["EMPLOYEE_WORK_SESSION_REQUIRED", "EMPLOYEE_WORK_SESSION_REQUIRED", 409],
  ])("maps %s to a stable AppError", async (sentinel, code, status) => {
    getSupabaseAdmin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: `PostgreSQL error: ${sentinel}`, code: "P0001" },
      }),
    });

    await expect(workSessionRepository.start(employeeId)).rejects.toMatchObject({
      code,
      status,
    });
  });
});
