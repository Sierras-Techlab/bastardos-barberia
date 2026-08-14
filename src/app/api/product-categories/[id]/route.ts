import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager, requireUser } from "@/lib/auth/authorization";
import {
  productCategoryIdSchema,
  updateProductCategorySchema,
} from "@/lib/product-categories/schemas";
import {
  deactivateProductCategory,
  getProductCategory,
  updateProductCategory,
} from "@/lib/product-categories/service";

type ProductCategoryRouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  context: ProductCategoryRouteContext,
) {
  try {
    const { user } = await requireUser();
    const id = productCategoryIdSchema.parse((await context.params).id);
    return successResponse(await getProductCategory(user, id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: ProductCategoryRouteContext,
) {
  try {
    const { user } = await requireManager();
    const id = productCategoryIdSchema.parse((await context.params).id);
    const input = updateProductCategorySchema.parse(await request.json());
    return successResponse(await updateProductCategory(user, id, input));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: ProductCategoryRouteContext,
) {
  try {
    const { user } = await requireManager();
    const id = productCategoryIdSchema.parse((await context.params).id);
    return successResponse(await deactivateProductCategory(user, id));
  } catch (error) {
    return errorResponse(error);
  }
}
