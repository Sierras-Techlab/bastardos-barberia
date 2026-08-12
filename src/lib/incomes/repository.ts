import "server-only";
import { AppError } from "@/lib/auth/errors";
import { incomeResponseSchema, paginatedIncomesSchema, type IncomeRepository, type IncomeScope } from "@/lib/incomes/contracts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { IncomeListQuery } from "@/types/income";

const databaseFailure = (operation: string, error: unknown): never => { const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown"; console.error(`Database operation failed: ${operation} (${code})`); throw new Error("No se pudo completar la operación en la base de datos."); };
const rpcFailure = (operation: string, error: { message?: string; code?: string }): never => {
  const message = error.message ?? "";
  if (message.startsWith("INSUFFICIENT_STOCK:")) throw new AppError("INSUFFICIENT_STOCK", `No hay stock suficiente de ${message.slice("INSUFFICIENT_STOCK:".length)}.`, 409);
  const mappings: Record<string, [string, string, number]> = {
    CUSTOMER_NOT_FOUND: ["CUSTOMER_NOT_FOUND", "No encontramos el cliente seleccionado.", 404],
    SERVICE_NOT_AVAILABLE: ["SERVICE_NOT_AVAILABLE", "El servicio seleccionado ya no está disponible.", 409],
    PRODUCT_NOT_FOUND: ["PRODUCT_NOT_FOUND", "No encontramos uno de los productos.", 404],
    PRODUCT_NOT_AVAILABLE: ["PRODUCT_NOT_AVAILABLE", "Uno de los productos ya no está disponible.", 409],
  };
  for (const [sentinel, [code, publicMessage, status]] of Object.entries(mappings)) if (message.includes(sentinel)) throw new AppError(code, publicMessage, status);
  return databaseFailure(operation, error);
};
const detail = async (scope: IncomeScope, id: string) => {
  const { data, error } = await getSupabaseAdmin().rpc("get_income_detail", { requesting_user_id: scope.requestingUserId, can_view_all: scope.canViewAll, target_income_id: id });
  if (error) rpcFailure("get income", error); if (data === null) return null;
  const parsed = incomeResponseSchema.safeParse(data); if (!parsed.success) return databaseFailure("validate income", parsed.error);
  return parsed.data;
};
const listParams = (scope: IncomeScope, query: IncomeListQuery) => ({
  requesting_user_id: scope.requestingUserId, can_view_all: scope.canViewAll, filter_user_id: scope.userId,
  filter_date_from: query.dateFrom ?? null, filter_date_to: query.dateTo ?? null,
  filter_payment_method: query.paymentMethod ?? null, filter_kind: query.kind ?? null, filter_status: query.status ?? null,
  filter_query: query.query ?? null, page_number: query.page, page_size: query.pageSize,
});
export const incomeRepository: IncomeRepository = {
  async create(actorId, input) {
    const { data, error } = await getSupabaseAdmin().rpc("create_income", { actor_user_id: actorId, income_request_id: input.requestId, selected_customer_id: input.customerId, selected_service_id: input.serviceId, product_items: input.products, selected_payment_method: input.paymentMethod });
    if (error) rpcFailure("create income", error); if (typeof data !== "string") return databaseFailure("create income", new Error("Missing income id"));
    const created = await detail({ requestingUserId: actorId, canViewAll: false, userId: actorId }, data as string);
    if (!created) return databaseFailure("create income", new Error("Missing income")); return created;
  },
  async list(scope, query) {
    const { data, error } = await getSupabaseAdmin().rpc("list_incomes", listParams(scope, query));
    if (error) rpcFailure("list incomes", error); const parsed = paginatedIncomesSchema.safeParse(data);
    if (!parsed.success) return databaseFailure("validate incomes", parsed.error); return parsed.data;
  },
  findById: detail,
  async void(id, actorId) {
    const { data, error } = await getSupabaseAdmin().rpc("void_income", { target_income_id: id, actor_user_id: actorId });
    if (error) rpcFailure("void income", error); if (data === null) return null;
    return detail({ requestingUserId: actorId, canViewAll: true, userId: null }, data as string);
  },
};
