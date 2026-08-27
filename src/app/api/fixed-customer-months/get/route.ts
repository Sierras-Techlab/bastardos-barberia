import { z } from "zod";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/authorization";
import { getFixedCustomerMonth } from "@/lib/fixed-customer-payments/service";

const querySchema = z.object({
  customerId: z.uuid("Cliente inválido."),
  period: z.string().regex(/^(\d{4})-(0[1-9]|1[0-2])$/, "Período inválido."),
}).strict();

export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const { customerId, period } = querySchema.parse(params);
    const month = await getFixedCustomerMonth(user, customerId, period);
    return successResponse({ month });
  } catch (error) {
    return errorResponse(error);
  }
}