import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));

import { serviceRepository, toCatalogService } from "@/lib/services/repository";
import type { ServiceRow } from "@/lib/supabase/database.types";

const row: ServiceRow = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Barba",
  normalized_name: "barba",
  price: 13000,
  is_active: true,
  created_by: "00000000-0000-4000-8000-000000000001",
  updated_by: "00000000-0000-4000-8000-000000000001",
  deleted_at: null,
  deleted_by: null,
  created_at: "2026-08-11T10:00:00.000Z",
  updated_at: "2026-08-11T10:00:00.000Z",
};

describe("service repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps rows without audit fields and excludes deleted rows", async () => {
    const query = { select: vi.fn(), is: vi.fn(), eq: vi.fn(), order: vi.fn() };
    query.select.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [row], error: null });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    await expect(serviceRepository.list(false)).resolves.toEqual([toCatalogService(row)]);
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
  });

  it("writes audit actors on create, update and logical deletion", async () => {
    const query = {
      insert: vi.fn(), update: vi.fn(), eq: vi.fn(), is: vi.fn(),
      select: vi.fn(), maybeSingle: vi.fn(),
    };
    for (const key of ["insert", "update", "eq", "is", "select"] as const) {
      query[key].mockReturnValue(query);
    }
    query.maybeSingle.mockResolvedValue({ data: row, error: null });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    await serviceRepository.create({ name: "Barba", price: 13000, createdBy: row.created_by });
    expect(query.insert).toHaveBeenCalledWith({
      name: "Barba", normalized_name: "", price: 13000,
      created_by: row.created_by, updated_by: row.created_by,
    });

    await serviceRepository.update(row.id, { price: 14000, updatedBy: row.updated_by });
    expect(query.update).toHaveBeenCalledWith({ price: 14000, updated_by: row.updated_by });

    await serviceRepository.softDelete(row.id, row.updated_by, "2026-08-11T12:00:00.000Z");
    expect(query.update).toHaveBeenLastCalledWith({
      is_active: false,
      deleted_at: "2026-08-11T12:00:00.000Z",
      deleted_by: row.updated_by,
      updated_by: row.updated_by,
    });
  });

  it("maps unique names to a stable conflict", async () => {
    const query = { insert: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() };
    query.insert.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: null, error: { code: "23505" } });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    await expect(serviceRepository.create({ name: "Barba", price: 13000, createdBy: row.created_by }))
      .rejects.toMatchObject({ code: "SERVICE_NAME_EXISTS", status: 409 });
  });
});
