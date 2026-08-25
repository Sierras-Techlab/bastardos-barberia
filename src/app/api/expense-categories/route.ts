import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { createExpenseCategorySchema } from "@/lib/expenses/schemas";
import { createExpenseCategory, listExpenseCategories } from "@/lib/expenses/service";
export async function GET() { try { const { user } = await requireManager(); return successResponse(await listExpenseCategories(user)); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { const { user } = await requireManager(); const input = createExpenseCategorySchema.parse(await request.json()); return successResponse(await createExpenseCategory(user, input), 201); } catch (error) { return errorResponse(error); } }
