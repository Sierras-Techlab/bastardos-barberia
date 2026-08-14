import { assertManager } from "@/lib/auth/authorization";
import { MANAGER_ROLES } from "@/lib/auth/constants";
import { AppError } from "@/lib/auth/errors";
import type { SafeUser } from "@/lib/auth/types";
import type { ProductCategoryServiceDependencies } from "@/lib/product-categories/contracts";
import { productCategoryRepository } from "@/lib/product-categories/repository";
import type {
  ProductCategoryInput,
  ProductCategoryUpdate,
} from "@/types/product-category";

const categoryNotFound = () =>
  new AppError(
    "PRODUCT_CATEGORY_NOT_FOUND",
    "No encontramos la categoría.",
    404,
  );

const assertNotDeactivationAttempt = (input: ProductCategoryUpdate) => {
  if ((input as { isActive?: boolean }).isActive === false) {
    throw new AppError(
      "PRODUCT_CATEGORY_DEACTIVATION_REQUIRED",
      "Para desactivar una categoría, usá la acción correspondiente.",
      400,
    );
  }
};

const defaultDependencies: ProductCategoryServiceDependencies = {
  categories: productCategoryRepository,
};

export const listProductCategories = async (
  actor: SafeUser,
  dependencies: ProductCategoryServiceDependencies = defaultDependencies,
) => ({
  categories: await dependencies.categories.list(MANAGER_ROLES.has(actor.role.name)),
});

export const getProductCategory = async (
  actor: SafeUser,
  id: string,
  dependencies: ProductCategoryServiceDependencies = defaultDependencies,
) => {
  const category = await dependencies.categories.findById(id);
  if (!category || (!category.isActive && !MANAGER_ROLES.has(actor.role.name))) {
    throw categoryNotFound();
  }
  return category;
};

export const createProductCategory = async (
  actor: SafeUser,
  input: ProductCategoryInput,
  dependencies: ProductCategoryServiceDependencies = defaultDependencies,
) => {
  assertManager(actor);
  return dependencies.categories.create(actor.id, input);
};

export const updateProductCategory = async (
  actor: SafeUser,
  id: string,
  input: ProductCategoryUpdate,
  dependencies: ProductCategoryServiceDependencies = defaultDependencies,
) => {
  assertManager(actor);
  assertNotDeactivationAttempt(input);
  const category = await dependencies.categories.update(actor.id, id, input);
  if (!category) throw categoryNotFound();
  return category;
};

export const deactivateProductCategory = async (
  actor: SafeUser,
  id: string,
  dependencies: ProductCategoryServiceDependencies = defaultDependencies,
) => {
  assertManager(actor);
  const category = await dependencies.categories.deactivate(actor.id, id);
  if (!category) throw categoryNotFound();
  return category;
};
