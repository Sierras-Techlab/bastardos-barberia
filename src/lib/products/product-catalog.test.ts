import { describe, expect, it } from "vitest";

import productsMock from "@/data/products.mock.json";
import {
  authorizeProductCatalogData,
  calculateProductMetrics,
  filterProducts,
  formatProductCategory,
} from "@/lib/products/product-catalog";

describe("product catalog boundary", () => {
  it("accepts the complete product demonstration fixture", () => {
    const data = authorizeProductCatalogData(productsMock);

    expect(data.isMock).toBe(true);
    expect(data.products).toHaveLength(12);
    expect(data.products[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      category: expect.any(String),
      price: expect.any(Number),
      availability: expect.stringMatching(/available|unavailable/),
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
        availability: "all",
      }),
    ).toEqual([
      expect.objectContaining({ name: "Aceite para barba" }),
    ]);
  });

  it("combines category and availability filters", () => {
    const filtered = filterProducts(products, {
      query: "",
      category: "hair-care",
      availability: "available",
    });

    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every(
        (product) =>
          product.category === "hair-care" &&
          product.availability === "available",
      ),
    ).toBe(true);
  });
});

describe("product catalog presentation data", () => {
  const products = authorizeProductCatalogData(productsMock).products;

  it("derives hand-checked catalog metrics", () => {
    expect(calculateProductMetrics(products)).toEqual({
      totalProducts: 12,
      availableProducts: 10,
      categoryCount: 4,
      averagePrice: 10208,
    });
  });

  it("formats category labels for the interface", () => {
    expect(formatProductCategory("beard-care")).toBe("Cuidado de barba");
  });
});
