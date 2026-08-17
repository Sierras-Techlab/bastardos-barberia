import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import {
  productIdSchema,
  stockAdjustmentSchema,
} from "@/lib/products/schemas";
import { adjustProductStock } from "@/lib/products/service";

type ProductStockRouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  context: ProductStockRouteContext,
) {
  try {
    const { user } = await requireManager();
    const id = productIdSchema.parse((await context.params).id);
    const input = stockAdjustmentSchema.parse(await request.json());
    return successResponse(await adjustProductStock(user, id, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
