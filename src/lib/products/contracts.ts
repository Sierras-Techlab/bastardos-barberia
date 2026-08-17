import type { CatalogProduct, StockAdjustment } from "@/types/product";

export type ProductCreateRecord = {
  name: string;
  categoryId: string;
  price: number;
  stock: number;
  createdBy: string;
};

export type ProductUpdateRecord = Partial<
  Pick<CatalogProduct, "name" | "price" | "isActive">
> & { categoryId?: string;
  updatedBy: string;
};

export type ProductRepository = {
  list(includeInactive: boolean): Promise<CatalogProduct[]>;
  findById(id: string): Promise<CatalogProduct | null>;
  create(input: ProductCreateRecord): Promise<CatalogProduct>;
  update(
    id: string,
    changes: ProductUpdateRecord,
  ): Promise<CatalogProduct | null>;
  adjustStock(
    id: string,
    actorId: string,
    input: StockAdjustment,
  ): Promise<CatalogProduct | null>;
};

export type ProductServiceDependencies = {
  products: ProductRepository;
};
