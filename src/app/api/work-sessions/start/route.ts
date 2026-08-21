import { errorResponse, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/authorization";
import { startWorkSession } from "@/lib/work-sessions/service";

export async function POST() {
  try {
    const { user } = await requireUser();
    return successResponse(await startWorkSession(user), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
