import { errorResponse, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/authorization";
import { payFixedCustomerMonthSchema } from "@/lib/fixed-customer-payments/schemas";
import { payFixedCustomerMonth } from "@/lib/fixed-customer-payments/service";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = await request.json();
    const mode: "manager" | "employee" = user.role.name === "employee" ? "employee" : "manager";
    const parsed = payFixedCustomerMonthSchema.parse({ mode, ...body });
    const month = await payFixedCustomerMonth(user, parsed);
    return successResponse({ month }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}