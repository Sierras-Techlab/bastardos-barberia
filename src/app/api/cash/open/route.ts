import { errorResponse } from "@/lib/api/response";
import { AppError } from "@/lib/auth/errors";

export async function POST() {
  return errorResponse(
    new AppError(
      "CASH_MANUAL_LIFECYCLE_DISABLED",
      "La caja se abre automáticamente.",
      410,
    ),
  );
}
