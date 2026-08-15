import { errorResponse, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/authorization";
import { customerIdSchema, customerVisitQuerySchema } from "@/lib/customers/schemas";
import { listCustomerVisits } from "@/lib/customers/service";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { user } = await requireUser();
    const { id: rawId } = await context.params;
    const id = customerIdSchema.parse(rawId);
    const query = customerVisitQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return successResponse(await listCustomerVisits(user, id, query));
  } catch (error) {
    return errorResponse(error);
  }
}
