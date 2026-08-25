import { beforeEach, describe, expect, it, vi } from "vitest";
const { requireManager, listExpenses } = vi.hoisted(() => ({ requireManager: vi.fn(), listExpenses: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireManager })); vi.mock("@/lib/expenses/service", () => ({ listExpenses, createExpense: vi.fn() }));
import { GET } from "./route";
describe("GET /api/expenses", () => {
  beforeEach(() => { vi.clearAllMocks(); requireManager.mockResolvedValue({ user: { id: "actor" } }); listExpenses.mockResolvedValue({ items: [] }); });
  it("authorizes before parsing filters", async () => { const response = await GET(new Request("http://localhost/api/expenses?page=invalid")); expect(response.status).toBe(400); expect(requireManager).toHaveBeenCalledOnce(); expect(listExpenses).not.toHaveBeenCalled(); });
});
