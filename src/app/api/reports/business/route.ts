import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { reportMonthQuerySchema } from "@/lib/reports/schemas";
import { getBusinessReport } from "@/lib/reports/service";

export async function GET(request: Request) {
  try {
    const { user } = await requireManager();
    const { month } = reportMonthQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return successResponse(await getBusinessReport(user, month));
  } catch (error) {
    return errorResponse(error);
  }
}
