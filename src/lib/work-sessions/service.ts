import { assertManager } from "@/lib/auth/authorization";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { WorkSessionServiceDependencies } from "@/lib/work-sessions/contracts";
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

export const getCurrentWorkSession = async (
  actor: SafeUser,
  dependencies: WorkSessionServiceDependencies,
) => {
  assertEmployee(actor);
  const session = await dependencies.workSessions.getCurrent(actor.id);
  return session === null ? null : employeeWorkSessionSchema.parse(session);
};

export const startWorkSession = async (
  actor: SafeUser,
  dependencies: WorkSessionServiceDependencies,
) => {
  assertEmployee(actor);
  return employeeWorkSessionSchema.parse(
    await dependencies.workSessions.start(actor.id),
  );
};

export const endWorkSession = async (
  actor: SafeUser,
  dependencies: WorkSessionServiceDependencies,
) => {
  assertEmployee(actor);
  return employeeWorkSessionSchema.parse(
    await dependencies.workSessions.end(actor.id),
  );
};

export const listWorkSessions = async (
  actor: SafeUser,
  query: WorkSessionListQuery,
  dependencies: WorkSessionServiceDependencies,
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
  dependencies: WorkSessionServiceDependencies,
) => {
  assertManager(actor);
  return dependencies.workSessions.correct(actor.id, id, input);
};
