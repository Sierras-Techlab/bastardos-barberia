import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));

import { customerRepository, toCustomer } from "@/lib/customers/repository";
import type { CustomerRow } from "@/lib/supabase/database.types";

const row: CustomerRow = { id: "10000000-0000-4000-8000-000000000001", first_name: "Ana", last_name: "Pérez", phone: "+54 351 555 0101", normalized_phone: "543515550101", email: null, visits: 0, created_by: "00000000-0000-4000-8000-000000000001", updated_by: "00000000-0000-4000-8000-000000000001", deleted_at: null, deleted_by: null, created_at: "2026-08-11T10:00:00.000Z", updated_at: "2026-08-11T10:00:00.000Z" };

describe("customer repository", () => {
  beforeEach(() => vi.clearAllMocks());
  it("maps nullable email and excludes deleted records", async () => {
    const query = { select: vi.fn(), is: vi.fn(), order: vi.fn() };
    query.select.mockReturnValue(query); query.is.mockReturnValue(query); query.order.mockResolvedValue({ data: [row], error: null });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    await expect(customerRepository.list()).resolves.toEqual([toCustomer(row)]);
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  });
  it("returns only the newest non-deleted customer", async () => {
    const query = {
      select: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: row, error: null });
    getSupabaseAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    });

    await expect(customerRepository.latest()).resolves.toEqual(toCustomer(row));
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(query.limit).toHaveBeenCalledWith(1);
  });
  it("maps normalized phone and email conflicts", async () => {
    getSupabaseAdmin.mockReturnValueOnce({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "23505", details: "normalized_phone" } }) });
    await expect(customerRepository.create({ firstName: "Ana", lastName: "Pérez", phone: row.phone, email: null, fixedSchedule: null, createdBy: row.created_by })).rejects.toMatchObject({ code: "CUSTOMER_PHONE_EXISTS" });
    getSupabaseAdmin.mockReturnValueOnce({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "23505", details: "email" } }) });
    await expect(customerRepository.create({ firstName: "Ana", lastName: "Pérez", phone: "3515559999", email: "ana@mail.com", fixedSchedule: null, createdBy: row.created_by })).rejects.toMatchObject({ code: "CUSTOMER_EMAIL_EXISTS" });
  });

  it("persists customer and weekly schedule through canonical atomic RPCs", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: row.id, error: null })
      .mockResolvedValueOnce({ data: row.id, error: null });
    const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: { ...row, fixed_schedule: [{ weekday: 4, local_time: "10:00:00", is_active: true, version: 1 }] }, error: null });
    getSupabaseAdmin.mockReturnValue({ rpc, from: vi.fn().mockReturnValue(query) });

    await customerRepository.create({ firstName: "Ana", lastName: "Pérez", phone: row.phone, email: null, fixedSchedule: { weekday: 4, time: "10:00" }, createdBy: row.created_by });
    await customerRepository.update(row.id, { fixedSchedule: null, expectedScheduleVersion: 1, updatedBy: row.updated_by });

    expect(rpc).toHaveBeenNthCalledWith(1, "create_customer", {
      actor_user_id: row.created_by,
      new_first_name: "Ana",
      new_last_name: "Pérez",
      new_phone: row.phone,
      new_email: null,
      fixed_schedule: { weekday: 4, time: "10:00" },
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "update_customer", expect.objectContaining({
      target_customer_id: row.id,
      actor_user_id: row.updated_by,
      set_fixed_schedule: true,
      new_fixed_schedule: null,
      expected_schedule_version: 1,
    }));
  });

  it("returns the strict financial projection for active customer visits", async () => {
    const response = {
      items: [{
        id: "20000000-0000-4000-8000-000000000001",
        occurredAt: "2026-08-13T14:00:00.000Z",
        businessDate: "2026-08-13",
        totalSpent: 49000,
        items: [
          { type: "service", name: "Corte", quantity: 1, unitPrice: 19000, subtotal: 19000 },
          { type: "product", name: "Cera mate", quantity: 2, unitPrice: 15000, subtotal: 30000 },
        ],
      }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };
    const rpc = vi.fn().mockResolvedValue({ data: response, error: null });
    getSupabaseAdmin.mockReturnValue({ rpc });

    await expect(customerRepository.listVisits(row.created_by, row.id, { page: 1, pageSize: 20 })).resolves.toEqual(response);
    expect(rpc).toHaveBeenCalledWith("list_customer_visits", {
      actor_user_id: row.created_by,
      target_customer_id: row.id,
      page_number: 1,
      page_size: 20,
    });
    expect(JSON.stringify(response)).not.toMatch(/payment|commission|employee|registeredBy/i);
  });

  it("rejects financial or internal keys outside the public visit projection", async () => {
    const response = {
      items: [{
        id: "20000000-0000-4000-8000-000000000001",
        occurredAt: "2026-08-13T14:00:00.000Z",
        businessDate: "2026-08-13",
        totalSpent: 49000,
        commissionTotal: 0,
        employeeName: "No debe exponerse",
        items: [{ type: "service", name: "Corte", quantity: 1, unitPrice: 19000, subtotal: 19000 }],
      }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };
    getSupabaseAdmin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: response, error: null }) });

    await expect(customerRepository.listVisits(row.created_by, row.id, { page: 1, pageSize: 20 }))
      .rejects.toThrow("No se pudo completar la operación en la base de datos.");
  });
});
