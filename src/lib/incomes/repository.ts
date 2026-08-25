import "server-only";
import { AppError } from "@/lib/auth/errors";
import {
  employeeIncomeResponseSchema,
  employeePaginatedIncomesSchema,
  incomeResponsibleEmployeesSchema,
  managerIncomeResponseSchema,
  paginatedIncomesSchema,
  type IncomeRepository,
  type IncomeScope,
  type PaginatedIncomes,
} from "@/lib/incomes/contracts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { IncomeListQuery } from "@/types/income";

const databaseFailure = (operation: string, error: unknown): never => {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo completar la operación en la base de datos.");
};

const rpcFailure = (operation: string, error: { message?: string; code?: string }): never => {
  const message = error.message ?? "";
  if (error.code === "428C9") {
    throw new AppError(
      "INCOME_SCHEMA_OUTDATED",
      "La base de datos necesita la migración pendiente de ingresos.",
      503,
    );
  }
  if (message.startsWith("INSUFFICIENT_STOCK:")) {
    throw new AppError("INSUFFICIENT_STOCK", `No hay stock suficiente de ${message.slice("INSUFFICIENT_STOCK:".length)}.`, 409);
  }
  const mappings: Record<string, [string, string, number]> = {
    CUSTOMER_NOT_FOUND: ["CUSTOMER_NOT_FOUND", "No encontramos el cliente seleccionado.", 404],
    SERVICE_NOT_AVAILABLE: ["SERVICE_NOT_AVAILABLE", "El servicio seleccionado ya no está disponible.", 409],
    PRODUCT_NOT_FOUND: ["PRODUCT_NOT_FOUND", "No encontramos uno de los productos.", 404],
    PRODUCT_NOT_AVAILABLE: ["PRODUCT_NOT_AVAILABLE", "Uno de los productos ya no está disponible.", 409],
    EMPLOYEE_NOT_ELIGIBLE: ["EMPLOYEE_NOT_ELIGIBLE", "El empleado seleccionado no está disponible.", 409],
    EMPLOYEE_WORK_SESSION_REQUIRED: ["EMPLOYEE_WORK_SESSION_REQUIRED", "Iniciá tu jornada antes de registrar una venta.", 409],
    PAYMENT_ALLOCATION_MISMATCH: ["PAYMENT_ALLOCATION_MISMATCH", "La distribución del pago no coincide con el total.", 409],
    PAYMENT_METHOD_NOT_AVAILABLE: ["PAYMENT_METHOD_NOT_AVAILABLE", "Uno de los medios de pago ya no está disponible.", 409],
    INVALID_COMMISSION_OVERRIDE: ["INVALID_COMMISSION_OVERRIDE", "No se puede otorgar el servicio completo en esta venta.", 403],
    INVALID_PRODUCT_COMMISSION_OVERRIDE: ["INVALID_PRODUCT_COMMISSION_OVERRIDE", "No se puede otorgar el producto completo en esta venta.", 403],
    COMMISSION_RATE_OUT_OF_RANGE: ["COMMISSION_RATE_OUT_OF_RANGE", "La comisión configurada no es válida.", 409],
    INCOME_REQUEST_CONFLICT: ["INCOME_REQUEST_CONFLICT", "Este intento de venta ya fue usado con otros datos.", 409],
    PRICE_OVERRIDE_NOT_ALLOWED_FOR_EMPLOYEE: ["PRICE_OVERRIDE_NOT_ALLOWED_FOR_EMPLOYEE", "Solo un manager puede modificar precios.", 403],
    PRICE_OVERRIDE_REASON_REQUIRED: ["PRICE_OVERRIDE_REASON_REQUIRED", "Indicá el motivo del cambio de precio.", 400],
    BASIS_POINTS_PAYMENTS_FORBIDDEN_FOR_MANAGER: ["BASIS_POINTS_PAYMENTS_FORBIDDEN_FOR_MANAGER", "Los porcentajes solo los usan los empleados.", 403],
    ZERO_TOTAL_SALE_REQUIRES_NO_PAYMENTS: ["ZERO_TOTAL_SALE_REQUIRES_NO_PAYMENTS", "Una venta sin cargo no admite medios de pago.", 400],
    CASH_ALREADY_CLOSED: ["CASH_ALREADY_CLOSED", "La caja del día ya está cerrada.", 409],
  };
  for (const [sentinel, [code, publicMessage, status]] of Object.entries(mappings)) {
    if (message.includes(sentinel)) throw new AppError(code, publicMessage, status);
  }
  return databaseFailure(operation, error);
};

const isEmployeeViewer = (scope: IncomeScope) => !scope.canViewAll;

const detail = async (scope: IncomeScope, id: string) => {
  const { data, error } = await getSupabaseAdmin().rpc("get_income_detail", {
    requesting_user_id: scope.requestingUserId,
    can_view_all: scope.canViewAll,
    target_income_id: id,
  });
  if (error) rpcFailure("get income", error);
  if (data === null) return null;
  const schema = isEmployeeViewer(scope) ? employeeIncomeResponseSchema : managerIncomeResponseSchema;
  const parsed = schema.safeParse(data);
  if (!parsed.success) return databaseFailure("validate income", parsed.error);
  return parsed.data;
};

const listParams = (scope: IncomeScope, query: IncomeListQuery) => ({
  requesting_user_id: scope.requestingUserId,
  can_view_all: scope.canViewAll,
  filter_user_id: scope.userId,
  filter_date_from: query.dateFrom ?? null,
  filter_date_to: query.dateTo ?? null,
  filter_payment_method_id: query.paymentMethodId ?? null,
  filter_kind: query.kind ?? null,
  filter_status: query.status ?? null,
  filter_query: query.query ?? null,
  page_number: query.page,
  page_size: query.pageSize,
});

export const incomeRepository: IncomeRepository = {
  async create(actor, input) {
    const { data, error } = await getSupabaseAdmin().rpc("create_income", {
      actor_user_id: actor.id,
      responsible_employee_id: input.employeeId,
      income_request_id: input.requestId,
      selected_customer_id: input.customerId,
      selected_service_id: input.serviceId,
      product_items: input.products,
      payment_items: input.payments,
      grant_full_service_commission: input.grantFullServiceCommission,
      service_price_override: input.servicePriceOverride ?? null,
      product_price_overrides: input.productPriceOverrides ?? {},
    });
    if (error) rpcFailure("create income", error);
    if (typeof data !== "string") return databaseFailure("create income", new Error("Missing income id"));
    const canViewAll = actor.role.name === "owner" || actor.role.name === "admin";
    const created = await detail({ requestingUserId: actor.id, canViewAll, userId: canViewAll ? null : actor.id }, data as string);
    if (!created) return databaseFailure("create income", new Error("Missing income"));
    return created;
  },
  async list(scope, query) {
    const { data, error } = await getSupabaseAdmin().rpc("list_incomes", listParams(scope, query));
    if (error) rpcFailure("list incomes", error);
    if (isEmployeeViewer(scope)) {
      const parsed = employeePaginatedIncomesSchema.safeParse(data);
      if (!parsed.success) return databaseFailure("validate incomes", parsed.error);
      return parsed.data;
    }
    const parsed = paginatedIncomesSchema.safeParse(data);
    if (!parsed.success) return databaseFailure("validate incomes", parsed.error);
    return parsed.data as PaginatedIncomes;
  },
  async listResponsibleEmployees(requestingUserId) {
    const { data, error } = await getSupabaseAdmin().rpc("list_income_responsible_users", { requesting_user_id: requestingUserId });
    if (error) rpcFailure("list income responsible users", error);
    const parsed = incomeResponsibleEmployeesSchema.safeParse(data);
    if (!parsed.success) return databaseFailure("validate income responsible users", parsed.error);
    return parsed.data;
  },
  findById: detail,
  async void(id, actorId) {
    const { data, error } = await getSupabaseAdmin().rpc("void_income", { target_income_id: id, actor_user_id: actorId });
    if (error) rpcFailure("void income", error);
    if (data === null) return null;
    return detail({ requestingUserId: actorId, canViewAll: true, userId: null }, data as string);
  },
};
