import "server-only";

import { AppError } from "@/lib/auth/errors";
import type { WorkSessionRepository } from "@/lib/work-sessions/contracts";
import {
  employeeWorkSessionSchema,
  managerWorkSessionSchema,
  paginatedEmployeeWorkSessionsSchema,
  paginatedManagerWorkSessionsSchema,
} from "@/lib/work-sessions/schemas";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  WorkSessionCorrectionInput,
  WorkSessionListQuery,
} from "@/types/work-session";

type DatabaseError = { message?: string; code?: string };

const databaseFailure = (operation: string, error: unknown): never => {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo consultar las jornadas.");
};

const rpcFailure = (operation: string, error: DatabaseError): never => {
  const message = error.message ?? "";
  const mappings: Record<string, [string, string, number]> = {
    WORK_SESSION_ALREADY_OPEN: [
      "WORK_SESSION_ALREADY_OPEN",
      "Ya tenés una jornada abierta.",
      409,
    ],
    WORK_SESSION_NOT_OPEN: [
      "WORK_SESSION_NOT_OPEN",
      "No hay una jornada abierta para finalizar.",
      409,
    ],
    WORK_SESSION_CONFLICT: [
      "WORK_SESSION_CONFLICT",
      "La jornada se superpone con otra jornada registrada.",
      409,
    ],
    INVALID_WORK_SESSION_RANGE: [
      "INVALID_WORK_SESSION_RANGE",
      "El rango horario de la jornada no es válido.",
      400,
    ],
    EMPLOYEE_WORK_SESSION_REQUIRED: [
      "EMPLOYEE_WORK_SESSION_REQUIRED",
      "Iniciá tu jornada antes de registrar una venta.",
      409,
    ],
    WORK_SESSION_NOT_FOUND: [
      "WORK_SESSION_NOT_FOUND",
      "No encontramos la jornada.",
      404,
    ],
  };

  for (const [sentinel, [code, publicMessage, status]] of Object.entries(
    mappings,
  )) {
    if (message.includes(sentinel)) {
      throw new AppError(code, publicMessage, status);
    }
  }

  return databaseFailure(operation, error);
};

const parseEmployeeSession = (operation: string, data: unknown) => {
  const parsed = employeeWorkSessionSchema.safeParse(data);
  if (!parsed.success) return databaseFailure(operation, parsed.error);
  return parsed.data;
};

const listParams = (
  requestingUserId: string,
  query: WorkSessionListQuery,
) => ({
  requesting_user_id: requestingUserId,
  filter_employee_id: query.employeeId ?? null,
  filter_date_from: query.dateFrom ?? null,
  filter_date_to: query.dateTo ?? null,
  page_number: query.page,
  page_size: query.pageSize,
});

export const workSessionRepository: WorkSessionRepository = {
  async getCurrent(employeeId) {
    const { data, error } = await getSupabaseAdmin().rpc(
      "get_current_work_session",
      { employee_user_id: employeeId },
    );
    if (error) rpcFailure("get current work session", error);
    if (data === null) return null;
    return parseEmployeeSession("validate current work session", data);
  },

  async start(employeeId) {
    const { data, error } = await getSupabaseAdmin().rpc("start_work_session", {
      employee_user_id: employeeId,
    });
    if (error) rpcFailure("start work session", error);
    return parseEmployeeSession("validate started work session", data);
  },

  async end(employeeId) {
    const { data, error } = await getSupabaseAdmin().rpc("end_work_session", {
      employee_user_id: employeeId,
    });
    if (error) rpcFailure("end work session", error);
    return parseEmployeeSession("validate ended work session", data);
  },

  async listEmployee(requestingUserId, query) {
    const { data, error } = await getSupabaseAdmin().rpc(
      "list_work_sessions",
      listParams(requestingUserId, query),
    );
    if (error) rpcFailure("list employee work sessions", error);
    const parsed = paginatedEmployeeWorkSessionsSchema.safeParse(data);
    if (!parsed.success) {
      return databaseFailure("validate employee work sessions", parsed.error);
    }
    return parsed.data;
  },

  async listManager(requestingUserId, query) {
    const { data, error } = await getSupabaseAdmin().rpc(
      "list_work_sessions",
      listParams(requestingUserId, query),
    );
    if (error) rpcFailure("list manager work sessions", error);
    const parsed = paginatedManagerWorkSessionsSchema.safeParse(data);
    if (!parsed.success) {
      return databaseFailure("validate manager work sessions", parsed.error);
    }
    return parsed.data;
  },

  async correct(
    managerId: string,
    sessionId: string,
    input: WorkSessionCorrectionInput,
  ) {
    const { data, error } = await getSupabaseAdmin().rpc(
      "correct_work_session",
      {
        manager_user_id: managerId,
        target_session_id: sessionId,
        corrected_started_at: input.startedAt,
        corrected_ended_at: input.endedAt,
        correction_reason: input.reason,
      },
    );
    if (error) rpcFailure("correct work session", error);
    const parsed = managerWorkSessionSchema.safeParse(data);
    if (!parsed.success) {
      return databaseFailure("validate corrected work session", parsed.error);
    }
    return parsed.data;
  },
};
