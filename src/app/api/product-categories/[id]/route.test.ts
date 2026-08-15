import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireUser,
  requireManager,
  getProductCategory,
  updateProductCategory,
  deactivateProductCategory,
  deleteProductCategory,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  getProductCategory: vi.fn(),
  updateProductCategory: vi.fn(),
  deactivateProductCategory: vi.fn(),
  deleteProductCategory: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireUser, requireManager }));
vi.mock("@/lib/product-categories/service", () => ({
  getProductCategory,
  updateProductCategory,
  deactivateProductCategory,
  deleteProductCategory,
}));

import { AppError } from "@/lib/auth/errors";

import { DELETE, GET, PATCH } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000001" };
const id = "10000000-0000-4000-8000-000000000001";
const category = { id, name: "Cuidado capilar", isActive: true };
const context = { params: Promise.resolve({ id }) };

describe("/api/product-categories/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user: actor });
    requireManager.mockResolvedValue({ user: actor });
  });

  it("awaits params and gets a category for an authenticated user", async () => {
    getProductCategory.mockResolvedValue(category);

    const response = await GET(
      new Request(`http://localhost/api/product-categories/${id}`),
      context,
    );

    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(requireManager).not.toHaveBeenCalled();
    expect(getProductCategory).toHaveBeenCalledWith(actor, id);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: category });
  });

  it("requires a manager to rename or reactivate a category", async () => {
    updateProductCategory
      .mockResolvedValueOnce({ ...category, name: "Fragancias" })
      .mockResolvedValueOnce(category);

    const renamed = await PATCH(
      new Request(`http://localhost/api/product-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Fragancias" }),
      }),
      context,
    );
    const reactivated = await PATCH(
      new Request(`http://localhost/api/product-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      }),
      context,
    );

    expect(requireManager).toHaveBeenCalledTimes(2);
    expect(requireUser).not.toHaveBeenCalled();
    expect(updateProductCategory).toHaveBeenNthCalledWith(1, actor, id, {
      name: "Fragancias",
    });
    expect(updateProductCategory).toHaveBeenNthCalledWith(2, actor, id, {
      isActive: true,
    });
    expect(renamed.status).toBe(200);
    expect(reactivated.status).toBe(200);
  });

  it("rejects an invalid category id and accepts deactivation patch", async () => {
    updateProductCategory.mockResolvedValue({ ...category, isActive: false });
    const invalidId = await GET(
      new Request("http://localhost/api/product-categories/not-a-uuid"),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    const invalidUpdate = await PATCH(
      new Request(`http://localhost/api/product-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      }),
      context,
    );

    expect(getProductCategory).not.toHaveBeenCalled();
    expect(updateProductCategory).toHaveBeenCalledWith(actor, id, {
      isActive: false,
    });
    expect(invalidId.status).toBe(400);
    expect(invalidUpdate.status).toBe(200);
  });

  it("deletes through the dedicated service and propagates conflicts", async () => {
    deleteProductCategory.mockRejectedValue(
      new AppError(
        "PRODUCT_CATEGORY_HAS_PRODUCTS",
        "Esta categoría tiene productos asociados. Desactivala para conservar el catálogo y el historial.",
        409,
      ),
    );

    const response = await DELETE(
      new Request(`http://localhost/api/product-categories/${id}`, {
        method: "DELETE",
      }),
      context,
    );

    expect(requireManager).toHaveBeenCalledTimes(1);
    expect(requireUser).not.toHaveBeenCalled();
    expect(deleteProductCategory).toHaveBeenCalledWith(actor, id);
    expect(deactivateProductCategory).not.toHaveBeenCalled();
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "PRODUCT_CATEGORY_HAS_PRODUCTS",
        message: "Esta categoría tiene productos asociados. Desactivala para conservar el catálogo y el historial.",
      },
    });
  });
});
