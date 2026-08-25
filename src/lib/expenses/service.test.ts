import { describe, expect, it, vi } from "vitest";
import type { SafeUser } from "@/lib/auth/types";
import { listExpenses, voidExpense } from "@/lib/expenses/service";
const user = (name: "owner" | "employee"): SafeUser => ({ id: "00000000-0000-4000-8000-000000000001", firstName: "A", lastName: "B", username: "a.b", role: { id: name === "owner" ? 1 : 3, name }, isActive: true, serviceCommissionRate: 0, productCommissionRate: 0, lastLoginAt: null, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" });
const dependencies = () => ({ expenses: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), void: vi.fn(), summary: vi.fn() }, categories: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } });
describe("expense service", () => {
  it("rejects employees before repository access", () => { const d = dependencies(); expect(() => listExpenses(user("employee"), { page: 1, pageSize: 20 }, d)).toThrowError(expect.objectContaining({ code: "FORBIDDEN" })); expect(d.expenses.list).not.toHaveBeenCalled(); });
  it("passes only authenticated manager identity", async () => { const d = dependencies(); d.expenses.list.mockResolvedValue({ items: [], metrics: {}, page: 1, pageSize: 20, total: 0, totalPages: 0 }); await listExpenses(user("owner"), { page: 1, pageSize: 20 }, d); expect(d.expenses.list).toHaveBeenCalledWith(user("owner").id, { page: 1, pageSize: 20 }); });
  it("preserves the complete optimistic void input", async () => { const d = dependencies(); const input = { expectedUpdatedAt: "2026-08-23T12:00:00Z", reason: "duplicado" }; await voidExpense(user("owner"), "10000000-0000-4000-8000-000000000001", input, d); expect(d.expenses.void).toHaveBeenCalledWith(user("owner").id, "10000000-0000-4000-8000-000000000001", input); });
});
