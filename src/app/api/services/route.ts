import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager, requireUser } from "@/lib/auth/authorization";
import { createServiceSchema } from "@/lib/services/schemas";
import { createService, listServices } from "@/lib/services/service";

export async function GET() {
  try {
    const { user } = await requireUser();
    return successResponse(await listServices(user));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireManager();
    const input = createServiceSchema.parse(await request.json());
    return successResponse(await createService(user, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
