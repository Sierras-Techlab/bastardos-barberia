import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireManager, adjustProductStock } = vi.hoisted(() => ({
  requireManager: vi.fn(),
  adjustProductStock: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/products/service", () => ({ adjustProductStock }));

import { POST } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000001" };
const productId = "10000000-0000-4000-8000-000000000001";

describe("/api/products/:id/stock-movements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireManager.mockResolvedValue({ user: actor });
  });

  it("records a validated manager stock adjustment", async () => {
    adjustProductStock.mockResolvedValue({ id: productId, stock: 2 });
    const adjustment = { kind: "exit", quantity: 2 };

    const response = await POST(
      new Request(
        `http://localhost/api/products/${productId}/stock-movements`,
        { method: "POST", body: JSON.stringify(adjustment) },
      ),
      { params: Promise.resolve({ id: productId }) },
    );

    expect(adjustProductStock).toHaveBeenCalledWith(
      actor,
      productId,
      adjustment,
    );
    expect(response.status).toBe(201);
  });

  it("rejects non-positive stock quantities", async () => {
    const response = await POST(
      new Request(
        `http://localhost/api/products/${productId}/stock-movements`,
        {
          method: "POST",
          body: JSON.stringify({ kind: "entry", quantity: 0 }),
        },
      ),
      { params: Promise.resolve({ id: productId }) },
    );

    expect(adjustProductStock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
  });
});
