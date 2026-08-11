import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager, requireUser } from "@/lib/auth/authorization";
import { customerIdSchema, updateCustomerSchema } from "@/lib/customers/schemas";
import { deleteCustomer, updateCustomer } from "@/lib/customers/service";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) { try { const { user } = await requireUser(); const id = customerIdSchema.parse((await context.params).id); const input = updateCustomerSchema.parse(await request.json()); return successResponse(await updateCustomer(user, id, input)); } catch (error) { return errorResponse(error); } }
export async function DELETE(_request: Request, context: Context) { try { const { user } = await requireManager(); const id = customerIdSchema.parse((await context.params).id); return successResponse(await deleteCustomer(user, id)); } catch (error) { return errorResponse(error); } }
