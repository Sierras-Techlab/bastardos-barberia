import { describe, expect, it, vi } from "vitest";

import type { SafeUser } from "@/lib/auth/types";
import type {
  WorkSessionRepository,
  WorkSessionServiceDependencies,
} from "@/lib/work-sessions/contracts";
import {
  correctWorkSession,
  endWorkSession,
  getCurrentWorkSession,
  listWorkSessions,
  startWorkSession,
} from "@/lib/work-sessions/service";
import type {
  EmployeeWorkSession,
  ManagerWorkSession,
} from "@/types/work-session";

const manager: SafeUser = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Ana",
  lastName: "García",
  username: "ana.garcia",
  role: { id: 1, name: "owner" },
  isActive: true,
  serviceCommissionRate: 0,
  productCommissionRate: 0,
  lastLoginAt: null,
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
};
const employee: SafeUser = {
  ...manager,
  id: "00000000-0000-4000-8000-000000000002",
  role: { id: 3, name: "employee" },
};
const session: EmployeeWorkSession = {
  id: "10000000-0000-4000-8000-000000000001",
  employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName },
  businessDate: "2026-08-21",
  startedAt: "2026-08-21T12:00:00.000-03:00",
  endedAt: null,
  state: "open",
  metrics: { workedMinutes: 0, saleCount: 0, employeeCommission: 0 },
};
const managerSession: ManagerWorkSession = {
  ...session,
  metrics: { ...session.metrics, grossTotal: 0, barbershopNet: 0 },
};

const dependencies = (): WorkSessionServiceDependencies => ({
  workSessions: {
    getCurrent: vi.fn().mockResolvedValue(session),
    start: vi.fn().mockResolvedValue(session),
    end: vi.fn().mockResolvedValue({ ...session, endedAt: "2026-08-21T13:00:00.000-03:00", state: "closed" }),
    list: vi.fn().mockResolvedValue({
      items: [managerSession],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    }),
    correct: vi.fn().mockResolvedValue(managerSession),
  } satisfies WorkSessionRepository,
});

describe("work session domain", () => {
  it("allows only employees to obtain, start and end their own session", async () => {
    const deps = dependencies();

    await expect(getCurrentWorkSession(employee, deps)).resolves.toEqual(session);
    await expect(startWorkSession(employee, deps)).resolves.toEqual(session);
    await expect(endWorkSession(employee, deps)).resolves.toMatchObject({ state: "closed" });

    expect(deps.workSessions.getCurrent).toHaveBeenCalledWith(employee.id);
    expect(deps.workSessions.start).toHaveBeenCalledWith(employee.id);
    expect(deps.workSessions.end).toHaveBeenCalledWith(employee.id);
  });

  it("rejects manager session lifecycle operations before persistence", async () => {
    const deps = dependencies();

    await expect(getCurrentWorkSession(manager, deps)).rejects
      .toMatchObject({ code: "EMPLOYEE_REQUIRED", status: 403 });
    await expect(startWorkSession(manager, deps)).rejects
      .toMatchObject({ code: "EMPLOYEE_REQUIRED", status: 403 });
    await expect(endWorkSession(manager, deps)).rejects
      .toMatchObject({ code: "EMPLOYEE_REQUIRED", status: 403 });

    expect(deps.workSessions.getCurrent).not.toHaveBeenCalled();
    expect(deps.workSessions.start).not.toHaveBeenCalled();
    expect(deps.workSessions.end).not.toHaveBeenCalled();
  });

  it("forces employee history to the authenticated employee", async () => {
    const deps = dependencies();

    await listWorkSessions(employee, {
      employeeId: manager.id,
      dateFrom: "2026-08-01",
      page: 2,
      pageSize: 20,
    }, deps);

    expect(deps.workSessions.list).toHaveBeenCalledWith(employee.id, {
      employeeId: employee.id,
      dateFrom: "2026-08-01",
      page: 2,
      pageSize: 20,
    });
  });

  it("retains a manager-selected employee filter for manager history", async () => {
    const deps = dependencies();

    await listWorkSessions(manager, { employeeId: employee.id, page: 1, pageSize: 12 }, deps);

    expect(deps.workSessions.list).toHaveBeenCalledWith(manager.id, {
      employeeId: employee.id,
      page: 1,
      pageSize: 12,
    });
  });

  it("allows only managers to correct sessions and forwards their authenticated identity", async () => {
    const deps = dependencies();
    const correction = {
      startedAt: "2026-08-21T12:00:00.000-03:00",
      endedAt: "2026-08-21T13:00:00.000-03:00",
      reason: "Olvidó marcar salida",
    };

    await expect(correctWorkSession(manager, session.id, correction, deps)).resolves
      .toEqual(managerSession);
    await expect(correctWorkSession(employee, session.id, correction, deps)).rejects
      .toMatchObject({ code: "FORBIDDEN", status: 403 });

    expect(deps.workSessions.correct).toHaveBeenCalledWith(manager.id, session.id, correction);
  });
});
