import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager, requireUser } from "@/lib/auth/authorization";
import { createPaymentMethodSchema } from "@/lib/payment-methods/schemas";
import {
  createPaymentMethod,
  listPaymentMethods,
} from "@/lib/payment-methods/service";

export async function GET() {
  try {
    const { user } = await requireUser();
    return successResponse(await listPaymentMethods(user));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireManager();
    const input = createPaymentMethodSchema.parse(await request.json());
    return successResponse(await createPaymentMethod(user, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
