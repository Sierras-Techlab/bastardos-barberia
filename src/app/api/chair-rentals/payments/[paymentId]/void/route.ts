import { errorResponse, successResponse } from "@/lib/api/response";
import { requireOwner } from "@/lib/auth/authorization";
import { rentalPaymentIdSchema, voidChairRentalSchema } from "@/lib/chair-rentals/schemas";
import { voidChairRental } from "@/lib/chair-rentals/service";
type Context = { params: Promise<{ paymentId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { user } = await requireOwner();
    const paymentId = rentalPaymentIdSchema.parse((await context.params).paymentId);
    const input = voidChairRentalSchema.parse(await request.json());
    return successResponse(await voidChairRental(user, paymentId, input));
  } catch (error) { return errorResponse(error); }
}
