export type ProductAvailability = "available" | "unavailable";

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
  availability: ProductAvailability;
};

export type ProductCatalogData = {
  isMock: true;
  products: CatalogProduct[];
};

export type ProductCatalogFilters = {
  query: string;
  category: ProductCategory | "all";
  availability: ProductAvailability | "all";
};

export type ProductCatalogMetrics = {
  totalProducts: number;
  availableProducts: number;
  categoryCount: number;
  averagePrice: number;
};
