import "server-only";
import { AppError } from "@/lib/auth/errors";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  fixedCustomerMonthSchema,
  fixedCustomerMonthsSchema,
} from "@/lib/fixed-customer-payments/schemas";
import type { FixedCustomerPaymentsRepository } from "@/lib/fixed-customer-payments/contracts";
import type {
  FixedCustomerMonthQuery,
  PayFixedCustomerMonthInput,
} from "@/types/fixed-customer-payment";

const databaseFailure = (operation: string, error: unknown): never => {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo completar la operación en la base de datos.");
};

const rpcFailure = (operation: string, error: { message?: string; code?: string }): never => {
  const message = error.message ?? "";
  if (message.includes("FIXED_MONTH_ALREADY_PAID")) {
    throw new AppError("FIXED_MONTH_ALREADY_PAID", "Ese mes ya fue cobrado.", 409);
  }
  if (message.includes("FIXED_MONTH_INVALID_PERIOD")) {
    throw new AppError("FIXED_MONTH_INVALID_PERIOD", "El período seleccionado no es válido.", 400);
  }
  if (message.includes("FIXED_MONTH_CUSTOMER_NOT_FOUND")) {
    throw new AppError("FIXED_MONTH_CUSTOMER_NOT_FOUND", "El cliente seleccionado no tiene un horario activo.", 404);
  }
  if (message.includes("EMPLOYEE_WORK_SESSION_REQUIRED")) {
    throw new AppError("EMPLOYEE_WORK_SESSION_REQUIRED", "Iniciá tu jornada antes de cobrar.", 409);
  }
  if (message.includes("PAYMENT_ALLOCATION_MISMATCH")) {
    throw new AppError("PAYMENT_ALLOCATION_MISMATCH", "La distribución del pago no coincide con el total.", 409);
  }
  return databaseFailure(operation, error);
};

const listParams = (actorId: string, canViewAll: boolean, query: FixedCustomerMonthQuery) => ({
  actor_user_id: actorId,
  can_view_all: canViewAll,
  filter_period: query.period,
  filter_employee_id: query.employeeId ?? null,
});

const payParams = (actorId: string, input: PayFixedCustomerMonthInput) => ({
  actor_user_id: actorId,
  income_request_id: input.requestId,
  target_customer_id: input.customerId,
  target_period: input.period,
  payment_items: input.payments,
});

export const fixedCustomerPaymentRepository: FixedCustomerPaymentsRepository = {
  async list(actorId, canViewAll, query) {
    const { data, error } = await getSupabaseAdmin().rpc("list_fixed_customer_months", listParams(actorId, canViewAll, query));
    if (error) rpcFailure("list fixed customer months", error);
    const parsed = fixedCustomerMonthsSchema.safeParse(data ?? []);
    if (!parsed.success) return databaseFailure("list fixed customer months", parsed.error);
    return parsed.data;
  },
  async pay(actorId, input) {
    const { data, error } = await getSupabaseAdmin().rpc("pay_fixed_customer_month", payParams(actorId, input));
    if (error) rpcFailure("pay fixed customer month", error);
    const parsed = fixedCustomerMonthSchema.safeParse(data);
    if (!parsed.success) return databaseFailure("pay fixed customer month", parsed.error);
    return parsed.data;
  },
  async get(actorId, canViewAll, customerId, period) {
    const { data, error } = await getSupabaseAdmin().rpc("get_fixed_customer_month", {
      actor_user_id: actorId,
      can_view_all: canViewAll,
      target_customer_id: customerId,
      target_period: period,
    });
    if (error) rpcFailure("get fixed customer month", error);
    if (data === null) return null;
    const parsed = fixedCustomerMonthSchema.safeParse(data);
    if (!parsed.success) return databaseFailure("get fixed customer month", parsed.error);
    return parsed.data;
  },
};