import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { serviceIdSchema, updateServiceSchema } from "@/lib/services/schemas";
import { deleteService, updateService } from "@/lib/services/service";

type ServiceRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: ServiceRouteContext) {
  try {
    const { user } = await requireManager();
    const id = serviceIdSchema.parse((await context.params).id);
    const input = updateServiceSchema.parse(await request.json());
    return successResponse(await updateService(user, id, input));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: ServiceRouteContext) {
  try {
    const { user } = await requireManager();
    const id = serviceIdSchema.parse((await context.params).id);
    return successResponse(await deleteService(user, id));
  } catch (error) {
    return errorResponse(error);
  }
}
