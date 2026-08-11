import "server-only";

import { AppError } from "@/lib/auth/errors";
import type { CustomerRepository, CustomerUpdateRecord } from "@/lib/customers/contracts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { CustomerRow } from "@/lib/supabase/database.types";
import type { Customer } from "@/types/customer";

const CUSTOMER_SELECT = "id,first_name,last_name,phone,normalized_phone,email,visits,created_by,updated_by,deleted_at,deleted_by,created_at,updated_at";
export const normalizeCustomerPhone = (value: string) => value.replace(/\D/g, "");
export const toCustomer = (row: CustomerRow): Customer => ({
  id: row.id, firstName: row.first_name, lastName: row.last_name, phone: row.phone,
  email: row.email, visits: row.visits, createdAt: row.created_at,
});
const databaseFailure = (operation: string, error: unknown): never => {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo completar la operación en la base de datos.");
};
const mutationFailure = (operation: string, error: { code?: string; details?: string; message?: string }): never => {
  const description = `${error.details ?? ""} ${error.message ?? ""}`;
  if (error.code === "23505" && description.includes("email")) {
    throw new AppError("CUSTOMER_EMAIL_EXISTS", "Ya existe un cliente con ese email.", 409);
  }
  if (error.code === "23505") {
    throw new AppError("CUSTOMER_PHONE_EXISTS", "Ya existe un cliente con ese teléfono.", 409);
  }
  return databaseFailure(operation, error);
};
const updateValues = (changes: CustomerUpdateRecord) => {
  const values: Record<string, unknown> = { updated_by: changes.updatedBy };
  if (changes.firstName !== undefined) values.first_name = changes.firstName;
  if (changes.lastName !== undefined) values.last_name = changes.lastName;
  if (changes.phone !== undefined) values.phone = changes.phone;
  if (changes.email !== undefined) values.email = changes.email;
  return values;
};
export const customerRepository: CustomerRepository = {
  async list() {
    const { data, error } = await getSupabaseAdmin().from("customers").select(CUSTOMER_SELECT).is("deleted_at", null).order("created_at", { ascending: true });
    if (error) databaseFailure("list customers", error);
    return (data ?? []).map((item) => toCustomer(item as unknown as CustomerRow));
  },
  async findById(id) {
    const { data, error } = await getSupabaseAdmin().from("customers").select(CUSTOMER_SELECT).eq("id", id).is("deleted_at", null).maybeSingle();
    if (error) databaseFailure("find customer", error);
    return data ? toCustomer(data as unknown as CustomerRow) : null;
  },
  async findByNormalizedPhone(phone) {
    const { data, error } = await getSupabaseAdmin().from("customers").select(CUSTOMER_SELECT).eq("normalized_phone", normalizeCustomerPhone(phone)).is("deleted_at", null).maybeSingle();
    if (error) databaseFailure("find customer by phone", error);
    return data ? toCustomer(data as unknown as CustomerRow) : null;
  },
  async create(input) {
    const { data, error } = await getSupabaseAdmin().from("customers").insert({
      first_name: input.firstName, last_name: input.lastName, phone: input.phone,
      normalized_phone: "", email: input.email, created_by: input.createdBy, updated_by: input.createdBy,
    }).select(CUSTOMER_SELECT).maybeSingle();
    if (error) mutationFailure("create customer", error);
    if (!data) return databaseFailure("create customer", new Error("Missing customer"));
    return toCustomer(data as unknown as CustomerRow);
  },
  async update(id, changes) {
    const { data, error } = await getSupabaseAdmin().from("customers").update(updateValues(changes)).eq("id", id).is("deleted_at", null).select(CUSTOMER_SELECT).maybeSingle();
    if (error) mutationFailure("update customer", error);
    return data ? toCustomer(data as unknown as CustomerRow) : null;
  },
  async softDelete(id, actorId, at) {
    const { data, error } = await getSupabaseAdmin().from("customers").update({ deleted_at: at, deleted_by: actorId, updated_by: actorId }).eq("id", id).is("deleted_at", null).select("id").maybeSingle();
    if (error) databaseFailure("delete customer", error);
    return data && typeof data.id === "string" ? data.id : null;
  },
};
