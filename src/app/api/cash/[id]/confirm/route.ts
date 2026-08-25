import { z } from "zod";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { confirmCashInputSchema } from "@/lib/cash/schemas";
import { confirmCash } from "@/lib/cash/service";

const idSchema = z.uuid("Identificador de caja inválido.");

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireManager();
    const { id } = await params;
    const registerId = idSchema.parse(id);
    const input = confirmCashInputSchema.parse(await request.json());
    return successResponse(await confirmCash(user, registerId, input));
  } catch (error) {
    return errorResponse(error);
  }
}