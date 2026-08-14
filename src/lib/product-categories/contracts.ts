import type {
  ProductCategory,
  ProductCategoryInput,
  ProductCategoryUpdate,
} from "@/types/product-category";

export type ProductCategoryRepository = {
  list(includeInactive: boolean): Promise<ProductCategory[]>;
  findById(id: string): Promise<ProductCategory | null>;
  create(actorId: string, input: ProductCategoryInput): Promise<ProductCategory>;
  update(
    actorId: string,
    id: string,
    input: ProductCategoryUpdate,
  ): Promise<ProductCategory | null>;
  deactivate(actorId: string, id: string): Promise<ProductCategory | null>;
};

export type ProductCategoryServiceDependencies = {
  categories: ProductCategoryRepository;
};
