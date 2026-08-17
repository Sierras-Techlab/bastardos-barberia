import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager, requireUser } from "@/lib/auth/authorization";
import { createProductSchema } from "@/lib/products/schemas";
import { createProduct, listProducts } from "@/lib/products/service";

export async function GET() {
  try {
    const { user } = await requireUser();
    return successResponse(await listProducts(user));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireManager();
    const input = createProductSchema.parse(await request.json());
    return successResponse(await createProduct(user, input), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
