import { beforeEach, describe, expect, it, vi } from "vitest";
const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin }));
import { expenseRepository } from "@/lib/expenses/repository";
describe("expense repository", () => {
  beforeEach(() => vi.clearAllMocks());
  it("maps every list filter to the canonical RPC", async () => { const rpc = vi.fn().mockResolvedValue({ data: { items: [], metrics: { total: 0, count: 0, fixedTotal: 0, variableTotal: 0, suppliesTotal: 0 }, page: 1, pageSize: 20, total: 0, totalPages: 0 }, error: null }); getSupabaseAdmin.mockReturnValue({ rpc }); await expenseRepository.list("00000000-0000-4000-8000-000000000001", { month: "2026-08", status: "voided", page: 1, pageSize: 20 }); expect(rpc).toHaveBeenCalledWith("list_expenses", expect.objectContaining({ actor_user_id: "00000000-0000-4000-8000-000000000001", filter_month: "2026-08", filter_status: "voided", page_number: 1 })); });
  it("passes the optimistic version to void_expense", async () => { const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "EXPENSE_CONFLICT" } }); getSupabaseAdmin.mockReturnValue({ rpc }); await expect(expenseRepository.void("00000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000001", { expectedUpdatedAt: "2026-08-23T12:00:00Z", reason: "duplicado" })).rejects.toMatchObject({ code: "EXPENSE_CONFLICT" }); expect(rpc).toHaveBeenCalledWith("void_expense", { actor_user_id: "00000000-0000-4000-8000-000000000001", target_expense_id: "10000000-0000-4000-8000-000000000001", expected_updated_at: "2026-08-23T12:00:00Z", void_reason: "duplicado" }); });
});
