import { beforeEach, expect, it, vi } from "vitest";
const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));
import { incomeRepository } from "@/lib/incomes/repository";
import type { SafeUser } from "@/lib/auth/types";

const manager = { id: "00000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "García" };
const serviceCommission = {
  subtotal: 13000,
  catalogSubtotal: 13000,
  chargedSubtotal: 13000,
  adjustmentAmount: 0,
  rate: 50,
  amount: 6500,
  fullCommission: false,
  authorizedBy: null,
};
const productCommission = {
  subtotal: 20000,
  catalogSubtotal: 20000,
  chargedSubtotal: 20000,
  adjustmentAmount: 0,
  rate: 100,
  amount: 20000,
  fullCommission: true,
  authorizedBy: manager,
};
const item = { id: "20000000-0000-4000-8000-000000000001", createdAt: "2026-08-11T12:00:00.000Z", businessDate: "2026-08-11", employee: { id: "00000000-0000-4000-8000-000000000003", firstName: "Fer", lastName: "Pérez" }, registeredBy: manager, customer: null, service: { id: "30000000-0000-4000-8000-000000000001", name: "Barba", price: 13000, catalogUnitPrice: 13000, chargedUnitPrice: 13000, catalogSubtotal: 13000, chargedSubtotal: 13000, adjustmentAmount: 0, commission: serviceCommission }, products: [{ id: "50000000-0000-4000-8000-000000000001", name: "Cera", unitPrice: 10000, catalogUnitPrice: 10000, chargedUnitPrice: 10000, catalogSubtotal: 20000, chargedSubtotal: 20000, adjustmentAmount: 0, quantity: 2, commission: productCommission }], payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", methodName: "Efectivo", amount: 33000 }], commission: { total: 26500, barbershopNet: 6500 }, total: 33000, status: "active" };
const actor: SafeUser = { ...item.employee, username: "fer.perez", role: { id: 3, name: "employee" }, isActive: true, serviceCommissionRate: 45, productCommissionRate: 10, lastLoginAt: null, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" };
const input = { requestId: "40000000-0000-4000-8000-000000000001", employeeId: actor.id, customerId: null, serviceId: item.service.id, products: [{ productId: item.products[0].id, quantity: 2, grantFullCommission: true }], payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 33000 }], grantFullServiceCommission: false };
beforeEach(() => vi.clearAllMocks());
it("maps create and list to exact RPC parameters and validates JSON", async () => {
  const rpc = vi.fn().mockResolvedValueOnce({ data: item.id, error: null }).mockResolvedValueOnce({ data: item, error: null }).mockResolvedValueOnce({ data: { items: [item], metrics: { grossTotal: 33000, commissionTotal: 26500, barbershopNet: 6500, count: 1, average: 33000, paymentTotals: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", name: "Efectivo", amount: 33000 }] }, pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }, error: null });
  getSupabaseAdmin.mockReturnValue({ rpc });
  await incomeRepository.create(actor, input);
  expect(rpc).toHaveBeenNthCalledWith(1, "create_income", expect.objectContaining({ actor_user_id: actor.id, responsible_employee_id: actor.id, income_request_id: input.requestId, selected_customer_id: null, selected_service_id: item.service.id, product_items: [{ productId: item.products[0].id, quantity: 2, grantFullCommission: true }], payment_items: input.payments, grant_full_service_commission: false }));
  await incomeRepository.list({ requestingUserId: item.employee.id, canViewAll: false, userId: item.employee.id }, { page: 1, pageSize: 10, paymentMethodId: "60000000-0000-4000-8000-000000000001" });
  expect(rpc).toHaveBeenLastCalledWith("list_incomes", expect.objectContaining({ requesting_user_id: item.employee.id, can_view_all: false, filter_user_id: item.employee.id, filter_payment_method_id: "60000000-0000-4000-8000-000000000001", page_number: 1, page_size: 10 }));
});

it("requires historical method-name snapshots in income responses", async () => {
  const paymentWithoutName = { paymentMethodId: item.payments[0].paymentMethodId, amount: item.payments[0].amount };
  const rpc = vi.fn().mockResolvedValueOnce({ data: item.id, error: null }).mockResolvedValueOnce({ data: { ...item, payments: [paymentWithoutName] }, error: null });
  getSupabaseAdmin.mockReturnValue({ rpc });
  await expect(incomeRepository.create(actor, input)).rejects.toThrow("No se pudo completar la operación en la base de datos.");
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
it("rejects a response when a sale item omits its commission snapshot", async () => {
  const serviceWithoutCommission = {
    id: item.service.id,
    name: item.service.name,
    price: item.service.price,
  };
  const databaseItem = { ...item, service: serviceWithoutCommission };
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({ data: item.id, error: null })
    .mockResolvedValueOnce({ data: databaseItem, error: null });
  getSupabaseAdmin.mockReturnValue({ rpc });

  await expect(incomeRepository.create(actor, input)).rejects.toThrow("No se pudo completar la operación en la base de datos.");
});
it("lists every historical responsible user through the dedicated RPC", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: [item.employee], error: null });
  getSupabaseAdmin.mockReturnValue({ rpc });

  await expect(incomeRepository.listResponsibleEmployees(actor.id)).resolves.toEqual([item.employee]);
  expect(rpc).toHaveBeenCalledWith("list_income_responsible_users", { requesting_user_id: actor.id });
});
it("maps insufficient stock without exposing database details", async () => {
  getSupabaseAdmin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "INSUFFICIENT_STOCK:Gel" } }) });
  await expect(incomeRepository.create(actor, input)).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", status: 409, message: expect.stringContaining("Gel") });
});

it("maps the database work-session requirement to the stable sale conflict", async () => {
  getSupabaseAdmin.mockReturnValue({
    rpc: vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "PostgreSQL error: EMPLOYEE_WORK_SESSION_REQUIRED",
      },
    }),
  });

  await expect(incomeRepository.create(actor, input)).rejects.toMatchObject({
    code: "EMPLOYEE_WORK_SESSION_REQUIRED",
    status: 409,
    message: "Iniciá tu jornada antes de registrar una venta.",
  });
});

it.each([
  ["EMPLOYEE_NOT_ELIGIBLE", "EMPLOYEE_NOT_ELIGIBLE", 409],
  ["PAYMENT_ALLOCATION_MISMATCH", "PAYMENT_ALLOCATION_MISMATCH", 409],
  ["INVALID_COMMISSION_OVERRIDE", "INVALID_COMMISSION_OVERRIDE", 403],
  ["INVALID_PRODUCT_COMMISSION_OVERRIDE", "INVALID_PRODUCT_COMMISSION_OVERRIDE", 403],
  ["COMMISSION_RATE_OUT_OF_RANGE", "COMMISSION_RATE_OUT_OF_RANGE", 409],
  ["INCOME_REQUEST_CONFLICT", "INCOME_REQUEST_CONFLICT", 409],
])("maps %s to the public error contract", async (message, code, status) => {
  getSupabaseAdmin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message } }) });
  await expect(incomeRepository.create(actor, input)).rejects.toMatchObject({ code, status });
});
