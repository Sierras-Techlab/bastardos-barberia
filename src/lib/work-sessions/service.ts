import { assertManager } from "@/lib/auth/authorization";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { WorkSessionServiceDependencies } from "@/lib/work-sessions/contracts";
import { workSessionRepository } from "@/lib/work-sessions/repository";
import {
  employeeWorkSessionSchema,
  paginatedEmployeeWorkSessionsSchema,
  paginatedManagerWorkSessionsSchema,
} from "@/lib/work-sessions/schemas";
import type {
  WorkSessionCorrectionInput,
  WorkSessionListQuery,
} from "@/types/work-session";

const assertEmployee = (actor: SafeUser) => {
  if (actor.role.name !== "employee") {
    throw new AppError(
      "EMPLOYEE_REQUIRED",
      "Esta acción corresponde a empleados.",
      403,
    );
  }
};

const defaultDependencies: WorkSessionServiceDependencies = {
  workSessions: workSessionRepository,
};

export const getCurrentWorkSession = async (
  actor: SafeUser,
  dependencies: WorkSessionServiceDependencies = defaultDependencies,
) => {
  assertEmployee(actor);
  const session = await dependencies.workSessions.getCurrent(actor.id);
  return session === null ? null : employeeWorkSessionSchema.parse(session);
};

export const startWorkSession = async (
  actor: SafeUser,
  dependencies: WorkSessionServiceDependencies = defaultDependencies,
) => {
  assertEmployee(actor);
  return employeeWorkSessionSchema.parse(
    await dependencies.workSessions.start(actor.id),
  );
};

export const endWorkSession = async (
  actor: SafeUser,
  dependencies: WorkSessionServiceDependencies = defaultDependencies,
) => {
  assertEmployee(actor);
  return employeeWorkSessionSchema.parse(
    await dependencies.workSessions.end(actor.id),
  );
};

export const listWorkSessions = async (
  actor: SafeUser,
  query: WorkSessionListQuery,
  dependencies: WorkSessionServiceDependencies = defaultDependencies,
) => {
  if (actor.role.name === "employee") {
    return paginatedEmployeeWorkSessionsSchema.parse(
      await dependencies.workSessions.listEmployee(actor.id, {
        ...query,
        employeeId: actor.id,
      }),
    );
  }

  assertManager(actor);
  return paginatedManagerWorkSessionsSchema.parse(
    await dependencies.workSessions.listManager(actor.id, query),
  );
};

export const correctWorkSession = async (
  actor: SafeUser,
  id: string,
  input: WorkSessionCorrectionInput,
  dependencies: WorkSessionServiceDependencies = defaultDependencies,
) => {
  assertManager(actor);
  return dependencies.workSessions.correct(actor.id, id, input);
};
