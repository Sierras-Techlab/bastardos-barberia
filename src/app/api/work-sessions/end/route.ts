import { errorResponse, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/authorization";
import { endWorkSession } from "@/lib/work-sessions/service";

export async function POST() {
  try {
    const { user } = await requireUser();
    return successResponse(await endWorkSession(user));
  } catch (error) {
    return errorResponse(error);
  }
}
