import { expect, it, vi } from "vitest";
const { requireManager, voidIncome } = vi.hoisted(() => ({ requireManager: vi.fn().mockResolvedValue({ user: { id: "actor" } }), voidIncome: vi.fn().mockResolvedValue({ id: "income" }) }));
vi.mock("@/lib/auth/authorization", () => ({ requireManager })); vi.mock("@/lib/incomes/service", () => ({ voidIncome }));
import { POST } from "./route";
it("requires a manager and awaits params", async () => { const id = "20000000-0000-4000-8000-000000000001"; expect((await POST(new Request(`http://localhost/api/incomes/${id}/void`, { method: "POST" }), { params: Promise.resolve({ id }) })).status).toBe(200); expect(requireManager).toHaveBeenCalledOnce(); expect(voidIncome).toHaveBeenCalledWith({ id: "actor" }, id); });
