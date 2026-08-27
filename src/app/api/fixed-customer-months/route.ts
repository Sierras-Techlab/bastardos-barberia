import { errorResponse, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/authorization";
import { fixedCustomerMonthQuerySchema } from "@/lib/fixed-customer-payments/schemas";
import { listFixedCustomerMonths } from "@/lib/fixed-customer-payments/service";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const query = fixedCustomerMonthQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const items = await listFixedCustomerMonths(user, query);
    return successResponse({ items });
  } catch (error) {
    return errorResponse(error);
  }
}