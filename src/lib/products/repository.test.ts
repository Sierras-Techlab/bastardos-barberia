import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));

import {
  productRepository,
  toCatalogProduct,
} from "@/lib/products/repository";
import type { ProductRow } from "@/lib/supabase/database.types";

const row: ProductRow = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Gel",
  normalized_name: "gel",
  category: "styling",
  price: 9900,
  stock: 4,
  is_active: true,
  created_by: "00000000-0000-4000-8000-000000000001",
  updated_by: "00000000-0000-4000-8000-000000000001",
  created_at: "2026-08-11T10:00:00.000Z",
  updated_at: "2026-08-11T10:00:00.000Z",
};

const createReadQuery = (data: ProductRow | null = row) => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
};

describe("product repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps database rows without exposing audit fields", () => {
    expect(toCatalogProduct(row)).toEqual({
      id: row.id,
      name: "Gel",
      category: "styling",
      price: 9900,
      stock: 4,
      isActive: true,
    });
  });

  it("limits employee catalog reads to active products", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn().mockResolvedValue({ data: [row], error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    getSupabaseAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    });

    await expect(productRepository.list(false)).resolves.toEqual([
      toCatalogProduct(row),
    ]);

    expect(query.eq).toHaveBeenCalledWith("is_active", true);
  });

  it("creates through the atomic database function", async () => {
    const query = createReadQuery();
    const rpc = vi.fn().mockResolvedValue({ data: row.id, error: null });
    getSupabaseAdmin.mockReturnValue({
      rpc,
      from: vi.fn().mockReturnValue(query),
    });

    await productRepository.create({
      name: "Gel",
      category: "styling",
      price: 9900,
      stock: 4,
      createdBy: row.created_by,
    });

    expect(rpc).toHaveBeenCalledWith("create_product", {
      product_name: "Gel",
      product_category: "styling",
      product_price: 9900,
      initial_stock: 4,
      actor_user_id: row.created_by,
    });
  });

  it("updates only supplied profile fields and the audit actor", async () => {
    const query = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    getSupabaseAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    });

    await productRepository.update(row.id, {
      price: 10900,
      updatedBy: row.updated_by,
    });

    expect(query.update).toHaveBeenCalledWith({
      price: 10900,
      updated_by: row.updated_by,
    });
  });

  it("maps stock adjustment inputs to the atomic function", async () => {
    const query = createReadQuery({ ...row, stock: 2 });
    const rpc = vi.fn().mockResolvedValue({ data: row.id, error: null });
    getSupabaseAdmin.mockReturnValue({
      rpc,
      from: vi.fn().mockReturnValue(query),
    });

    await expect(
      productRepository.adjustStock(
        row.id,
        row.updated_by,
        { kind: "exit", quantity: 2 },
      ),
    ).resolves.toMatchObject({ stock: 2 });

    expect(rpc).toHaveBeenCalledWith("adjust_product_stock", {
      target_product_id: row.id,
      actor_user_id: row.updated_by,
      movement_kind: "exit",
      movement_quantity: 2,
    });
  });

  it("translates duplicate names and insufficient stock", async () => {
    getSupabaseAdmin
      .mockReturnValueOnce({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0001", message: "PRODUCT_NAME_EXISTS" },
        }),
      })
      .mockReturnValueOnce({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0001", message: "INSUFFICIENT_STOCK" },
        }),
      });

    await expect(
      productRepository.create({
        name: "Gel",
        category: "styling",
        price: 9900,
        stock: 0,
        createdBy: row.created_by,
      }),
    ).rejects.toMatchObject({ code: "PRODUCT_NAME_EXISTS", status: 409 });

    await expect(
      productRepository.adjustStock(
        row.id,
        row.updated_by,
        { kind: "exit", quantity: 9 },
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", status: 409 });
  });
});
