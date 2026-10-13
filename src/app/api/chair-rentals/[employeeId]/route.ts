import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { employeeIdSchema } from "@/lib/chair-rentals/schemas";
import { getChairRentalDetail } from "@/lib/chair-rentals/service";
type Context = { params: Promise<{ employeeId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { user } = await requireManager();
    const employeeId = employeeIdSchema.parse((await context.params).employeeId);
    return successResponse(await getChairRentalDetail(user, employeeId));
  } catch (error) { return errorResponse(error); }
}
