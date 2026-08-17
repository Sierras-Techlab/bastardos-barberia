import { describe, expect, it } from "vitest";

import productsMock from "@/data/products.mock.json";
import {
  authorizeProductCatalogData,
  calculateProductMetrics,
  filterProducts,
  getProductAvailabilityStatus,
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
      category: {
        id: expect.any(String),
        name: expect.any(String),
        isActive: expect.any(Boolean),
      },
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
        categoryId: "all",
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
      categoryId: "20000000-0000-4000-8000-000000000001",
      stockStatus: "low-stock",
      activeState: "active",
    });

    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every(
        (product) =>
          product.category.id === "20000000-0000-4000-8000-000000000001" &&
          product.stock > 0 &&
          product.stock <= 3,
      ),
    ).toBe(true);
  });

  it("filters inactive products for manager views", () => {
    const inactive = filterProducts(products, {
      query: "",
      categoryId: "all",
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

  it("derives stock status from the exact quantity", () => {
    expect(getProductStockStatus(8)).toBe("available");
    expect(getProductStockStatus(3)).toBe("low-stock");
    expect(getProductStockStatus(1)).toBe("low-stock");
    expect(getProductStockStatus(0)).toBe("out-of-stock");
  });

  it("gives inactivity precedence over remaining stock in presentation", () => {
    expect(
      getProductAvailabilityStatus({ stock: 8, isActive: false }),
    ).toBe("unavailable");
    expect(
      getProductAvailabilityStatus({ stock: 8, isActive: true }),
    ).toBe("available");
  });
});
