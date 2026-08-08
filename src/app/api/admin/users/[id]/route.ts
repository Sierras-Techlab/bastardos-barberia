import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { updateUserSchema, userIdSchema } from "@/lib/auth/schemas";
import { getUser, updateUser } from "@/lib/users/service";

type UserRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: UserRouteContext) {
  try {
    const { user } = await requireManager();
    const id = userIdSchema.parse((await context.params).id);
    return successResponse(await getUser(user, id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: UserRouteContext) {
  try {
    const { user } = await requireManager();
    const id = userIdSchema.parse((await context.params).id);
    const changes = updateUserSchema.parse(await request.json());
    return successResponse(await updateUser(user, id, changes));
  } catch (error) {
    return errorResponse(error);
  }
}
