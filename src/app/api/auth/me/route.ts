import { requireUser } from "@/lib/auth/authorization";
import { errorResponse, successResponse } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await requireUser();
    return successResponse({ user: session.user });
  } catch (error) {
    return errorResponse(error);
  }
}
