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

const mapCashRpcError = (operation: string, error: DatabaseError): never => {
  const message = error.message ?? "";

  if (message.includes("MANAGER_REQUIRED")) {
    throw new AppError(
      "FORBIDDEN",
      "No tenés permisos para consultar la caja.",
      403,
    );
  }
  if (message.includes("CASH_PAYMENT_METHOD_REQUIRED")) {
    throw new AppError(
      "CASH_PAYMENT_METHOD_REQUIRED",
      "Debe existir un medio de pago Efectivo para abrir la caja.",
      409,
    );
  }
  if (message.includes("CASH_ALREADY_OPEN")) {
    throw new AppError(
      "CASH_ALREADY_OPEN",
      "La caja de hoy ya fue abierta.",
      409,
    );
  }
  if (message.includes("CASH_NOT_OPEN")) {
    throw new AppError(
      "CASH_NOT_OPEN",
      "No hay una caja abierta para cerrar.",
      409,
    );
  }
  if (message.includes("CASH_ALREADY_CONFIRMED")) {
    throw new AppError(
      "CASH_ALREADY_CONFIRMED",
      "Esta caja ya fue confirmada.",
      409,
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
  if (message.includes("INVALID_OPENING_BALANCE")) {
    throw new AppError(
      "INVALID_OPENING_BALANCE",
      "El saldo inicial no puede ser negativo.",
      400,
    );
  }
  if (message.includes("INVALID_COUNTED_CASH")) {
    throw new AppError(
      "INVALID_COUNTED_CASH",
      "El conteo no puede ser negativo.",
      400,
    );
  }

  return databaseFailure(operation, error);
};

const rpcFailure = mapCashRpcError;

const parseCashDay = (operation: string, data: unknown) => {
  const parsed = cashDaySchema.safeParse(data);
  if (!parsed.success) return databaseFailure(operation, parsed.error);
  return parsed.data;
};

export const isCashClosedForDate = async (date: string): Promise<boolean> => {
  const { data, error } = await getSupabaseAdmin()
    .from("daily_cash_registers")
    .select("closed_at")
    .eq("business_date", date)
    .maybeSingle();
  if (error) return databaseFailure("check daily cash closure", error);
  return data?.closed_at !== null && data?.closed_at !== undefined;
};

export const cashRepository: CashRepository = {
  async getDay(actorId, date) {
    const { data, error } = await getSupabaseAdmin().rpc("get_daily_cash", {
      requesting_user_id: actorId,
      target_business_date: date,
    });

    if (error) rpcFailure("get daily cash", error);
    if (data === null) return null;

    return parseCashDay("validate daily cash", data);
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

  async open(actorId, input) {
    const { data, error } = await getSupabaseAdmin().rpc("open_daily_cash", {
      actor_user_id: actorId,
      target_business_date: input.businessDate,
      opening_balance: input.openingBalance,
    });
    if (error) mapCashRpcError("open daily cash", error);
    return parseCashDay("validate opened daily cash", data);
  },

  async close(actorId, input) {
    const { data, error } = await getSupabaseAdmin().rpc("close_daily_cash", {
      actor_user_id: actorId,
      target_business_date: input.businessDate,
      counted_cash: input.countedCash,
    });
    if (error) mapCashRpcError("close daily cash", error);
    return parseCashDay("validate closed daily cash", data);
  },

  async confirm(actorId, registerId, input) {
    const { data, error } = await getSupabaseAdmin().rpc("confirm_daily_cash", {
      actor_user_id: actorId,
      target_register_id: registerId,
      counted_cash: input.countedCash,
    });
    if (error) mapCashRpcError("confirm daily cash", error);
    return parseCashDay("validate confirmed daily cash", data);
  },
};
