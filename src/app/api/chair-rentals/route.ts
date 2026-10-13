import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { chairRentalListQuerySchema } from "@/lib/chair-rentals/schemas";
import { listChairRentals } from "@/lib/chair-rentals/service";

export async function GET(request: Request) {
  try {
    const { user } = await requireManager();
    const query = chairRentalListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return successResponse(await listChairRentals(user, query));
  } catch (error) { return errorResponse(error); }
}
