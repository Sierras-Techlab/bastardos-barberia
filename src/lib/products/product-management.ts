import { z } from "zod";

import type {
  CatalogProduct,
  ProductEditorInput,
  ProductSort,
  StockAdjustment,
} from "@/types/product";

export const productEditorSchema = z.object({
  name: z.string().trim().min(1, "Ingresá el nombre del producto."),
  category: z.enum([
    "hair-care",
    "styling",
    "beard-care",
    "fragrance",
  ]),
  price: z
    .number({ error: "Ingresá un precio válido." })
    .int("Ingresá un precio válido.")
    .nonnegative("Ingresá un precio válido."),
  stock: z
    .number({ error: "Ingresá un stock válido." })
    .int("Ingresá un stock válido.")
    .nonnegative("Ingresá un stock válido."),
});

export const stockAdjustmentSchema = z.object({
  kind: z.enum(["entry", "exit"]),
  quantity: z
    .number({ error: "Ingresá una cantidad mayor a cero." })
    .int("Ingresá una cantidad mayor a cero.")
    .positive("Ingresá una cantidad mayor a cero."),
});

const normalizeName = (value: string) =>
  value.trim().toLocaleLowerCase("es-AR");

export const validateUniqueProductName = (
  name: string,
  products: CatalogProduct[],
  ignoredProductId?: string,
) => {
  const normalizedName = normalizeName(name);
  const duplicate = products.some(
    (product) =>
      product.id !== ignoredProductId &&
      normalizeName(product.name) === normalizedName,
  );

  return duplicate ? "Ya existe un producto con ese nombre." : null;
};

export const applyStockAdjustment = (
  currentStock: number,
  adjustment: StockAdjustment,
) => {
  const parsed = stockAdjustmentSchema.parse(adjustment);

  if (parsed.kind === "exit" && parsed.quantity > currentStock) {
    throw new Error(
      "No podés descontar más unidades que el stock disponible.",
    );
  }

  return parsed.kind === "entry"
    ? currentStock + parsed.quantity
    : currentStock - parsed.quantity;
};

export const sortProducts = (
  products: CatalogProduct[],
  sort: ProductSort,
) => {
  const sorted = [...products];

  if (sort === "stock-asc") return sorted.sort((a, b) => a.stock - b.stock);
  if (sort === "stock-desc") return sorted.sort((a, b) => b.stock - a.stock);
  if (sort === "price-asc") return sorted.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") return sorted.sort((a, b) => b.price - a.price);

  return sorted;
};

export type { ProductEditorInput };
