import "server-only";

import { AppError } from "@/lib/auth/errors";
import type { ProductCategoryRepository } from "@/lib/product-categories/contracts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  ProductCategory,
  ProductCategoryInput,
  ProductCategoryUpdate,
} from "@/types/product-category";

const PRODUCT_CATEGORY_SELECT =
  "id,name,normalized_name,is_active,created_by,updated_by,created_at,updated_at";

type ProductCategoryRow = {
  id: string;
  name: string;
  normalized_name: string;
  is_active: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export const toProductCategory = (row: ProductCategoryRow): ProductCategory => ({
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
  if (
    error.code === "23505" ||
    error.message === "PRODUCT_CATEGORY_NAME_EXISTS"
  ) {
    throw new AppError(
      "PRODUCT_CATEGORY_NAME_EXISTS",
      "Ya existe una categoría con ese nombre.",
      409,
    );
  }
  if (error.message === "PRODUCT_CATEGORY_IN_USE") {
    throw new AppError(
      "PRODUCT_CATEGORY_IN_USE",
      "No podés desactivar una categoría que tiene productos activos.",
      409,
    );
  }
  return databaseFailure(operation, error);
};

const findProductCategoryById = async (id: string) => {
  const { data, error } = await getSupabaseAdmin()
    .from("product_categories")
    .select(PRODUCT_CATEGORY_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) databaseFailure("find product category", error);
  return data ? toProductCategory(data as ProductCategoryRow) : null;
};

const toUpdateValues = (actorId: string, input: ProductCategoryUpdate) => {
  const values: Record<string, unknown> = { updated_by: actorId };
  if (input.name !== undefined) values.name = input.name;
  if (input.isActive !== undefined) values.is_active = input.isActive;
  return values;
};

export const productCategoryRepository: ProductCategoryRepository = {
  async list(includeInactive) {
    let query = getSupabaseAdmin()
      .from("product_categories")
      .select(PRODUCT_CATEGORY_SELECT);
    if (!includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) databaseFailure("list product categories", error);
    return (data ?? []).map((item) => toProductCategory(item as ProductCategoryRow));
  },

  findById(id) {
    return findProductCategoryById(id);
  },

  async create(actorId: string, input: ProductCategoryInput) {
    const { data, error } = await getSupabaseAdmin()
      .from("product_categories")
      .insert({
        name: input.name,
        normalized_name: "",
        created_by: actorId,
        updated_by: actorId,
      })
      .select(PRODUCT_CATEGORY_SELECT)
      .maybeSingle();
    if (error) mutationFailure("create product category", error);
    if (!data) {
      return databaseFailure(
        "create product category",
        new Error("Missing product category"),
      );
    }
    return toProductCategory(data as ProductCategoryRow);
  },

  async update(actorId, id, input) {
    const { data, error } = await getSupabaseAdmin()
      .from("product_categories")
      .update(toUpdateValues(actorId, input))
      .eq("id", id)
      .select(PRODUCT_CATEGORY_SELECT)
      .maybeSingle();
    if (error) mutationFailure("update product category", error);
    return data ? toProductCategory(data as ProductCategoryRow) : null;
  },

  async deactivate(actorId, id) {
    const { data, error } = await getSupabaseAdmin().rpc(
      "deactivate_product_category",
      {
        actor_user_id: actorId,
        target_category_id: id,
      },
    );
    if (error) mutationFailure("deactivate product category", error);
    if (typeof data !== "string") return null;
    return findProductCategoryById(data);
  },
};
