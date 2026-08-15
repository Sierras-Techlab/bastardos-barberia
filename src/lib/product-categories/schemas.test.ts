import { describe, expect, it } from "vitest";

import {
  createProductCategorySchema,
  productCategoryIdSchema,
  updateProductCategorySchema,
} from "@/lib/product-categories/schemas";

describe("product category boundary schemas", () => {
  it("trims names between one and eighty characters", () => {
    expect(createProductCategorySchema.parse({ name: "  Cuidado capilar  " })).toEqual({
      name: "Cuidado capilar",
    });
    expect(createProductCategorySchema.safeParse({ name: " " }).success).toBe(false);
    expect(createProductCategorySchema.safeParse({ name: "a".repeat(81) }).success)
      .toBe(false);
  });

  it("rejects malformed identifiers, unknown fields and empty updates", () => {
    expect(productCategoryIdSchema.safeParse("categoria-pelo").success).toBe(false);
    expect(createProductCategorySchema.safeParse({ name: "Barba", active: true }).success)
      .toBe(false);
    expect(updateProductCategorySchema.safeParse({}).success).toBe(false);
    expect(updateProductCategorySchema.safeParse({ deletedAt: null }).success).toBe(false);
    expect(updateProductCategorySchema.parse({ isActive: false })).toEqual({
      isActive: false,
    });
    expect(updateProductCategorySchema.parse({ isActive: true })).toEqual({
      isActive: true,
    });
    expect(updateProductCategorySchema.safeParse({ name: "  Fragancias  " })).toMatchObject({
      success: true,
      data: { name: "Fragancias" },
    });
  });
});
