import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager, requireUser } from "@/lib/auth/authorization";
import { createProductCategorySchema } from "@/lib/product-categories/schemas";
import {
  createProductCategory,
  listProductCategories,
} from "@/lib/product-categories/service";

export async function GET() {
  try {
    const { user } = await requireUser();
    return successResponse(await listProductCategories(user));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireManager();
    const input = createProductCategorySchema.parse(await request.json());
    return successResponse(await createProductCategory(user, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
