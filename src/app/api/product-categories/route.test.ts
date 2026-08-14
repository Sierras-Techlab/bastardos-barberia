import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireUser,
  requireManager,
  listProductCategories,
  createProductCategory,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  listProductCategories: vi.fn(),
  createProductCategory: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireUser, requireManager }));
vi.mock("@/lib/product-categories/service", () => ({
  listProductCategories,
  createProductCategory,
}));

import { GET, POST } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000001" };
const category = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Cuidado capilar",
  isActive: true,
};

describe("/api/product-categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user: actor });
    requireManager.mockResolvedValue({ user: actor });
  });

  it("lists categories for an authenticated user", async () => {
    listProductCategories.mockResolvedValue({ categories: [category] });

    const response = await GET();

    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(requireManager).not.toHaveBeenCalled();
    expect(listProductCategories).toHaveBeenCalledWith(actor);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { categories: [category] },
    });
  });

  it("creates a category as a manager", async () => {
    createProductCategory.mockResolvedValue(category);

    const response = await POST(
      new Request("http://localhost/api/product-categories", {
        method: "POST",
        body: JSON.stringify({ name: category.name }),
      }),
    );

    expect(requireManager).toHaveBeenCalledTimes(1);
    expect(requireUser).not.toHaveBeenCalled();
    expect(createProductCategory).toHaveBeenCalledWith(actor, {
      name: category.name,
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ data: category });
  });

  it("rejects strict malformed category creation input", async () => {
    const response = await POST(
      new Request("http://localhost/api/product-categories", {
        method: "POST",
        body: JSON.stringify({ name: category.name, isActive: true }),
      }),
    );

    expect(createProductCategory).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
  });
});
