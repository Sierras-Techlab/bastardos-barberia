import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager, requireOwner } from "@/lib/auth/authorization";
import { employeeCommercialAgreementSchema } from "@/lib/chair-rentals/schemas";
import { getEmployeeAgreement, updateEmployeeAgreement } from "@/lib/chair-rentals/service";
import { userIdSchema } from "@/lib/auth/schemas";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { user } = await requireManager();
    const id = userIdSchema.parse((await context.params).id);
    return successResponse(await getEmployeeAgreement(user, id));
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const { user } = await requireOwner();
    const id = userIdSchema.parse((await context.params).id);
    const input = employeeCommercialAgreementSchema.parse(await request.json());
    return successResponse(await updateEmployeeAgreement(user, id, input));
  } catch (error) { return errorResponse(error); }
}
