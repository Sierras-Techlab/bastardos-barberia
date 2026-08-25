import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { closeCashInputSchema } from "@/lib/cash/schemas";
import { closeCash } from "@/lib/cash/service";

export async function POST(request: Request) {
  try {
    const { user } = await requireManager();
    const input = closeCashInputSchema.parse(await request.json());
    return successResponse(await closeCash(user, input));
  } catch (error) {
    return errorResponse(error);
  }
}