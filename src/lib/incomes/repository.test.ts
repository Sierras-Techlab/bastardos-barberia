import { beforeEach, expect, it, vi } from "vitest";
const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));
import { incomeRepository } from "@/lib/incomes/repository";

const item = { id: "20000000-0000-4000-8000-000000000001", createdAt: "2026-08-11T12:00:00.000Z", businessDate: "2026-08-11", employee: { id: "00000000-0000-4000-8000-000000000003", firstName: "Fer", lastName: "Pérez" }, customer: null, service: { id: "30000000-0000-4000-8000-000000000001", name: "Barba", price: 13000 }, products: [], paymentMethod: "cash", total: 13000, status: "active" };
beforeEach(() => vi.clearAllMocks());
it("maps create and list to exact RPC parameters and validates JSON", async () => {
  const rpc = vi.fn().mockResolvedValueOnce({ data: item.id, error: null }).mockResolvedValueOnce({ data: item, error: null }).mockResolvedValueOnce({ data: { items: [item], metrics: { total: 13000, count: 1, average: 13000, cashTotal: 13000, transferTotal: 0 }, pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }, error: null });
  getSupabaseAdmin.mockReturnValue({ rpc });
  const input = { requestId: "40000000-0000-4000-8000-000000000001", customerId: null, serviceId: item.service.id, products: [], paymentMethod: "cash" as const };
  await incomeRepository.create(item.employee.id, input);
  expect(rpc).toHaveBeenNthCalledWith(1, "create_income", { actor_user_id: item.employee.id, income_request_id: input.requestId, selected_customer_id: null, selected_service_id: item.service.id, product_items: [], selected_payment_method: "cash" });
  await incomeRepository.list({ requestingUserId: item.employee.id, canViewAll: false, userId: item.employee.id }, { page: 1, pageSize: 10 });
  expect(rpc).toHaveBeenLastCalledWith("list_incomes", expect.objectContaining({ requesting_user_id: item.employee.id, can_view_all: false, filter_user_id: item.employee.id, page_number: 1, page_size: 10 }));
});
it("maps insufficient stock without exposing database details", async () => {
  getSupabaseAdmin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "INSUFFICIENT_STOCK:Gel" } }) });
  await expect(incomeRepository.create(item.employee.id, { requestId: "40000000-0000-4000-8000-000000000001", customerId: null, serviceId: item.service.id, products: [], paymentMethod: "cash" })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", status: 409, message: expect.stringContaining("Gel") });
});
