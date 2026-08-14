import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));

import {
  productCategoryRepository,
  toProductCategory,
} from "@/lib/product-categories/repository";

const row = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Cuidado capilar",
  normalized_name: "cuidado capilar",
  is_active: true,
  created_by: "00000000-0000-4000-8000-000000000001",
  updated_by: "00000000-0000-4000-8000-000000000001",
  created_at: "2026-08-14T00:00:00.000Z",
  updated_at: "2026-08-14T00:00:00.000Z",
};

describe("product category repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps complete category rows without exposing audit fields", () => {
    expect(toProductCategory(row)).toEqual({
      id: row.id,
      name: "Cuidado capilar",
      isActive: true,
    });
  });

  it("lists only active categories when inactive records are excluded", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [row], error: null });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    await expect(productCategoryRepository.list(false)).resolves.toEqual([
      toProductCategory(row),
    ]);

    expect(getSupabaseAdmin().from).toHaveBeenCalledWith("product_categories");
    expect(query.select).toHaveBeenCalledWith(
      "id,name,normalized_name,is_active,created_by,updated_by,created_at,updated_at",
    );
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
  });

  it("writes canonical audit fields on create and update", async () => {
    const query = {
      insert: vi.fn(),
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(),
    };
    for (const method of ["insert", "update", "eq", "select"] as const) {
      query[method].mockReturnValue(query);
    }
    query.maybeSingle.mockResolvedValue({ data: row, error: null });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    await productCategoryRepository.create(row.created_by, { name: row.name });
    expect(query.insert).toHaveBeenCalledWith({
      name: row.name,
      normalized_name: "",
      created_by: row.created_by,
      updated_by: row.created_by,
    });

    await productCategoryRepository.update(row.updated_by, row.id, { isActive: false });
    expect(query.update).toHaveBeenCalledWith({
      is_active: false,
      updated_by: row.updated_by,
    });
  });

  it("deactivates through the canonical atomic function", async () => {
    const readQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
    readQuery.select.mockReturnValue(readQuery);
    readQuery.eq.mockReturnValue(readQuery);
    const rpc = vi.fn().mockResolvedValue({ data: row.id, error: null });
    getSupabaseAdmin.mockReturnValue({
      rpc,
      from: vi.fn().mockReturnValue(readQuery),
    });

    await expect(productCategoryRepository.deactivate(row.updated_by, row.id))
      .resolves.toEqual(toProductCategory(row));

    expect(rpc).toHaveBeenCalledWith("deactivate_product_category", {
      actor_user_id: row.updated_by,
      target_category_id: row.id,
    });
  });

  it("maps duplicate names and categories in use to stable conflicts", async () => {
    const createQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "P0001", message: "PRODUCT_CATEGORY_NAME_EXISTS" },
      }),
    };
    createQuery.insert.mockReturnValue(createQuery);
    createQuery.select.mockReturnValue(createQuery);

    getSupabaseAdmin
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(createQuery) })
      .mockReturnValueOnce({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0001", message: "PRODUCT_CATEGORY_IN_USE" },
        }),
      });

    await expect(productCategoryRepository.create(row.created_by, { name: row.name }))
      .rejects.toMatchObject({ code: "PRODUCT_CATEGORY_NAME_EXISTS", status: 409 });
    await expect(productCategoryRepository.deactivate(row.updated_by, row.id))
      .rejects.toMatchObject({ code: "PRODUCT_CATEGORY_IN_USE", status: 409 });
  });
});
