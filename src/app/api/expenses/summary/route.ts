import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { expenseMonthQuerySchema } from "@/lib/expenses/schemas";
import { getExpenseMonthSummary } from "@/lib/expenses/service";
export async function GET(request: Request) { try { const { user } = await requireManager(); const { month } = expenseMonthQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)); return successResponse(await getExpenseMonthSummary(user, month)); } catch (error) { return errorResponse(error); } }
