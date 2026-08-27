import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));

import { fixedCustomerPaymentRepository } from "@/lib/fixed-customer-payments/repository";
import { AppError } from "@/lib/auth/errors";

describe("fixed customer payment repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls list_fixed_customer_months with the period and optional employee filter", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    getSupabaseAdmin.mockReturnValue({ rpc });
    await fixedCustomerPaymentRepository.list("actor", true, { period: "2026-08", employeeId: "00000000-0000-4000-8000-000000000003" });
    expect(rpc).toHaveBeenCalledWith("list_fixed_customer_months", {
      actor_user_id: "actor",
      can_view_all: true,
      filter_period: "2026-08",
      filter_employee_id: "00000000-0000-4000-8000-000000000003",
    });
  });

  it("normalises the employee filter to null when absent", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    getSupabaseAdmin.mockReturnValue({ rpc });
    await fixedCustomerPaymentRepository.list("actor", false, { period: "2026-08" });
    expect(rpc).toHaveBeenCalledWith("list_fixed_customer_months", {
      actor_user_id: "actor",
      can_view_all: false,
      filter_period: "2026-08",
      filter_employee_id: null,
    });
  });

  it("propagates the FIXED_MONTH_ALREADY_PAID sentinel as a 409 AppError", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "FIXED_MONTH_ALREADY_PAID: 2026-08" } });
    getSupabaseAdmin.mockReturnValue({ rpc });
    await expect(fixedCustomerPaymentRepository.pay("actor", {
      requestId: "00000000-0000-4000-8000-0000000000aa",
      customerId: "10000000-0000-4000-8000-000000000001",
      period: "2026-08",
      payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 15000 }],
    })).rejects.toBeInstanceOf(AppError);
    await expect(fixedCustomerPaymentRepository.pay("actor", {
      requestId: "00000000-0000-4000-8000-0000000000aa",
      customerId: "10000000-0000-4000-8000-000000000001",
      period: "2026-08",
      payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 15000 }],
    })).rejects.toMatchObject({ code: "FIXED_MONTH_ALREADY_PAID", status: 409 });
  });

  it("maps an inactive or missing payment method to a stable conflict", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "FIXED_MONTH_PAYMENT_METHOD_NOT_AVAILABLE" },
    });
    getSupabaseAdmin.mockReturnValue({ rpc });

    await expect(fixedCustomerPaymentRepository.pay("actor", {
      requestId: "00000000-0000-4000-8000-0000000000aa",
      customerId: "10000000-0000-4000-8000-000000000001",
      period: "2026-08",
      payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 15000 }],
    })).rejects.toMatchObject({
      code: "FIXED_MONTH_PAYMENT_METHOD_NOT_AVAILABLE",
      status: 409,
    });
  });

  it("maps a reused request id with different monthly-payment data to a stable conflict", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "FIXED_MONTH_REQUEST_CONFLICT" },
    });
    getSupabaseAdmin.mockReturnValue({ rpc });

    await expect(fixedCustomerPaymentRepository.pay("actor", {
      requestId: "00000000-0000-4000-8000-0000000000aa",
      customerId: "10000000-0000-4000-8000-000000000001",
      period: "2026-08",
      payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 15000 }],
    })).rejects.toMatchObject({ code: "FIXED_MONTH_REQUEST_CONFLICT", status: 409 });
  });

  it("returns null when get_fixed_customer_month resolves with no row", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    getSupabaseAdmin.mockReturnValue({ rpc });
    await expect(fixedCustomerPaymentRepository.get("actor", true, "10000000-0000-4000-8000-000000000001", "2026-08")).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledWith("get_fixed_customer_month", {
      actor_user_id: "actor",
      can_view_all: true,
      target_customer_id: "10000000-0000-4000-8000-000000000001",
      target_period: "2026-08",
    });
  });

  it("rejects manager projection missing monthlyPrice", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        viewer: "manager",
        customer: { id: "10000000-0000-4000-8000-000000000001", firstName: "Juan", lastName: "Cruz" },
        responsibleProfessional: { id: "00000000-0000-4000-8000-000000000003", firstName: "Fer", lastName: "Pérez" },
        period: "2026-08",
        status: "pending",
        paidAt: null,
        incomeId: null,
        employeeEarning: 0,
      },
      error: null,
    });
    getSupabaseAdmin.mockReturnValue({ rpc });
    await expect(fixedCustomerPaymentRepository.pay("actor", {
      requestId: "00000000-0000-4000-8000-0000000000aa",
      customerId: "10000000-0000-4000-8000-000000000001",
      period: "2026-08",
      payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 15000 }],
    })).rejects.toThrow("No se pudo completar la operación en la base de datos.");
  });
});
