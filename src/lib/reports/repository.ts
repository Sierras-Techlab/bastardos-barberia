import "server-only";

import { AppError } from "@/lib/auth/errors";
import { businessReportSchema } from "@/lib/reports/schemas";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ReportRepository } from "./contracts";

type DbError = { message?: string; code?: string };

const fail = (operation: string, error: unknown): never => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo completar la consulta de reportes.", { cause: error });
};

const map = (error: DbError): never => {
  const message = error.message ?? "";
  if (message.includes("REPORT_MONTH_FUTURE") || message.includes("REPORT_MONTH_INVALID")) {
    throw new AppError("REPORT_MONTH_FUTURE", "El mes seleccionado no está disponible.", 400);
  }
  if (message.includes("MANAGER_REQUIRED")) {
    throw new AppError("FORBIDDEN", "No tenés permisos para consultar reportes.", 403);
  }
  if (error.code === "PGRST202") {
    throw new AppError("REPORT_RPC_OUTDATED", "La base de datos necesita la migración pendiente de Reportes.", 503);
  }
  return fail("get business report", error);
};

export const reportRepository: ReportRepository = {
  async get(actorId, month) {
    const result = await getSupabaseAdmin().rpc("get_business_report", {
      actor_user_id: actorId,
      target_month: month,
    });
    if (result.error) map(result.error);
    const parsed = businessReportSchema.safeParse(result.data);
    return parsed.success ? parsed.data : fail("parse business report", parsed.error);
  },
};
