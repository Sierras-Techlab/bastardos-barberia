export type ProductStockStatus =
  | "available"
  | "low-stock"
  | "out-of-stock";

export type ProductCategory =
  | "hair-care"
  | "styling"
  | "beard-care"
  | "fragrance";

export type CatalogProduct = {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  stock: number;
};

export type ProductCatalogData = {
  isMock: true;
  products: CatalogProduct[];
};

export type ProductCatalogFilters = {
  query: string;
  category: ProductCategory | "all";
  stockStatus: ProductStockStatus | "all";
};

export type ProductCatalogMetrics = {
  totalProducts: number;
  totalUnits: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  categoryCount: number;
  averagePrice: number;
};
