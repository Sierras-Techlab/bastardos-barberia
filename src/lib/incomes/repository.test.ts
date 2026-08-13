import { beforeEach, expect, it, vi } from "vitest";
const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));
import { incomeRepository } from "@/lib/incomes/repository";
import type { SafeUser } from "@/lib/auth/types";

const item = { id: "20000000-0000-4000-8000-000000000001", createdAt: "2026-08-11T12:00:00.000Z", businessDate: "2026-08-11", employee: { id: "00000000-0000-4000-8000-000000000003", firstName: "Fer", lastName: "Pérez" }, registeredBy: { id: "00000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "García" }, customer: null, service: { id: "30000000-0000-4000-8000-000000000001", name: "Barba", price: 13000 }, products: [], paymentMethod: "cash", payments: [{ method: "cash", amount: 13000 }], commission: { serviceBase: 13000, productBase: 0, serviceRate: 50, productRate: 10, serviceAmount: 6500, productAmount: 0, total: 6500, barbershopNet: 6500, fullServiceCommission: false, authorizedBy: null }, total: 13000, status: "active" };
const actor: SafeUser = { ...item.employee, username: "fer.perez", role: { id: 3, name: "employee" }, isActive: true, serviceCommissionRate: 45, productCommissionRate: 10, lastLoginAt: null, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" };
const input = { requestId: "40000000-0000-4000-8000-000000000001", employeeId: actor.id, customerId: null, serviceId: item.service.id, products: [], payments: [{ method: "cash" as const, amount: 13000 }], grantFullServiceCommission: false };
beforeEach(() => vi.clearAllMocks());
it("maps create and list to exact RPC parameters and validates JSON", async () => {
  const rpc = vi.fn().mockResolvedValueOnce({ data: item.id, error: null }).mockResolvedValueOnce({ data: item, error: null }).mockResolvedValueOnce({ data: { items: [item], metrics: { grossTotal: 13000, commissionTotal: 6500, barbershopNet: 6500, count: 1, average: 13000, cashTotal: 13000, transferTotal: 0 }, pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }, error: null });
  getSupabaseAdmin.mockReturnValue({ rpc });
  await incomeRepository.create(actor, input);
  expect(rpc).toHaveBeenNthCalledWith(1, "create_income_v2", { actor_user_id: actor.id, responsible_employee_id: actor.id, income_request_id: input.requestId, selected_customer_id: null, selected_service_id: item.service.id, product_items: [], payment_items: input.payments, grant_full_service_commission: false });
  await incomeRepository.list({ requestingUserId: item.employee.id, canViewAll: false, userId: item.employee.id }, { page: 1, pageSize: 10 });
  expect(rpc).toHaveBeenLastCalledWith("list_incomes", expect.objectContaining({ requesting_user_id: item.employee.id, can_view_all: false, filter_user_id: item.employee.id, page_number: 1, page_size: 10 }));
});
it("accepts the PostgreSQL timestamptz offset returned for createdAt", async () => {
  const databaseItem = {
    ...item,
    createdAt: "2026-08-11T21:47:11.479856+00:00",
  };
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({ data: item.id, error: null })
    .mockResolvedValueOnce({ data: databaseItem, error: null });
  getSupabaseAdmin.mockReturnValue({ rpc });

  await expect(
    incomeRepository.create(actor, input),
  ).resolves.toEqual(databaseItem);
});
it("maps insufficient stock without exposing database details", async () => {
  getSupabaseAdmin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "INSUFFICIENT_STOCK:Gel" } }) });
  await expect(incomeRepository.create(actor, input)).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", status: 409, message: expect.stringContaining("Gel") });
});

it.each([
  ["EMPLOYEE_NOT_ELIGIBLE", "EMPLOYEE_NOT_ELIGIBLE", 409],
  ["PAYMENT_ALLOCATION_MISMATCH", "PAYMENT_ALLOCATION_MISMATCH", 409],
  ["INVALID_COMMISSION_OVERRIDE", "INVALID_COMMISSION_OVERRIDE", 403],
  ["COMMISSION_RATE_OUT_OF_RANGE", "COMMISSION_RATE_OUT_OF_RANGE", 409],
  ["INCOME_REQUEST_CONFLICT", "INCOME_REQUEST_CONFLICT", 409],
])("maps %s to the public error contract", async (message, code, status) => {
  getSupabaseAdmin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message } }) });
  await expect(incomeRepository.create(actor, input)).rejects.toMatchObject({ code, status });
});
