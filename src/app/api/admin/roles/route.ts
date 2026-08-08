import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { listRoles } from "@/lib/users/service";

export async function GET() {
  try {
    const { user } = await requireManager();
    return successResponse(await listRoles(user));
  } catch (error) {
    return errorResponse(error);
  }
}
