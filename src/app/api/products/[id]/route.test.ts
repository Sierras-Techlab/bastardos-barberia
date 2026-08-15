import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireManager, updateProduct } = vi.hoisted(() => ({
  requireManager: vi.fn(),
  updateProduct: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/products/service", () => ({ updateProduct }));

import { PATCH } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000001" };
const productId = "10000000-0000-4000-8000-000000000001";

describe("/api/products/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireManager.mockResolvedValue({ user: actor });
  });

  it("awaits the product id and applies category ID updates", async () => {
    updateProduct.mockResolvedValue({ id: productId, price: 10900 });

    const response = await PATCH(
      new Request(`http://localhost/api/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({
          categoryId: "20000000-0000-4000-8000-000000000002",
        }),
      }),
      { params: Promise.resolve({ id: productId }) },
    );

    expect(updateProduct).toHaveBeenCalledWith(actor, productId, {
      categoryId: "20000000-0000-4000-8000-000000000002",
    });
    expect(response.status).toBe(200);
  });

  it("rejects stock changes through the profile endpoint", async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ stock: 20 }),
      }),
      { params: Promise.resolve({ id: productId }) },
    );

    expect(updateProduct).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
  });
});
