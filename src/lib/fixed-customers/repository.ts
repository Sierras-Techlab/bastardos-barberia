import "server-only";
import { AppError } from "@/lib/auth/errors";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fixedCustomerOccurrenceSchema, fixedCustomerOccurrencesSchema, type FixedCustomerRepository } from "./contracts";

const failure = (operation: string, error: unknown): never => {
  const description = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (description.includes("FIXED_OCCURRENCE_NOT_FOUND")) throw new AppError("FIXED_OCCURRENCE_NOT_FOUND", "No encontramos la asistencia.", 404);
  if (description.includes("FIXED_OCCURRENCE_ALREADY_RESOLVED")) throw new AppError("FIXED_OCCURRENCE_ALREADY_RESOLVED", "La asistencia ya fue resuelta.", 409);
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo completar la operaciÃ³n en la base de datos.");
};

export const fixedCustomerRepository: FixedCustomerRepository = {
  async list(actorId, query) {
    const { data, error } = await getSupabaseAdmin().rpc("list_fixed_customer_occurrences", {
      actor_user_id: actorId,
      date_from: query.dateFrom,
      date_to: query.dateTo,
      filter_status: query.status ?? null,
    });
    if (error) failure("list fixed customer occurrences", error);
    const parsed = fixedCustomerOccurrencesSchema.safeParse(data);
    if (!parsed.success) return failure("list fixed customer occurrences", parsed.error);
    return parsed.data;
  },
  async resolve(actorId, id, input) {
    const { data, error } = await getSupabaseAdmin().rpc("resolve_fixed_customer_occurrence", {
      actor_user_id: actorId,
      target_occurrence_id: id,
      new_status: input.status,
      expected_status: input.expectedStatus,
    });
    if (error) failure("resolve fixed customer occurrence", error);
    const parsed = fixedCustomerOccurrenceSchema.safeParse(data);
    if (!parsed.success) return failure("resolve fixed customer occurrence", parsed.error);
    return parsed.data;
  },
};
