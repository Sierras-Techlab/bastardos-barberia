import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, requireManager, listProducts, createProduct } = vi.hoisted(
  () => ({
    requireUser: vi.fn(),
    requireManager: vi.fn(),
    listProducts: vi.fn(),
    createProduct: vi.fn(),
  }),
);

vi.mock("@/lib/auth/authorization", () => ({ requireUser, requireManager }));
vi.mock("@/lib/products/service", () => ({ listProducts, createProduct }));

import { GET, POST } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000001" };
const input = {
  name: "Gel",
  categoryId: "20000000-0000-4000-8000-000000000002",
  price: 9900,
  stock: 4,
};

describe("/api/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user: actor });
    requireManager.mockResolvedValue({ user: actor });
  });

  it("lists the catalog for any authenticated user", async () => {
    listProducts.mockResolvedValue({ products: [] });

    const response = await GET();

    expect(listProducts).toHaveBeenCalledWith(actor);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { products: [] },
    });
  });

  it("creates a product as a manager", async () => {
    createProduct.mockResolvedValue({ id: "product-id" });

    const response = await POST(
      new Request("http://localhost/api/products", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );

    expect(createProduct).toHaveBeenCalledWith(actor, input);
    expect(response.status).toBe(201);
  });

  it("rejects malformed product creation input", async () => {
    const response = await POST(
      new Request("http://localhost/api/products", {
        method: "POST",
        body: JSON.stringify({ ...input, price: -1 }),
      }),
    );

    expect(createProduct).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
  });
});
