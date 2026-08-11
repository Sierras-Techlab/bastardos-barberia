import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import {
  productIdSchema,
  updateProductSchema,
} from "@/lib/products/schemas";
import { updateProduct } from "@/lib/products/service";

type ProductRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: Request,
  context: ProductRouteContext,
) {
  try {
    const { user } = await requireManager();
    const id = productIdSchema.parse((await context.params).id);
    const input = updateProductSchema.parse(await request.json());
    return successResponse(await updateProduct(user, id, input));
  } catch (error) {
    return errorResponse(error);
  }
}
