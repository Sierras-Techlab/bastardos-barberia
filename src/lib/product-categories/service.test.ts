import { describe, expect, it, vi } from "vitest";

import type { SafeUser } from "@/lib/auth/types";
import type {
  ProductCategoryRepository,
  ProductCategoryServiceDependencies,
} from "@/lib/product-categories/contracts";
import {
  createProductCategory,
  deactivateProductCategory,
  getProductCategory,
  listProductCategories,
  updateProductCategory,
} from "@/lib/product-categories/service";
import type {
  ProductCategory,
  ProductCategoryUpdate,
} from "@/types/product-category";

const manager: SafeUser = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Ana",
  lastName: "García",
  username: "ana.garcia",
  role: { id: 1, name: "owner" },
  isActive: true,
  serviceCommissionRate: 0,
  productCommissionRate: 0,
  lastLoginAt: null,
  createdAt: "2026-08-14T00:00:00.000Z",
  updatedAt: "2026-08-14T00:00:00.000Z",
};
const employee: SafeUser = {
  ...manager,
  id: "00000000-0000-4000-8000-000000000003",
  username: "fer.perez",
  role: { id: 3, name: "employee" },
};
const category: ProductCategory = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Cuidado capilar",
  isActive: true,
};

const dependencies = (): ProductCategoryServiceDependencies => ({
  categories: {
    list: vi.fn().mockResolvedValue([category]),
    findById: vi.fn().mockResolvedValue(category),
    create: vi.fn().mockResolvedValue(category),
    update: vi.fn().mockResolvedValue(category),
    deactivate: vi.fn().mockResolvedValue(category),
  } satisfies ProductCategoryRepository,
});

describe("product category domain", () => {
  it("shows inactive categories to managers and active-only categories to employees", async () => {
    const managerDeps = dependencies();
    const employeeDeps = dependencies();

    await expect(listProductCategories(manager, managerDeps)).resolves.toEqual({
      categories: [category],
    });
    await expect(listProductCategories(employee, employeeDeps)).resolves.toEqual({
      categories: [category],
    });

    expect(managerDeps.categories.list).toHaveBeenCalledWith(true);
    expect(employeeDeps.categories.list).toHaveBeenCalledWith(false);
  });

  it("rejects employee category mutations before persistence", async () => {
    const deps = dependencies();

    await expect(createProductCategory(employee, { name: category.name }, deps))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(updateProductCategory(employee, category.id, { name: "Fragancias" }, deps))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(deactivateProductCategory(employee, category.id, deps))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    expect(deps.categories.create).not.toHaveBeenCalled();
    expect(deps.categories.update).not.toHaveBeenCalled();
    expect(deps.categories.deactivate).not.toHaveBeenCalled();
  });

  it("propagates the authenticated manager to every mutation", async () => {
    const deps = dependencies();

    await createProductCategory(manager, { name: category.name }, deps);
    await updateProductCategory(manager, category.id, { isActive: true }, deps);
    await deactivateProductCategory(manager, category.id, deps);

    expect(deps.categories.create).toHaveBeenCalledWith(manager.id, {
      name: category.name,
    });
    expect(deps.categories.update).toHaveBeenCalledWith(manager.id, category.id, {
      isActive: true,
    });
    expect(deps.categories.deactivate).toHaveBeenCalledWith(manager.id, category.id);
  });

  it("rejects direct deactivation attempts before repository persistence", async () => {
    const deps = dependencies();

    await expect(
      updateProductCategory(
        manager,
        category.id,
        { isActive: false } as unknown as ProductCategoryUpdate,
        deps,
      ),
    ).rejects.toMatchObject({ status: 400 });

    expect(deps.categories.update).not.toHaveBeenCalled();
  });

  it("does not expose missing or inactive categories to employees", async () => {
    const missingDeps = dependencies();
    vi.mocked(missingDeps.categories.findById).mockResolvedValue(null);
    await expect(getProductCategory(employee, category.id, missingDeps))
      .rejects.toMatchObject({ code: "PRODUCT_CATEGORY_NOT_FOUND", status: 404 });

    const inactiveDeps = dependencies();
    vi.mocked(inactiveDeps.categories.findById).mockResolvedValue({
      ...category,
      isActive: false,
    });
    await expect(getProductCategory(employee, category.id, inactiveDeps))
      .rejects.toMatchObject({ code: "PRODUCT_CATEGORY_NOT_FOUND", status: 404 });
  });

  it("reports missing category mutations safely", async () => {
    const deps = dependencies();
    vi.mocked(deps.categories.update).mockResolvedValue(null);

    await expect(updateProductCategory(manager, category.id, { name: "Fragancias" }, deps))
      .rejects.toMatchObject({ code: "PRODUCT_CATEGORY_NOT_FOUND", status: 404 });
  });
});
