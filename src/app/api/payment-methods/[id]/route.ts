import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager, requireUser } from "@/lib/auth/authorization";
import {
  paymentMethodIdSchema,
  updatePaymentMethodSchema,
} from "@/lib/payment-methods/schemas";
import {
  deactivatePaymentMethod,
  getPaymentMethod,
  updatePaymentMethod,
} from "@/lib/payment-methods/service";

type PaymentMethodRouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  context: PaymentMethodRouteContext,
) {
  try {
    const { user } = await requireUser();
    const id = paymentMethodIdSchema.parse((await context.params).id);
    return successResponse(await getPaymentMethod(user, id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: PaymentMethodRouteContext,
) {
  try {
    const { user } = await requireManager();
    const id = paymentMethodIdSchema.parse((await context.params).id);
    const input = updatePaymentMethodSchema.parse(await request.json());
    return successResponse(await updatePaymentMethod(user, id, input));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: PaymentMethodRouteContext,
) {
  try {
    const { user } = await requireManager();
    const id = paymentMethodIdSchema.parse((await context.params).id);
    return successResponse(await deactivatePaymentMethod(user, id));
  } catch (error) {
    return errorResponse(error);
  }
}
