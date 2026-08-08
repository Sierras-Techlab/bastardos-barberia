import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { resetPasswordSchema, userIdSchema } from "@/lib/auth/schemas";
import { resetUserPassword } from "@/lib/users/service";

type PasswordRouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: PasswordRouteContext) {
  try {
    const { user } = await requireManager();
    const id = userIdSchema.parse((await context.params).id);
    const { password } = resetPasswordSchema.parse(await request.json());
    return successResponse(await resetUserPassword(user, id, password));
  } catch (error) {
    return errorResponse(error);
  }
}
