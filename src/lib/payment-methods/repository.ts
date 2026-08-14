import "server-only";

import { AppError } from "@/lib/auth/errors";
import type { PaymentMethodRepository } from "@/lib/payment-methods/contracts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  PaymentMethod,
  PaymentMethodInput,
} from "@/types/payment-method";

const PAYMENT_METHOD_SELECT =
  "id,name,normalized_name,is_active,created_by,updated_by,created_at,updated_at";

type PaymentMethodRow = {
  id: string;
  name: string;
  normalized_name: string;
  is_active: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export const toPaymentMethod = (row: PaymentMethodRow): PaymentMethod => ({
  id: row.id,
  name: row.name,
  isActive: row.is_active,
});

const databaseFailure = (operation: string, error: unknown): never => {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo completar la operación en la base de datos.");
};

const mutationFailure = (
  operation: string,
  error: { code?: string; message?: string },
): never => {
  if (error.code === "23505" || error.message === "PAYMENT_METHOD_NAME_EXISTS") {
    throw new AppError(
      "PAYMENT_METHOD_NAME_EXISTS",
      "Ya existe un medio de pago con ese nombre.",
      409,
    );
  }
  if (error.message === "LAST_ACTIVE_PAYMENT_METHOD") {
    throw new AppError(
      "LAST_ACTIVE_PAYMENT_METHOD",
      "Debe quedar al menos un medio de pago activo.",
      409,
    );
  }
  return databaseFailure(operation, error);
};

const findPaymentMethodById = async (id: string) => {
  const { data, error } = await getSupabaseAdmin()
    .from("payment_methods")
    .select(PAYMENT_METHOD_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) databaseFailure("find payment method", error);
  return data ? toPaymentMethod(data as PaymentMethodRow) : null;
};

export const paymentMethodRepository: PaymentMethodRepository = {
  async list(includeInactive) {
    let query = getSupabaseAdmin().from("payment_methods").select(PAYMENT_METHOD_SELECT);
    if (!includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) databaseFailure("list payment methods", error);
    return (data ?? []).map((item) => toPaymentMethod(item as PaymentMethodRow));
  },

  findById(id) {
    return findPaymentMethodById(id);
  },

  async create(actorId: string, input: PaymentMethodInput) {
    const { data, error } = await getSupabaseAdmin().rpc("create_payment_method", {
      actor_user_id: actorId,
      payment_method_name: input.name,
    });
    if (error) mutationFailure("create payment method", error);
    if (typeof data !== "string") {
      return databaseFailure("create payment method", new Error("Missing payment method id"));
    }
    const method = await findPaymentMethodById(data);
    if (!method) {
      return databaseFailure("create payment method", new Error("Missing payment method"));
    }
    return method;
  },

  async update(actorId, id, input) {
    const { data, error } = await getSupabaseAdmin().rpc("update_payment_method", {
      actor_user_id: actorId,
      target_payment_method_id: id,
      payment_method_name: input.name ?? null,
      payment_method_is_active: input.isActive ?? null,
    });
    if (error) mutationFailure("update payment method", error);
    return typeof data === "string" ? findPaymentMethodById(data) : null;
  },

  async deactivate(actorId, id) {
    const { data, error } = await getSupabaseAdmin().rpc("deactivate_payment_method", {
      actor_user_id: actorId,
      target_payment_method_id: id,
    });
    if (error) mutationFailure("deactivate payment method", error);
    return typeof data === "string" ? findPaymentMethodById(data) : null;
  },
};
