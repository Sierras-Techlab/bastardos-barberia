import { z } from "zod";

import type {
  CatalogProduct,
  ProductAvailabilityStatus,
  ProductCatalogData,
  ProductCatalogFilters,
  ProductCatalogMetrics,
  ProductStockStatus,
} from "@/types/product";

const productCategorySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    isActive: z.boolean(),
  })
  .strict();

const productSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: productCategorySchema,
    price: z.number().int().nonnegative(),
    stock: z.number().int().nonnegative(),
    isActive: z.boolean(),
  })
  .strict();

const productCatalogFixtureSchema = z
  .object({
    isMock: z.literal(true),
    products: z.array(productSchema),
  })
  .strict();

const productCatalogDataSchema = z
  .union([
    productCatalogFixtureSchema,
    z.object({ products: z.array(productSchema) }).strict(),
  ])
  .transform(({ products }) => ({ products }));

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
      filters.categoryId === "all" || product.category.id === filters.categoryId;
    const matchesStockStatus =
      filters.stockStatus === "all" ||
      getProductStockStatus(product.stock) === filters.stockStatus;
    const matchesActiveState =
      filters.activeState === "all" ||
      (filters.activeState === "active" && product.isActive) ||
      (filters.activeState === "inactive" && !product.isActive);

    return (
      matchesQuery &&
      matchesCategory &&
      matchesStockStatus &&
      matchesActiveState
    );
  });
};

export const getProductStockStatus = (stock: number): ProductStockStatus => {
  if (stock === 0) return "out-of-stock";
  if (stock <= 3) return "low-stock";
  return "available";
};

export const getProductAvailabilityStatus = (
  product: Pick<CatalogProduct, "isActive" | "stock">,
): ProductAvailabilityStatus =>
  product.isActive ? getProductStockStatus(product.stock) : "unavailable";

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
    categoryCount: new Set(products.map((product) => product.category.id)).size,
    averagePrice:
      products.length > 0 ? Math.round(totalPrice / products.length) : 0,
  };
};
