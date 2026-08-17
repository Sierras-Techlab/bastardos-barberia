import { errorResponse, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/authorization";
import { incomeIdSchema } from "@/lib/incomes/income-schema";
import { getIncome } from "@/lib/incomes/service";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) { try { const { user } = await requireUser(); const id = incomeIdSchema.parse((await context.params).id); return successResponse(await getIncome(user, id)); } catch (error) { return errorResponse(error); } }
