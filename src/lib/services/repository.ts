import "server-only";

import { AppError } from "@/lib/auth/errors";
import type { ServiceRepository, ServiceUpdateRecord } from "@/lib/services/contracts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ServiceRow } from "@/lib/supabase/database.types";
import type { ServiceCatalogItem } from "@/types/service-catalog";

const SERVICE_SELECT =
  "id,name,normalized_name,price,is_active,created_by,updated_by,deleted_at,deleted_by,created_at,updated_at";

export const toCatalogService = (row: ServiceRow): ServiceCatalogItem => ({
  id: row.id,
  name: row.name,
  price: row.price,
  isActive: row.is_active,
});

const databaseFailure = (operation: string, error: unknown): never => {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "unknown";
  console.error(`Database operation failed: ${operation} (${code})`);
  throw new Error("No se pudo completar la operación en la base de datos.");
};

const mutationFailure = (
  operation: string,
  error: { code?: string; message?: string },
): never => {
  if (error.code === "23505" || error.message === "SERVICE_NAME_EXISTS") {
    throw new AppError(
      "SERVICE_NAME_EXISTS",
      "Ya existe un servicio con ese nombre.",
      409,
    );
  }
  return databaseFailure(operation, error);
};

const toUpdateValues = (changes: ServiceUpdateRecord) => {
  const values: Record<string, unknown> = { updated_by: changes.updatedBy };
  if (changes.name !== undefined) values.name = changes.name;
  if (changes.price !== undefined) values.price = changes.price;
  if (changes.isActive !== undefined) values.is_active = changes.isActive;
  return values;
};

export const serviceRepository: ServiceRepository = {
  async list(includeInactive) {
    let query = getSupabaseAdmin()
      .from("services")
      .select(SERVICE_SELECT)
      .is("deleted_at", null);
    if (!includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) databaseFailure("list services", error);
    return (data ?? []).map((item) => toCatalogService(item as unknown as ServiceRow));
  },

  async findById(id) {
    const { data, error } = await getSupabaseAdmin()
      .from("services")
      .select(SERVICE_SELECT)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) databaseFailure("find service", error);
    return data ? toCatalogService(data as unknown as ServiceRow) : null;
  },

  async create(input) {
    const { data, error } = await getSupabaseAdmin()
      .from("services")
      .insert({
        name: input.name,
        normalized_name: "",
        price: input.price,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      })
      .select(SERVICE_SELECT)
      .maybeSingle();
    if (error) mutationFailure("create service", error);
    if (!data) return databaseFailure("create service", new Error("Missing service"));
    return toCatalogService(data as unknown as ServiceRow);
  },

  async update(id, changes) {
    const { data, error } = await getSupabaseAdmin()
      .from("services")
      .update(toUpdateValues(changes))
      .eq("id", id)
      .is("deleted_at", null)
      .select(SERVICE_SELECT)
      .maybeSingle();
    if (error) mutationFailure("update service", error);
    return data ? toCatalogService(data as unknown as ServiceRow) : null;
  },

  async softDelete(id, actorId, at) {
    const { data, error } = await getSupabaseAdmin()
      .from("services")
      .update({
        is_active: false,
        deleted_at: at,
        deleted_by: actorId,
        updated_by: actorId,
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) databaseFailure("delete service", error);
    return data && typeof data.id === "string" ? data.id : null;
  },
};
