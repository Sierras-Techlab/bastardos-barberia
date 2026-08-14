import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ProductCategoryApiError,
  productCategoryClient,
} from "@/lib/product-categories/client";
import type { ProductCategory } from "@/types/product-category";

const category: ProductCategory = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Cuidado capilar",
  isActive: true,
};

describe("product category API client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("uses the category routes for reads and manager mutations", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ data: { categories: [category] } }))
      .mockResolvedValueOnce(Response.json({ data: category }))
      .mockResolvedValueOnce(Response.json({ data: category }, { status: 201 }))
      .mockResolvedValueOnce(
        Response.json({ data: { ...category, name: "Fragancias" } }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: { ...category, isActive: false } }),
      );

    await expect(productCategoryClient.list()).resolves.toEqual([category]);
    await expect(productCategoryClient.get(category.id)).resolves.toEqual(category);
    await productCategoryClient.create({ name: category.name });
    await productCategoryClient.update(category.id, { name: "Fragancias" });
    await productCategoryClient.deactivate(category.id);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/product-categories",
      undefined,
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/product-categories/${category.id}`,
      undefined,
    );
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/product-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: category.name }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      `/api/product-categories/${category.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Fragancias" }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      `/api/product-categories/${category.id}`,
      { method: "DELETE" },
    );
  });

  it("preserves structured server errors", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          error: {
            code: "PRODUCT_CATEGORY_IN_USE",
            message: "No podés desactivar una categoría en uso.",
          },
        },
        { status: 409 },
      ),
    );

    await expect(productCategoryClient.deactivate(category.id)).rejects.toEqual(
      expect.objectContaining({
        name: "ProductCategoryApiError",
        status: 409,
        code: "PRODUCT_CATEGORY_IN_USE",
        message: "No podés desactivar una categoría en uso.",
      }),
    );
    expect(ProductCategoryApiError.prototype).toBeInstanceOf(Error);
  });
});
