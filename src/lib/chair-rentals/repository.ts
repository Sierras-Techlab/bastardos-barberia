import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/auth/errors";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { chairRentalListSchema, chairRentalPaymentSchema } from "./contracts";
import { employeeCommercialAgreementSchema } from "./schemas";
import type { ChairRentalRepository } from "./contracts";

const fail = (operation: string, error: unknown): never => {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const known: Record<string, [string, string, number]> = {
    EMPLOYEE_NOT_FOUND: ["EMPLOYEE_NOT_FOUND", "No encontramos al empleado.", 404],
    AGREEMENT_NOT_ALLOWED: ["AGREEMENT_NOT_ALLOWED", "El acuerdo sólo aplica a empleados.", 409],
    CHAIR_RENTAL_ALREADY_PAID: ["CHAIR_RENTAL_ALREADY_PAID", "Ese período ya tiene un pago activo.", 409],
    CHAIR_RENTAL_NOT_FOUND: ["CHAIR_RENTAL_NOT_FOUND", "No encontramos el pago de alquiler.", 404],
    CHAIR_RENTAL_ALREADY_VOIDED: ["CHAIR_RENTAL_ALREADY_VOIDED", "El pago ya fue anulado.", 409],
    PAYMENT_METHOD_NOT_AVAILABLE: ["PAYMENT_METHOD_NOT_AVAILABLE", "El medio de pago ya no está disponible.", 409],
    CHAIR_RENTAL_REQUEST_CONFLICT: ["CHAIR_RENTAL_REQUEST_CONFLICT", "Este intento ya fue usado con otros datos.", 409],
    CHAIR_RENTAL_NOT_ACTIVE: ["CHAIR_RENTAL_NOT_ACTIVE", "El alquiler no está activo para ese período.", 409],
    OWNER_REQUIRED: ["FORBIDDEN", "Sólo el owner puede realizar esta acción.", 403],
    EMPLOYEE_NOT_ELIGIBLE: ["EMPLOYEE_NOT_ELIGIBLE", "El usuario seleccionado no es un empleado elegible.", 409],
    VOID_REASON_REQUIRED: ["VOID_REASON_REQUIRED", "Indicá un motivo para anular el pago.", 400],
    INVALID_CHAIR_RENTAL_REQUEST: ["INVALID_CHAIR_RENTAL_REQUEST", "La solicitud de alquiler no es válida.", 400],
    CHAIR_RENTAL_CANONICAL_VOID_REQUIRED: ["CHAIR_RENTAL_CANONICAL_VOID_REQUIRED", "Usá la anulación de alquiler.", 409],
  };
  const hit = Object.entries(known).find(([key]) => message.includes(key));
  if (hit) { const [, [code, text, status]] = hit; throw new AppError(code, text, status); }
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo completar la operación en la base de datos.");
};
const parsed = <T>(operation: string, value: unknown, schema: { safeParse(value: unknown): { success: boolean; data?: T } }): T => {
  const result = schema.safeParse(value); if (!result.success) return fail(operation, new Error("Invalid database response")); return result.data as T;
};

export const chairRentalRepository: ChairRentalRepository = {
  async getAgreement(actorId, employeeId) {
    const { data, error } = await getSupabaseAdmin().rpc("get_employee_commercial_agreement", { actor_user_id: actorId, target_employee_id: employeeId });
    if (error) fail("get employee agreement", error); return data === null ? null : parsed("validate employee agreement", data, employeeCommercialAgreementSchema);
  },
  async updateAgreement(actorId, employeeId, input) {
    const { data, error } = await getSupabaseAdmin().rpc("update_employee_commercial_agreement", { actor_user_id: actorId, target_employee_id: employeeId, agreement: input });
    if (error) fail("update employee agreement", error); return data === null ? null : parsed("validate employee agreement", data, employeeCommercialAgreementSchema);
  },
  async list(actorId, query) {
    const { data, error } = await getSupabaseAdmin().rpc("list_chair_rental_payments", { actor_user_id: actorId, filter_period: query.period ?? null, filter_status: query.status ?? null, page_number: query.page, page_size: query.pageSize });
    if (error) fail("list chair rentals", error); return parsed("validate chair rentals", data, chairRentalListSchema);
  },
  async detail(actorId, employeeId) {
    const { data, error } = await getSupabaseAdmin().rpc("get_chair_rental_detail", { actor_user_id: actorId, target_employee_id: employeeId });
    if (error) fail("get chair rental detail", error); return parsed("validate chair rental detail", data, zArrayPayment);
  },
  async confirm(actorId, employeeId, input) {
    const { data, error } = await getSupabaseAdmin().rpc("confirm_chair_rental_payment", { actor_user_id: actorId, target_employee_id: employeeId, billed_period: input.period, target_payment_method_id: input.paymentMethodId, request_id: input.requestId });
    if (error) fail("confirm chair rental", error); return parsed("validate chair rental", data, chairRentalPaymentSchema);
  },
  async void(actorId, paymentId, input) {
    const { data, error } = await getSupabaseAdmin().rpc("void_chair_rental_payment", { actor_user_id: actorId, target_payment_id: paymentId, void_reason: input.reason });
    if (error) fail("void chair rental", error); return parsed("validate chair rental", data, chairRentalPaymentSchema);
  },
};
const zArrayPayment = { safeParse(value: unknown) { const result = z.array(chairRentalPaymentSchema).safeParse(value); return result; } };
