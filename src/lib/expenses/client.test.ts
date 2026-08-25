import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseApiError, expenseClient } from "@/lib/expenses/client";
const fetchMock = vi.fn<typeof fetch>();
describe("expense client", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });
  it("uses no-store for filtered reads", async () => { fetchMock.mockResolvedValue(Response.json({ data: { items: [], metrics: { total: 0, count: 0, fixedTotal: 0, variableTotal: 0, suppliesTotal: 0 }, page: 1, pageSize: 20, total: 0, totalPages: 0 } })); await expenseClient.list({ month: "2026-08", page: 1, pageSize: 20 }); expect(fetchMock).toHaveBeenCalledWith("/api/expenses?month=2026-08&page=1&pageSize=20", { cache: "no-store" }); });
  it("preserves API errors", async () => { fetchMock.mockResolvedValue(Response.json({ error: { code: "EXPENSE_CONFLICT", message: "Conflicto" } }, { status: 409 })); await expect(expenseClient.get("x")).rejects.toEqual(new ExpenseApiError(409, "EXPENSE_CONFLICT", "Conflicto")); });
  it("sends the optimistic version when voiding", async () => { fetchMock.mockResolvedValue(Response.json({ error: { code: "EXPENSE_CONFLICT", message: "Conflicto" } }, { status: 409 })); const input = { expectedUpdatedAt: "2026-08-23T12:00:00Z", reason: "duplicado" }; await expect(expenseClient.void("expense-id", input)).rejects.toMatchObject({ code: "EXPENSE_CONFLICT" }); expect(fetchMock).toHaveBeenCalledWith("/api/expenses/expense-id/void", expect.objectContaining({ method: "POST", cache: "no-store", body: JSON.stringify(input) })); });
});
