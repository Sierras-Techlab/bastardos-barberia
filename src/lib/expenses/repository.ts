import "server-only";
import { AppError } from "@/lib/auth/errors";
import type { ExpenseCategoryRepository, ExpenseRepository } from "@/lib/expenses/contracts";
import { expenseCategorySchema, expenseDetailSchema, expenseMonthSummarySchema, expenseSchema, paginatedExpensesSchema } from "@/lib/expenses/schemas";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type DbError = { message?: string; code?: string };
const fail = (operation: string, error: unknown): never => { const code = typeof error === "object" && error && "code" in error ? String(error.code) : "unknown"; console.error(`Database operation failed: ${operation} (${code})`); throw new Error("No se pudo completar la operación de gastos.", { cause: error }); };
const map = (operation: string, error: DbError): never => {
  const message = error.message ?? "";
  if (message.includes("MANAGER_REQUIRED")) throw new AppError("FORBIDDEN", "No tenés permisos para administrar gastos.", 403);
  if (message.includes("EXPENSE_NOT_FOUND")) throw new AppError("EXPENSE_NOT_FOUND", "No encontramos el gasto.", 404);
  if (message.includes("EXPENSE_CATEGORY_NOT_FOUND")) throw new AppError("EXPENSE_CATEGORY_NOT_FOUND", "No encontramos la categoría.", 404);
  if (message.includes("EXPENSE_CONFLICT")) throw new AppError("EXPENSE_CONFLICT", "El gasto cambió. Actualizá los datos e intentá nuevamente.", 409);
  if (message.includes("EXPENSE_REQUEST_CONFLICT")) throw new AppError("EXPENSE_REQUEST_CONFLICT", "La solicitud ya fue usada con otros datos.", 409);
  if (message.includes("EXPENSE_CATEGORY_IN_USE")) throw new AppError("EXPENSE_CATEGORY_IN_USE", "La categoría tiene gastos asociados y no se puede eliminar.", 409);
  if (message.includes("EXPENSE_CATEGORY_DUPLICATE")) throw new AppError("EXPENSE_CATEGORY_DUPLICATE", "Ya existe una categoría con ese nombre.", 409);
  if (message.includes("EXPENSE_CATEGORY_INACTIVE")) throw new AppError("EXPENSE_CATEGORY_INACTIVE", "La categoría está inactiva.", 409);
  if (message.includes("PAYMENT_METHOD_INVALID")) throw new AppError("PAYMENT_METHOD_INVALID", "El medio de pago no está disponible.", 409);
  if (message.includes("EXPENSE_DATE_FUTURE")) throw new AppError("EXPENSE_DATE_FUTURE", "La fecha contable no puede ser futura.", 400);
  if (message.includes("EXPENSE_NOT_ACTIVE")) throw new AppError("EXPENSE_NOT_ACTIVE", "El gasto ya fue anulado.", 409);
  if (error.code === "PGRST202") throw new AppError("EXPENSE_RPC_OUTDATED", "La base de datos necesita la migración pendiente de Gastos.", 503);
  return fail(operation, error);
};
const parse = <T>(operation: string, schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown } }, value: unknown): T => { const result = schema.safeParse(value); return result.success ? result.data : fail(operation, result.error); };
const rpc = async (name: string, args: Record<string, unknown>) => { const result = await getSupabaseAdmin().rpc(name, args); if (result.error) map(name, result.error); return result.data; };

export const expenseRepository: ExpenseRepository = {
  async list(actorId, q) { return parse("list expenses", paginatedExpensesSchema, await rpc("list_expenses", { actor_user_id: actorId, filter_month: q.month ?? null, filter_date_from: q.dateFrom ?? null, filter_date_to: q.dateTo ?? null, filter_category_id: q.categoryId ?? null, filter_category_type: q.type ?? null, filter_payment_method_id: q.paymentMethodId ?? null, filter_status: q.status ?? null, filter_text: q.text ?? null, page_number: q.page, page_size: q.pageSize })); },
  async get(actorId, id) { const data = await rpc("get_expense", { actor_user_id: actorId, target_expense_id: id }); return data === null ? null : parse("get expense", expenseDetailSchema, data); },
  async create(actorId, input) { return parse("create expense", expenseSchema, await rpc("create_expense", { actor_user_id: actorId, request_id: input.requestId, expense_accounting_date: input.accountingDate, expense_category_id: input.categoryId, expense_amount: input.amount, expense_concept: input.concept, expense_notes: input.notes ?? null, expense_payment_method_id: input.paymentMethodId ?? null })); },
  async update(actorId, id, input) { return parse("update expense", expenseSchema, await rpc("update_expense", { actor_user_id: actorId, target_expense_id: id, expected_updated_at: input.expectedUpdatedAt, change_reason: input.reason, expense_accounting_date: input.accountingDate ?? null, expense_category_id: input.categoryId ?? null, expense_amount: input.amount ?? null, expense_concept: input.concept ?? null, expense_notes: input.notes === undefined ? null : input.notes, notes_supplied: input.notes !== undefined, expense_payment_method_id: input.paymentMethodId === undefined ? null : input.paymentMethodId, payment_method_supplied: input.paymentMethodId !== undefined })); },
  async void(actorId, id, input) { return parse("void expense", expenseSchema, await rpc("void_expense", { actor_user_id: actorId, target_expense_id: id, expected_updated_at: input.expectedUpdatedAt, void_reason: input.reason })); },
  async summary(actorId, month) { return parse("expense summary", expenseMonthSummarySchema, await rpc("get_expense_month_summary", { actor_user_id: actorId, target_month: month })); },
};
export const expenseCategoryRepository: ExpenseCategoryRepository = {
  async list(actorId) { return parse("list expense categories", { safeParse: (v: unknown) => expenseCategorySchema.array().safeParse(v) }, await rpc("list_expense_categories", { actor_user_id: actorId })); },
  async create(actorId, input) { return parse("create expense category", expenseCategorySchema, await rpc("create_expense_category", { actor_user_id: actorId, category_name: input.name, category_type: input.type })); },
  async update(actorId, id, input) { return parse("update expense category", expenseCategorySchema, await rpc("update_expense_category", { actor_user_id: actorId, target_category_id: id, category_name: input.name ?? null, category_type: input.type ?? null, category_is_active: input.isActive ?? null })); },
  async remove(actorId, id) { return String(await rpc("delete_expense_category", { actor_user_id: actorId, target_category_id: id })); },
};
