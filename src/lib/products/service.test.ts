import { describe, expect, it, vi } from "vitest";

import type { SafeUser } from "@/lib/auth/types";
import type {
  ProductRepository,
  ProductServiceDependencies,
} from "@/lib/products/contracts";
import {
  createProductSchema,
  productIdSchema,
  stockAdjustmentSchema,
  updateProductSchema,
} from "@/lib/products/schemas";
import {
  adjustProductStock,
  createProduct,
  listProducts,
  updateProduct,
} from "@/lib/products/service";
import type { CatalogProduct } from "@/types/product";

const owner: SafeUser = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Ana",
  lastName: "García",
  username: "ana.garcia",
  role: { id: 1, name: "owner" },
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
};

const employee: SafeUser = {
  ...owner,
  id: "00000000-0000-4000-8000-000000000003",
  role: { id: 3, name: "employee" },
  username: "fer.perez",
};

const product: CatalogProduct = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Gel",
  category: "styling",
  price: 9900,
  stock: 4,
  isActive: true,
};

const dependencies = (): ProductServiceDependencies => ({
  products: {
    list: vi.fn().mockResolvedValue([product]),
    findById: vi.fn().mockResolvedValue(product),
    create: vi.fn().mockResolvedValue(product),
    update: vi.fn().mockResolvedValue(product),
    adjustStock: vi.fn().mockResolvedValue({ ...product, stock: 2 }),
  } satisfies ProductRepository,
});

const validCreateInput = {
  name: "Gel",
  category: "styling" as const,
  price: 9900,
  stock: 4,
};

describe("product boundary schemas", () => {
  it("normalizes a valid product creation request", () => {
    expect(
      createProductSchema.parse({ ...validCreateInput, name: "  Gel  " }),
    ).toEqual(validCreateInput);
  });

  it("rejects invalid product values and unsupported update fields", () => {
    expect(
      createProductSchema.safeParse({
        name: "",
        category: "unknown",
        price: -1,
        stock: 1.5,
      }).success,
    ).toBe(false);
    expect(updateProductSchema.safeParse({}).success).toBe(false);
    expect(updateProductSchema.safeParse({ stock: 10 }).success).toBe(false);
    expect(productIdSchema.safeParse("product-gel").success).toBe(false);
    expect(
      stockAdjustmentSchema.safeParse({ kind: "exit", quantity: 0 }).success,
    ).toBe(false);
  });
});

describe("product service", () => {
  it("returns every product to managers and active products to employees", async () => {
    const managerDeps = dependencies();
    const employeeDeps = dependencies();

    await expect(listProducts(owner, managerDeps)).resolves.toEqual({
      products: [product],
    });
    await expect(listProducts(employee, employeeDeps)).resolves.toEqual({
      products: [product],
    });

    expect(managerDeps.products.list).toHaveBeenCalledWith(true);
    expect(employeeDeps.products.list).toHaveBeenCalledWith(false);
  });

  it("rejects employee mutations before persistence", async () => {
    const deps = dependencies();

    await expect(
      createProduct(employee, validCreateInput, deps),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    expect(deps.products.create).not.toHaveBeenCalled();
  });

  it("records the authenticated manager when creating a product", async () => {
    const deps = dependencies();

    await expect(
      createProduct(owner, validCreateInput, deps),
    ).resolves.toEqual(product);

    expect(deps.products.create).toHaveBeenCalledWith({
      ...validCreateInput,
      createdBy: owner.id,
    });
  });

  it("records the authenticated manager when updating a product", async () => {
    const deps = dependencies();

    await updateProduct(owner, product.id, { price: 10900 }, deps);

    expect(deps.products.update).toHaveBeenCalledWith(product.id, {
      price: 10900,
      updatedBy: owner.id,
    });
  });

  it("records the authenticated manager on stock adjustments", async () => {
    const deps = dependencies();

    await expect(
      adjustProductStock(
        owner,
        product.id,
        { kind: "exit", quantity: 2 },
        deps,
      ),
    ).resolves.toEqual({ ...product, stock: 2 });

    expect(deps.products.adjustStock).toHaveBeenCalledWith(
      product.id,
      owner.id,
      { kind: "exit", quantity: 2 },
    );
  });

  it("reports missing products returned by persistence", async () => {
    const deps = dependencies();
    vi.mocked(deps.products.update).mockResolvedValue(null);

    await expect(
      updateProduct(owner, product.id, { isActive: false }, deps),
    ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND", status: 404 });
  });
});
