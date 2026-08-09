import { z } from "zod";

import type {
  CatalogProduct,
  ProductCatalogData,
  ProductCatalogFilters,
  ProductCatalogMetrics,
  ProductCategory,
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
    availability: z.enum(["available", "unavailable"]),
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
    const matchesAvailability =
      filters.availability === "all" ||
      product.availability === filters.availability;

    return matchesQuery && matchesCategory && matchesAvailability;
  });
};

export const calculateProductMetrics = (
  products: CatalogProduct[],
): ProductCatalogMetrics => {
  const totalPrice = products.reduce((total, product) => total + product.price, 0);

  return {
    totalProducts: products.length,
    availableProducts: products.filter(
      (product) => product.availability === "available",
    ).length,
    categoryCount: new Set(products.map((product) => product.category)).size,
    averagePrice:
      products.length > 0 ? Math.round(totalPrice / products.length) : 0,
  };
};

export const formatProductCategory = (category: ProductCategory) =>
  categoryLabels[category];
