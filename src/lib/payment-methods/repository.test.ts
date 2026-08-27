import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));

import {
  paymentMethodRepository,
  toPaymentMethod,
} from "@/lib/payment-methods/repository";

const row = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Efectivo",
  normalized_name: "efectivo",
  is_active: true,
  created_by: "00000000-0000-4000-8000-000000000001",
  updated_by: "00000000-0000-4000-8000-000000000001",
  created_at: "2026-08-14T00:00:00.000Z",
  updated_at: "2026-08-14T00:00:00.000Z",
};

describe("payment method repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps complete payment-method rows without exposing audit fields", () => {
    expect(toPaymentMethod(row)).toEqual({
      id: row.id,
      name: "Efectivo",
      isActive: true,
    });
  });

  it("lists inactive methods when history needs the full catalog", async () => {
    const query = { select: vi.fn(), order: vi.fn() };
    query.select.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [row], error: null });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    await expect(paymentMethodRepository.list(true)).resolves.toEqual([
      toPaymentMethod(row),
    ]);

    expect(getSupabaseAdmin().from).toHaveBeenCalledWith("payment_methods");
    expect(query.select).toHaveBeenCalledWith(
      "id,name,normalized_name,is_active,system_code,created_by,updated_by,created_at,updated_at",
    );
  });

  it("uses canonical create, update and delete RPCs", async () => {
    const readQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
    readQuery.select.mockReturnValue(readQuery);
    readQuery.eq.mockReturnValue(readQuery);
    const rpc = vi.fn().mockResolvedValue({ data: row.id, error: null });
    getSupabaseAdmin.mockReturnValue({ rpc, from: vi.fn().mockReturnValue(readQuery) });

    await paymentMethodRepository.create(row.created_by, { name: row.name });
    await paymentMethodRepository.update(row.updated_by, row.id, {
      name: "Transferencia",
      isActive: true,
    });
    await paymentMethodRepository.remove(row.updated_by, row.id);

    expect(rpc).toHaveBeenNthCalledWith(1, "create_payment_method", {
      actor_user_id: row.created_by,
      payment_method_name: row.name,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "update_payment_method", {
      actor_user_id: row.updated_by,
      target_payment_method_id: row.id,
      payment_method_name: "Transferencia",
      payment_method_is_active: true,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "delete_payment_method", {
      actor_user_id: row.updated_by,
      target_payment_method_id: row.id,
    });
  });

  it("maps duplicate names, final-active deletion and referenced deletion to stable conflicts", async () => {
    getSupabaseAdmin
      .mockReturnValueOnce({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0001", message: "PAYMENT_METHOD_NAME_EXISTS" },
        }),
      })
      .mockReturnValueOnce({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0001", message: "LAST_ACTIVE_PAYMENT_METHOD" },
        }),
      })
      .mockReturnValueOnce({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0001", message: "PAYMENT_METHOD_IN_USE" },
        }),
      })
      .mockReturnValueOnce({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "23503", message: "foreign key violation" },
        }),
      });

    await expect(paymentMethodRepository.create(row.created_by, { name: row.name }))
      .rejects.toMatchObject({ code: "PAYMENT_METHOD_NAME_EXISTS", status: 409 });
    await expect(paymentMethodRepository.remove(row.updated_by, row.id))
      .rejects.toMatchObject({ code: "LAST_ACTIVE_PAYMENT_METHOD", status: 409 });
    await expect(paymentMethodRepository.remove(row.updated_by, row.id))
      .rejects.toMatchObject({ code: "PAYMENT_METHOD_IN_USE", status: 409 });
    await expect(paymentMethodRepository.remove(row.updated_by, row.id))
      .rejects.toMatchObject({ code: "PAYMENT_METHOD_IN_USE", status: 409 });
  });
});
