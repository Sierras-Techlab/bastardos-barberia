import { z } from "zod";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireManager } from "@/lib/auth/authorization";
import { getBuenosAiresToday } from "@/lib/cash/date";
import { getCashDay } from "@/lib/cash/service";

const cashDateSchema = z.object({ date: z.iso.date() }).strict();

export const GET = async (request: Request) => {
  try {
    const { user } = await requireManager();
    const params = new URL(request.url).searchParams;
    const { date } = cashDateSchema.parse({
      date: params.get("date") || getBuenosAiresToday(),
    });

    return successResponse(await getCashDay(user, date));
  } catch (error) {
    return errorResponse(error);
  }
};

