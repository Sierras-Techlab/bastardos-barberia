import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import {
  workSessionCorrectionInputSchema,
  workSessionIdSchema,
} from "@/lib/work-sessions/schemas";
import { correctWorkSession } from "@/lib/work-sessions/service";

type WorkSessionRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: Request,
  context: WorkSessionRouteContext,
) {
  try {
    const { user } = await requireManager();
    const id = workSessionIdSchema.parse((await context.params).id);
    const input = workSessionCorrectionInputSchema.parse(await request.json());
    return successResponse(await correctWorkSession(user, id, input));
  } catch (error) {
    return errorResponse(error);
  }
}
