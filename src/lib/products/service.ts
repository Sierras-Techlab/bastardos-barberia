import { assertManager } from "@/lib/auth/authorization";
import { MANAGER_ROLES } from "@/lib/auth/constants";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { ProductServiceDependencies } from "@/lib/products/contracts";
import { productRepository } from "@/lib/products/repository";
import type {
  CreateProductInput,
  ProductCatalogData,
  StockAdjustment,
  UpdateProductInput,
} from "@/types/product";

const productNotFound = () =>
  new AppError("PRODUCT_NOT_FOUND", "No encontramos el producto.", 404);

const defaultDependencies: ProductServiceDependencies = {
  products: productRepository,
};

export const listProducts = async (
  actor: SafeUser,
  dependencies: ProductServiceDependencies = defaultDependencies,
): Promise<ProductCatalogData> => ({
  products: await dependencies.products.list(
    MANAGER_ROLES.has(actor.role.name),
  ),
});

export const createProduct = async (
  actor: SafeUser,
  input: CreateProductInput,
  dependencies: ProductServiceDependencies = defaultDependencies,
) => {
  assertManager(actor);
  return dependencies.products.create({ ...input, createdBy: actor.id });
};

export const updateProduct = async (
  actor: SafeUser,
  id: string,
  input: UpdateProductInput,
  dependencies: ProductServiceDependencies = defaultDependencies,
) => {
  assertManager(actor);
  const product = await dependencies.products.update(id, {
    ...input,
    updatedBy: actor.id,
  });
  if (!product) throw productNotFound();
  return product;
};

export const adjustProductStock = async (
  actor: SafeUser,
  id: string,
  input: StockAdjustment,
  dependencies: ProductServiceDependencies = defaultDependencies,
) => {
  assertManager(actor);
  const product = await dependencies.products.adjustStock(
    id,
    actor.id,
    input,
  );
  if (!product) throw productNotFound();
  return product;
};
