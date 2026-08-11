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
  it("maps normalized phone and email conflicts", async () => {
    const makeQuery = (error: object) => { const q = { insert: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() }; q.insert.mockReturnValue(q); q.select.mockReturnValue(q); q.maybeSingle.mockResolvedValue({ data: null, error }); return q; };
    getSupabaseAdmin.mockReturnValueOnce({ from: vi.fn().mockReturnValue(makeQuery({ code: "23505", details: "normalized_phone" })) });
    await expect(customerRepository.create({ firstName: "Ana", lastName: "Pérez", phone: row.phone, email: null, createdBy: row.created_by })).rejects.toMatchObject({ code: "CUSTOMER_PHONE_EXISTS" });
    getSupabaseAdmin.mockReturnValueOnce({ from: vi.fn().mockReturnValue(makeQuery({ code: "23505", details: "email" })) });
    await expect(customerRepository.create({ firstName: "Ana", lastName: "Pérez", phone: "3515559999", email: "ana@mail.com", createdBy: row.created_by })).rejects.toMatchObject({ code: "CUSTOMER_EMAIL_EXISTS" });
  });
});
