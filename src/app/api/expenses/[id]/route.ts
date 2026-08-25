import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { expenseIdSchema, updateExpenseSchema } from "@/lib/expenses/schemas";
import { getExpense, updateExpense } from "@/lib/expenses/service";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) { try { const { user } = await requireManager(); const id = expenseIdSchema.parse((await context.params).id); return successResponse(await getExpense(user, id)); } catch (error) { return errorResponse(error); } }
export async function PATCH(request: Request, context: Context) { try { const { user } = await requireManager(); const id = expenseIdSchema.parse((await context.params).id); const input = updateExpenseSchema.parse(await request.json()); return successResponse(await updateExpense(user, id, input)); } catch (error) { return errorResponse(error); } }
