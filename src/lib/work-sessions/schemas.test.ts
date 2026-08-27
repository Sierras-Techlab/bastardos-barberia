import { describe, expect, it } from "vitest";

import {
  employeeWorkSessionSchema,
  managerWorkSessionSchema,
  workSessionCorrectionInputSchema,
  workSessionListQuerySchema,
} from "@/lib/work-sessions/schemas";

const employee = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Fernanda",
  lastName: "Pérez",
};

const employeeSession = {
  id: "10000000-0000-4000-8000-000000000001",
  employee,
  businessDate: "2026-08-21",
  startedAt: "2026-08-21T12:00:00.000-03:00",
  endedAt: null,
  updatedAt: "2026-08-21T12:00:00.123-03:00",
  state: "open" as const,
  metrics: {
    workedMinutes: 75,
    saleCount: 2,
    employeeCommission: 8400,
  },
};

describe("work session boundary schemas", () => {
  it("accepts an employee session without manager financial metrics", () => {
    expect(employeeWorkSessionSchema.parse(employeeSession)).toEqual(employeeSession);
  });

  it("rejects manager-only metrics in an employee session", () => {
    expect(employeeWorkSessionSchema.safeParse({
      ...employeeSession,
      metrics: { ...employeeSession.metrics, grossTotal: 21000 },
    }).success).toBe(false);
  });

  it("accepts manager financial metrics only in the manager shape", () => {
    expect(managerWorkSessionSchema.parse({
      ...employeeSession,
      metrics: {
        ...employeeSession.metrics,
        grossTotal: 21000,
        barbershopNet: 12600,
      },
    })).toMatchObject({ metrics: { grossTotal: 21000, barbershopNet: 12600 } });
  });

  it("requires an offset-bearing optimistic version timestamp", () => {
    const withoutVersion: Record<string, unknown> = { ...employeeSession };
    delete withoutVersion.updatedAt;

    expect(employeeWorkSessionSchema.safeParse(withoutVersion).success).toBe(false);
    expect(employeeWorkSessionSchema.safeParse({
      ...employeeSession,
      updatedAt: "2026-08-21T12:00:00.123",
    }).success).toBe(false);
  });

  it("rejects unknown fields, offset-less timestamps and negative metrics", () => {
    expect(employeeWorkSessionSchema.safeParse({
      ...employeeSession,
      unknown: true,
    }).success).toBe(false);
    expect(employeeWorkSessionSchema.safeParse({
      ...employeeSession,
      startedAt: "2026-08-21T12:00:00.000",
    }).success).toBe(false);
    expect(employeeWorkSessionSchema.safeParse({
      ...employeeSession,
      metrics: { ...employeeSession.metrics, workedMinutes: -1 },
    }).success).toBe(false);
    expect(managerWorkSessionSchema.safeParse({
      ...employeeSession,
      metrics: {
        ...employeeSession.metrics,
        grossTotal: -1,
        barbershopNet: 0,
      },
    }).success).toBe(false);
  });

  it("requires timestamps consistent with the session lifecycle", () => {
    expect(employeeWorkSessionSchema.safeParse({
      ...employeeSession,
      state: "closed",
    }).success).toBe(false);
    expect(employeeWorkSessionSchema.safeParse({
      ...employeeSession,
      endedAt: "2026-08-21T13:15:00.000-03:00",
    }).success).toBe(false);
  });

  it("trims correction reasons and rejects blank reasons, unknown fields and invalid ranges", () => {
    expect(workSessionCorrectionInputSchema.parse({
      expectedUpdatedAt: employeeSession.updatedAt,
      startedAt: "2026-08-21T12:00:00.000-03:00",
      endedAt: "2026-08-21T13:15:00.000-03:00",
      reason: "  Olvidó marcar salida  ",
    })).toEqual({
      expectedUpdatedAt: employeeSession.updatedAt,
      startedAt: "2026-08-21T12:00:00.000-03:00",
      endedAt: "2026-08-21T13:15:00.000-03:00",
      reason: "Olvidó marcar salida",
    });
    expect(workSessionCorrectionInputSchema.safeParse({
      expectedUpdatedAt: employeeSession.updatedAt,
      startedAt: "2026-08-21T12:00:00.000-03:00",
      endedAt: null,
      reason: "   ",
    }).success).toBe(false);
    expect(workSessionCorrectionInputSchema.safeParse({
      expectedUpdatedAt: employeeSession.updatedAt,
      startedAt: "2026-08-21T12:00:00.000-03:00",
      endedAt: "2026-08-21T11:59:00.000-03:00",
      reason: "Hora equivocada",
    }).success).toBe(false);
    expect(workSessionCorrectionInputSchema.safeParse({
      expectedUpdatedAt: employeeSession.updatedAt,
      startedAt: "2026-08-21T12:00:00.000-03:00",
      endedAt: null,
      reason: "Correcta",
      actorId: employee.id,
    }).success).toBe(false);
    expect(workSessionCorrectionInputSchema.safeParse({
      expectedUpdatedAt: "2026-08-21T12:00:00.123",
      startedAt: "2026-08-21T12:00:00.000-03:00",
      endedAt: null,
      reason: "Correcta",
    }).success).toBe(false);
  });

  it("parses strict, bounded history queries", () => {
    expect(workSessionListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 12 });
    expect(workSessionListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(workSessionListQuerySchema.safeParse({ dateFrom: "2026-08-22", dateTo: "2026-08-21" }).success)
      .toBe(false);
    expect(workSessionListQuerySchema.safeParse({ employeeId: employee.id, extra: true }).success)
      .toBe(false);
  });
});
