import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { cashHistoryQuerySchema } from "@/lib/cash/schemas";
import { listCashHistory } from "@/lib/cash/service";

export const GET = async (request: Request) => {
  try {
    const { user } = await requireManager();
    const params = new URL(request.url).searchParams;
    const optional = (name: string) => params.get(name) || undefined;
    const query = cashHistoryQuerySchema.parse({
      dateFrom: optional("dateFrom"),
      dateTo: optional("dateTo"),
      page: optional("page") ?? 1,
      pageSize: optional("pageSize") ?? 10,
    });

    return successResponse(await listCashHistory(user, query));
  } catch (error) {
    return errorResponse(error);
  }
};
