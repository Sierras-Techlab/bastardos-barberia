import { describe, expect, it } from "vitest";

import productsMock from "@/data/products.mock.json";
import {
  authorizeProductCatalogData,
  calculateProductMetrics,
  filterProducts,
  formatProductCategory,
  getProductStockStatus,
} from "@/lib/products/product-catalog";

describe("product catalog boundary", () => {
  it("accepts the complete product demonstration fixture", () => {
    const data = authorizeProductCatalogData(productsMock);

    expect(data).not.toHaveProperty("isMock");
    expect(data.products).toHaveLength(12);
    expect(data.products[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      category: expect.any(String),
      price: expect.any(Number),
      stock: expect.any(Number),
      isActive: expect.any(Boolean),
    });
  });

  it("rejects malformed product data at the fixture boundary", () => {
    expect(() =>
      authorizeProductCatalogData({
        isMock: true,
        products: [{ id: "broken", name: "Sin precio" }],
      }),
    ).toThrow();
  });
});

describe("product catalog filtering", () => {
  const products = authorizeProductCatalogData(productsMock).products;

  it("finds products by normalized name", () => {
    expect(
      filterProducts(products, {
        query: "  BARBA ",
        category: "all",
        stockStatus: "all",
        activeState: "all",
      }),
    ).toEqual([
      expect.objectContaining({ name: "Aceite para barba" }),
    ]);
  });

  it("combines category and stock-status filters", () => {
    const filtered = filterProducts(products, {
      query: "",
      category: "hair-care",
      stockStatus: "low-stock",
      activeState: "active",
    });

    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every(
        (product) =>
          product.category === "hair-care" &&
          product.stock > 0 &&
          product.stock <= 3,
      ),
    ).toBe(true);
  });

  it("filters inactive products for manager views", () => {
    const inactive = filterProducts(products, {
      query: "",
      category: "all",
      stockStatus: "all",
      activeState: "inactive",
    });

    expect(inactive).toHaveLength(1);
    expect(inactive[0].isActive).toBe(false);
  });
});

describe("product catalog presentation data", () => {
  const products = authorizeProductCatalogData(productsMock).products;

  it("derives hand-checked catalog metrics", () => {
    expect(calculateProductMetrics(products)).toEqual({
      totalProducts: 12,
      totalUnits: 103,
      lowStockProducts: 2,
      outOfStockProducts: 1,
      categoryCount: 4,
      averagePrice: 10208,
    });
  });

  it("formats category labels for the interface", () => {
    expect(formatProductCategory("beard-care")).toBe("Cuidado de barba");
  });

  it("derives stock status from the exact quantity", () => {
    expect(getProductStockStatus(8)).toBe("available");
    expect(getProductStockStatus(3)).toBe("low-stock");
    expect(getProductStockStatus(1)).toBe("low-stock");
    expect(getProductStockStatus(0)).toBe("out-of-stock");
  });
});
