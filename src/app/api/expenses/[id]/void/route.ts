import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { expenseIdSchema, voidExpenseSchema } from "@/lib/expenses/schemas";
import { voidExpense } from "@/lib/expenses/service";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) { try { const { user } = await requireManager(); const id = expenseIdSchema.parse((await context.params).id); const input = voidExpenseSchema.parse(await request.json()); return successResponse(await voidExpense(user, id, input)); } catch (error) { return errorResponse(error); } }
