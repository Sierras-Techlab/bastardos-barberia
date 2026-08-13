import { errorResponse, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/authorization";
import { fixedOccurrenceQuerySchema } from "@/lib/fixed-customers/schemas";
import { listFixedOccurrences } from "@/lib/fixed-customers/service";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const query = fixedOccurrenceQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return successResponse(await listFixedOccurrences(user, query));
  } catch (error) {
    return errorResponse(error);
  }
}
