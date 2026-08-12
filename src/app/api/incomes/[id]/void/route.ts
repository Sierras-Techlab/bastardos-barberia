import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { incomeIdSchema } from "@/lib/incomes/income-schema";
import { voidIncome } from "@/lib/incomes/service";
type Context = { params: Promise<{ id: string }> };
export async function POST(_request: Request, context: Context) { try { const { user } = await requireManager(); const id = incomeIdSchema.parse((await context.params).id); return successResponse(await voidIncome(user, id)); } catch (error) { return errorResponse(error); } }
