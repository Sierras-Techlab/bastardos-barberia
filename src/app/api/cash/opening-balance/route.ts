import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { setCashOpeningBalanceInputSchema } from "@/lib/cash/schemas";
import { setCashOpeningBalance } from "@/lib/cash/service";

export async function POST(request: Request) {
  try {
    const { user } = await requireManager();
    const input = setCashOpeningBalanceInputSchema.parse(await request.json());
    return successResponse(await setCashOpeningBalance(user, input));
  } catch (error) {
    return errorResponse(error);
  }
}
