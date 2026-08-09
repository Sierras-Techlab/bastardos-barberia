import { z } from "zod";

import type {
  CatalogProduct,
  ProductCatalogData,
  ProductCatalogFilters,
  ProductCatalogMetrics,
  ProductCategory,
  ProductStockStatus,
} from "@/types/product";

const productCategorySchema = z.enum([
  "hair-care",
  "styling",
  "beard-care",
  "fragrance",
]);

const productSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: productCategorySchema,
    price: z.number().int().nonnegative(),
    stock: z.number().int().nonnegative(),
  })
  .strict();

const productCatalogDataSchema = z
  .object({
    isMock: z.literal(true),
    products: z.array(productSchema),
  })
  .strict();

const categoryLabels: Record<ProductCategory, string> = {
  "hair-care": "Cuidado capilar",
  styling: "Peinado y fijación",
  "beard-care": "Cuidado de barba",
  fragrance: "Fragancias",
};

const normalizeSearch = (value: string) =>
  value.trim().toLocaleLowerCase("es-AR");

export const authorizeProductCatalogData = (
  input: unknown,
): ProductCatalogData => productCatalogDataSchema.parse(input);

export const filterProducts = (
  products: CatalogProduct[],
  filters: ProductCatalogFilters,
) => {
  const query = normalizeSearch(filters.query);

  return products.filter((product) => {
    const matchesQuery = normalizeSearch(product.name).includes(query);
    const matchesCategory =
      filters.category === "all" || product.category === filters.category;
    const matchesStockStatus =
      filters.stockStatus === "all" ||
      getProductStockStatus(product.stock) === filters.stockStatus;

    return matchesQuery && matchesCategory && matchesStockStatus;
  });
};

export const getProductStockStatus = (stock: number): ProductStockStatus => {
  if (stock === 0) return "out-of-stock";
  if (stock <= 3) return "low-stock";
  return "available";
};

export const calculateProductMetrics = (
  products: CatalogProduct[],
): ProductCatalogMetrics => {
  const totalPrice = products.reduce((total, product) => total + product.price, 0);

  return {
    totalProducts: products.length,
    totalUnits: products.reduce((total, product) => total + product.stock, 0),
    lowStockProducts: products.filter(
      (product) => getProductStockStatus(product.stock) === "low-stock",
    ).length,
    outOfStockProducts: products.filter(
      (product) => getProductStockStatus(product.stock) === "out-of-stock",
    ).length,
    categoryCount: new Set(products.map((product) => product.category)).size,
    averagePrice:
      products.length > 0 ? Math.round(totalPrice / products.length) : 0,
  };
};

export const formatProductCategory = (category: ProductCategory) =>
  categoryLabels[category];
