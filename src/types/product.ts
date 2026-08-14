import type { ProductCategory } from "@/types/product-category";

export type ProductStockStatus =
  | "available"
  | "low-stock"
  | "out-of-stock";

export type ProductAvailabilityStatus =
  | ProductStockStatus
  | "unavailable";

export type ProductActiveState = "all" | "active" | "inactive";

export type ProductSort =
  | "original"
  | "stock-asc"
  | "stock-desc"
  | "price-asc"
  | "price-desc";

export type CatalogProduct = {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  stock: number;
  isActive: boolean;
};

export type ProductCatalogData = {
  products: CatalogProduct[];
};

export type ProductCatalogFilters = {
  query: string;
  categoryId: string | "all";
  stockStatus: ProductStockStatus | "all";
  activeState: ProductActiveState;
};

export type ProductEditorInput = {
  name: string;
  categoryId: string;
  price: number;
  stock: number;
};

export type CreateProductInput = ProductEditorInput;

export type UpdateProductInput = Partial<
  Pick<CatalogProduct, "name" | "price" | "isActive">
> & { categoryId?: string };

export type StockAdjustment = {
  kind: "entry" | "exit";
  quantity: number;
};

export type ProductCatalogMetrics = {
  totalProducts: number;
  totalUnits: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  categoryCount: number;
  averagePrice: number;
};
