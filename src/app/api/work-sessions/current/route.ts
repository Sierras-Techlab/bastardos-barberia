import { errorResponse, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/authorization";
import { getCurrentWorkSession } from "@/lib/work-sessions/service";

export async function GET() {
  try {
    const { user } = await requireUser();
    return successResponse(await getCurrentWorkSession(user));
  } catch (error) {
    return errorResponse(error);
  }
}
