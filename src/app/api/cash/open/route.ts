import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { openCashInputSchema } from "@/lib/cash/schemas";
import { openCash } from "@/lib/cash/service";

export async function POST(request: Request) {
  try {
    const { user } = await requireManager();
    const input = openCashInputSchema.parse(await request.json());
    return successResponse(await openCash(user, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}