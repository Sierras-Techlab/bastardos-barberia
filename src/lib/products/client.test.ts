import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductApiError, productClient } from "@/lib/products/client";
import type { CatalogProduct } from "@/types/product";

const product: CatalogProduct = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Gel",
  category: "styling",
  price: 9900,
  stock: 4,
  isActive: true,
};

describe("product API client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("creates products with a JSON request", async () => {
    const input = {
      name: "Gel",
      category: "styling" as const,
      price: 9900,
      stock: 4,
    };
    fetchMock.mockResolvedValue(
      Response.json({ data: product }, { status: 201 }),
    );

    await expect(productClient.create(input)).resolves.toEqual(product);
    expect(fetchMock).toHaveBeenCalledWith("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it("uses dedicated profile and stock endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ data: product }))
      .mockResolvedValueOnce(Response.json({ data: { ...product, stock: 2 } }));

    await productClient.update(product.id, { price: 10900 });
    await productClient.adjustStock(product.id, {
      kind: "exit",
      quantity: 2,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/products/${product.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: 10900 }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/products/${product.id}/stock-movements`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "exit", quantity: 2 }),
      },
    );
  });

  it("preserves structured server errors", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          error: {
            code: "INSUFFICIENT_STOCK",
            message: "No hay stock suficiente.",
          },
        },
        { status: 409 },
      ),
    );

    await expect(
      productClient.adjustStock(product.id, {
        kind: "exit",
        quantity: 9,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "ProductApiError",
        status: 409,
        code: "INSUFFICIENT_STOCK",
        message: "No hay stock suficiente.",
      }),
    );
    expect(ProductApiError.prototype).toBeInstanceOf(Error);
  });
});
