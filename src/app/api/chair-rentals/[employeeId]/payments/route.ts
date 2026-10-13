import { errorResponse, successResponse } from "@/lib/api/response";
import { requireOwner } from "@/lib/auth/authorization";
import { confirmChairRentalSchema, employeeIdSchema } from "@/lib/chair-rentals/schemas";
import { confirmChairRental } from "@/lib/chair-rentals/service";
type Context = { params: Promise<{ employeeId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { user } = await requireOwner();
    const employeeId = employeeIdSchema.parse((await context.params).employeeId);
    const input = confirmChairRentalSchema.parse(await request.json());
    return successResponse(await confirmChairRental(user, employeeId, input), 201);
  } catch (error) { return errorResponse(error); }
}
