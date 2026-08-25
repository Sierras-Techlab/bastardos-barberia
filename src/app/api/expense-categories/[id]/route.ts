import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { updateExpenseCategorySchema } from "@/lib/expenses/schemas";
import { deleteExpenseCategory, updateExpenseCategory } from "@/lib/expenses/service";
type Context = { params: Promise<{ id: string }> }; const idSchema = z.uuid();
export async function PATCH(request: Request, context: Context) { try { const { user } = await requireManager(); const id = idSchema.parse((await context.params).id); const input = updateExpenseCategorySchema.parse(await request.json()); return successResponse(await updateExpenseCategory(user, id, input)); } catch (error) { return errorResponse(error); } }
export async function DELETE(_request: Request, context: Context) { try { const { user } = await requireManager(); const id = idSchema.parse((await context.params).id); return successResponse(await deleteExpenseCategory(user, id)); } catch (error) { return errorResponse(error); } }
