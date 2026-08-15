import { errorResponse, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/authorization";
import { occurrenceIdSchema, resolveOccurrenceSchema } from "@/lib/fixed-customers/schemas";
import { resolveFixedOccurrence } from "@/lib/fixed-customers/service";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const { user } = await requireUser();
    const { id: rawId } = await context.params;
    const id = occurrenceIdSchema.parse(rawId);
    const input = resolveOccurrenceSchema.parse(await request.json());
    return successResponse(await resolveFixedOccurrence(user, id, input));
  } catch (error) {
    return errorResponse(error);
  }
}
