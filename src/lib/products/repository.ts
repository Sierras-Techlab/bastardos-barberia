import "server-only";

import { AppError } from "@/lib/auth/errors";
import type {
  ProductCreateRecord,
  ProductRepository,
  ProductUpdateRecord,
} from "@/lib/products/contracts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ProductRow } from "@/lib/supabase/database.types";
import type { CatalogProduct } from "@/types/product";

const PRODUCT_SELECT =
  "id,name,normalized_name,category,price,stock,is_active,created_by,updated_by,created_at,updated_at";

export const toCatalogProduct = (row: ProductRow): CatalogProduct => ({
  id: row.id,
  name: row.name,
  category: row.category,
  price: row.price,
  stock: row.stock,
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

const productMutationFailure = (
  operation: string,
  error: { code?: string; message?: string },
): never => {
  if (
    error.message === "PRODUCT_NAME_EXISTS" ||
    error.code === "23505"
  ) {
    throw new AppError(
      "PRODUCT_NAME_EXISTS",
      "Ya existe un producto con ese nombre.",
      409,
    );
  }
  if (error.message === "PRODUCT_NOT_FOUND") {
    throw new AppError(
      "PRODUCT_NOT_FOUND",
      "No encontramos el producto.",
      404,
    );
  }
  if (error.message === "INSUFFICIENT_STOCK") {
    throw new AppError(
      "INSUFFICIENT_STOCK",
      "No podés descontar más unidades que el stock disponible.",
      409,
    );
  }
  return databaseFailure(operation, error);
};

const findProductById = async (id: string) => {
  const { data, error } = await getSupabaseAdmin()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) databaseFailure("find product", error);
  return data ? toCatalogProduct(data as unknown as ProductRow) : null;
};

const toProductUpdateValues = (changes: ProductUpdateRecord) => {
  const values: Record<string, unknown> = { updated_by: changes.updatedBy };
  if (changes.name !== undefined) values.name = changes.name;
  if (changes.category !== undefined) values.category = changes.category;
  if (changes.price !== undefined) values.price = changes.price;
  if (changes.isActive !== undefined) values.is_active = changes.isActive;
  return values;
};

export const productRepository: ProductRepository = {
  async list(includeInactive) {
    let query = getSupabaseAdmin()
      .from("products")
      .select(PRODUCT_SELECT);
    if (!includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query.order("created_at", {
      ascending: true,
    });
    if (error) databaseFailure("list products", error);
    return (data ?? []).map((item) =>
      toCatalogProduct(item as unknown as ProductRow),
    );
  },

  findById(id) {
    return findProductById(id);
  },

  async create(input: ProductCreateRecord) {
    const { data, error } = await getSupabaseAdmin().rpc("create_product", {
      product_name: input.name,
      product_category: input.category,
      product_price: input.price,
      initial_stock: input.stock,
      actor_user_id: input.createdBy,
    });
    if (error) productMutationFailure("create product", error);
    if (typeof data !== "string") {
      databaseFailure("create product", new Error("Missing product id"));
    }
    const product = await findProductById(data as string);
    if (!product) {
      return databaseFailure("create product", new Error("Missing product"));
    }
    return product;
  },

  async update(id, changes) {
    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .update(toProductUpdateValues(changes))
      .eq("id", id)
      .select(PRODUCT_SELECT)
      .maybeSingle();
    if (error) productMutationFailure("update product", error);
    return data ? toCatalogProduct(data as unknown as ProductRow) : null;
  },

  async adjustStock(id, actorId, input) {
    const { data, error } = await getSupabaseAdmin().rpc(
      "adjust_product_stock",
      {
        target_product_id: id,
        actor_user_id: actorId,
        movement_kind: input.kind,
        movement_quantity: input.quantity,
      },
    );
    if (error) productMutationFailure("adjust product stock", error);
    if (typeof data !== "string") {
      databaseFailure(
        "adjust product stock",
        new Error("Missing product id"),
      );
    }
    return findProductById(data as string);
  },
};
