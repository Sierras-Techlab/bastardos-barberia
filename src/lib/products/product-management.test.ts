import { describe, expect, it } from "vitest";

import productsMock from "@/data/products.mock.json";
import { authorizeProductCatalogData } from "@/lib/products/product-catalog";
import {
  applyStockAdjustment,
  productEditorSchema,
  sortProducts,
  stockAdjustmentSchema,
  validateUniqueProductName,
} from "@/lib/products/product-management";

const products = authorizeProductCatalogData(productsMock).products;

describe("product editor validation", () => {
  it("rejects missing names and invalid numeric values", () => {
    const result = productEditorSchema.safeParse({
      name: "",
      categoryId: "not-a-uuid",
      price: -1,
      stock: -2,
    });

    expect(result.success).toBe(false);
  });

  it("detects normalized duplicates but ignores the edited product", () => {
    expect(validateUniqueProductName(" hunter cream ", products)).toBe(
      "Ya existe un producto con ese nombre.",
    );
    expect(
      validateUniqueProductName(
        " hunter cream ",
        products,
        "product-hunter-cream",
      ),
    ).toBeNull();
  });
});

describe("stock adjustment", () => {
  it("accepts only positive integer quantities", () => {
    expect(
      stockAdjustmentSchema.safeParse({ kind: "entry", quantity: 0 }).success,
    ).toBe(false);
    expect(
      stockAdjustmentSchema.safeParse({ kind: "exit", quantity: 1.5 }).success,
    ).toBe(false);
  });

  it("applies entries and valid exits", () => {
    expect(applyStockAdjustment(8, { kind: "entry", quantity: 3 })).toBe(11);
    expect(applyStockAdjustment(8, { kind: "exit", quantity: 3 })).toBe(5);
  });

  it("rejects exits larger than available stock", () => {
    expect(() =>
      applyStockAdjustment(2, { kind: "exit", quantity: 3 }),
    ).toThrow("No podés descontar más unidades que el stock disponible.");
  });
});

describe("product sorting", () => {
  it("sorts exact stock in both directions without mutating input", () => {
    const originalIds = products.map((product) => product.id);

    expect(
      sortProducts(products, "stock-asc").map((product) => product.stock),
    ).toEqual([0, 2, 3, 5, 8, 9, 10, 11, 12, 13, 14, 16]);
    expect(sortProducts(products, "stock-desc")[0].stock).toBe(16);
    expect(products.map((product) => product.id)).toEqual(originalIds);
  });

  it("sorts prices and restores insertion order", () => {
    expect(sortProducts(products, "price-desc")[0].price).toBe(30000);
    expect(sortProducts(products, "price-asc")[0].price).toBe(3900);
    expect(sortProducts(products, "original").map((product) => product.id)).toEqual(
      products.map((product) => product.id),
    );
  });
});
