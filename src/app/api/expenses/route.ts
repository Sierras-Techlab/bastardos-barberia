import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { createExpenseSchema, expenseListQuerySchema } from "@/lib/expenses/schemas";
import { createExpense, listExpenses } from "@/lib/expenses/service";

export async function GET(request: Request) { try { const { user } = await requireManager(); const query = expenseListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)); return successResponse(await listExpenses(user, query)); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { const { user } = await requireManager(); const input = createExpenseSchema.parse(await request.json()); return successResponse(await createExpense(user, input), 201); } catch (error) { return errorResponse(error); } }
