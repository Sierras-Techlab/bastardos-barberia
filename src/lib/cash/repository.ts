import "server-only";

import { AppError } from "@/lib/auth/errors";
import type { CashRepository } from "@/lib/cash/contracts";
import {
  cashDaySchema,
  paginatedCashHistorySchema,
} from "@/lib/cash/schemas";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type DatabaseError = { message?: string; code?: string };

const databaseFailure = (operation: string, error: unknown): never => {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo consultar la caja.");
};

const rpcFailure = (operation: string, error: DatabaseError): never => {
  const message = error.message ?? "";

  if (message.includes("MANAGER_REQUIRED")) {
    throw new AppError(
      "FORBIDDEN",
      "No tenés permisos para consultar la caja.",
      403,
    );
  }
  if (message.includes("INVALID_CASH_DATE_RANGE")) {
    throw new AppError(
      "INVALID_CASH_DATE_RANGE",
      "El rango de fechas no es válido.",
      400,
    );
  }
  if (message.includes("INVALID_CASH_DATE")) {
    throw new AppError(
      "INVALID_CASH_DATE",
      "La fecha de caja no es válida.",
      400,
    );
  }

  return databaseFailure(operation, error);
};

export const cashRepository: CashRepository = {
  async getDay(actorId, date) {
    const { data, error } = await getSupabaseAdmin().rpc("get_daily_cash", {
      requesting_user_id: actorId,
      target_business_date: date,
    });

    if (error) rpcFailure("get daily cash", error);
    if (data === null) return null;

    const parsed = cashDaySchema.safeParse(data);
    if (!parsed.success) {
      return databaseFailure("validate daily cash", parsed.error);
    }

    return parsed.data;
  },

  async list(actorId, query) {
    const { data, error } = await getSupabaseAdmin().rpc("list_daily_cash", {
      requesting_user_id: actorId,
      filter_date_from: query.dateFrom ?? null,
      filter_date_to: query.dateTo ?? null,
      page_number: query.page,
      page_size: query.pageSize,
    });

    if (error) rpcFailure("list daily cash", error);

    const parsed = paginatedCashHistorySchema.safeParse(data);
    if (!parsed.success) {
      return databaseFailure("validate daily cash history", parsed.error);
    }

    return parsed.data;
  },
};
