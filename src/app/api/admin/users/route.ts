import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { createUserSchema, userListQuerySchema } from "@/lib/auth/schemas";
import { createUser, listUsers } from "@/lib/users/service";

export async function GET(request: Request) {
  try {
    const { user } = await requireManager();
    const url = new URL(request.url);
    const query = userListQuerySchema.parse(Object.fromEntries(url.searchParams));
    return successResponse(await listUsers(user, query));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireManager();
    const input = createUserSchema.parse(await request.json());
    return successResponse(await createUser(user, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
