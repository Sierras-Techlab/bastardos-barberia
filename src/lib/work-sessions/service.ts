import { assertManager } from "@/lib/auth/authorization";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { WorkSessionServiceDependencies } from "@/lib/work-sessions/contracts";
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
  return dependencies.workSessions.getCurrent(actor.id);
};

export const startWorkSession = async (
  actor: SafeUser,
  dependencies: WorkSessionServiceDependencies,
) => {
  assertEmployee(actor);
  return dependencies.workSessions.start(actor.id);
};

export const endWorkSession = async (
  actor: SafeUser,
  dependencies: WorkSessionServiceDependencies,
) => {
  assertEmployee(actor);
  return dependencies.workSessions.end(actor.id);
};

export const listWorkSessions = async (
  actor: SafeUser,
  query: WorkSessionListQuery,
  dependencies: WorkSessionServiceDependencies,
) => {
  const scopedQuery = actor.role.name === "employee"
    ? { ...query, employeeId: actor.id }
    : (assertManager(actor), query);

  return dependencies.workSessions.list(actor.id, scopedQuery);
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
