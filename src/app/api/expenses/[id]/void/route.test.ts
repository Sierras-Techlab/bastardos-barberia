import { beforeEach, describe, expect, it, vi } from "vitest";
const { requireManager, voidExpense } = vi.hoisted(() => ({ requireManager: vi.fn(), voidExpense: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/expenses/service", () => ({ voidExpense }));
import { POST } from "./route";
const id = "10000000-0000-4000-8000-000000000001";
describe("POST /api/expenses/[id]/void", () => {
  beforeEach(() => { vi.clearAllMocks(); requireManager.mockResolvedValue({ user: { id: "actor" } }); voidExpense.mockResolvedValue({ id, status: "voided" }); });
  it("requires and forwards expectedUpdatedAt", async () => { const missing = await POST(new Request(`http://localhost/api/expenses/${id}/void`, { method: "POST", body: JSON.stringify({ reason: "duplicado" }) }), { params: Promise.resolve({ id }) }); expect(missing.status).toBe(400); expect(voidExpense).not.toHaveBeenCalled(); const input = { expectedUpdatedAt: "2026-08-23T12:00:00Z", reason: "duplicado" }; const response = await POST(new Request(`http://localhost/api/expenses/${id}/void`, { method: "POST", body: JSON.stringify(input) }), { params: Promise.resolve({ id }) }); expect(response.status).toBe(200); expect(voidExpense).toHaveBeenCalledWith({ id: "actor" }, id, input); });
});
