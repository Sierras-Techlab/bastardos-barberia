import { errorResponse, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/authorization";
import { workSessionListQuerySchema } from "@/lib/work-sessions/schemas";
import { listWorkSessions } from "@/lib/work-sessions/service";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const params = new URL(request.url).searchParams;
    const optional = (name: string) => params.get(name) || undefined;
    const query = workSessionListQuerySchema.parse({
      employeeId: optional("employeeId"),
      dateFrom: optional("dateFrom"),
      dateTo: optional("dateTo"),
      page: optional("page") ?? 1,
      pageSize: optional("pageSize") ?? 12,
    });
    return successResponse(await listWorkSessions(user, query));
  } catch (error) {
    return errorResponse(error);
  }
}
