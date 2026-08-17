import "server-only";

import { AppError } from "@/lib/auth/errors";
import type {
  ProductCreateRecord,
  ProductRepository,
} from "@/lib/products/contracts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { CatalogProduct } from "@/types/product";

const PRODUCT_SELECT =
  "id,name,normalized_name,price,stock,is_active,created_by,updated_by,created_at,updated_at,category:product_categories(id,name,is_active)";

type ProductSelectRow = {
  id: string;
  name: string;
  normalized_name: string;
  price: number;
  stock: number;
  is_active: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  category: { id: string; name: string; is_active: boolean } | null;
};

export const toCatalogProduct = (row: ProductSelectRow): CatalogProduct => {
  if (!row.category) {
    throw new Error("Product category relation is missing.");
  }

  return {
    id: row.id,
    name: row.name,
    category: {
      id: row.category.id,
      name: row.category.name,
      isActive: row.category.is_active,
    },
    price: row.price,
    stock: row.stock,
    isActive: row.is_active,
  };
};

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
  if (error.message === "PRODUCT_CATEGORY_NOT_FOUND") {
    throw new AppError(
      "PRODUCT_CATEGORY_NOT_FOUND",
      "No encontramos la categoría seleccionada.",
      404,
    );
  }
  if (error.message === "PRODUCT_CATEGORY_INACTIVE") {
    throw new AppError(
      "PRODUCT_CATEGORY_INACTIVE",
      "La categoría seleccionada ya no está disponible.",
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
  return data ? toCatalogProduct(data as unknown as ProductSelectRow) : null;
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
      toCatalogProduct(item as unknown as ProductSelectRow),
    );
  },

  findById(id) {
    return findProductById(id);
  },

  async create(input: ProductCreateRecord) {
    const { data, error } = await getSupabaseAdmin().rpc("create_product", {
      product_name: input.name,
      product_category_id: input.categoryId,
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
    const { data, error } = await getSupabaseAdmin().rpc("update_product", {
      target_product_id: id,
      product_name: changes.name ?? null,
      product_category_id: changes.categoryId ?? null,
      product_price: changes.price ?? null,
      product_is_active: changes.isActive ?? null,
      actor_user_id: changes.updatedBy,
    });
    if (error) productMutationFailure("update product", error);
    if (typeof data !== "string") return null;
    return findProductById(data);
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
