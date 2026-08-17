import { expect, it, vi } from "vitest";
const { requireUser, getIncome } = vi.hoisted(() => ({ requireUser: vi.fn().mockResolvedValue({ user: { id: "actor" } }), getIncome: vi.fn().mockResolvedValue({ id: "income" }) }));
vi.mock("@/lib/auth/authorization", () => ({ requireUser })); vi.mock("@/lib/incomes/service", () => ({ getIncome }));
import { GET } from "./route";
it("awaits detail params", async () => { const id = "20000000-0000-4000-8000-000000000001"; expect((await GET(new Request(`http://localhost/api/incomes/${id}`), { params: Promise.resolve({ id }) })).status).toBe(200); expect(getIncome).toHaveBeenCalledWith({ id: "actor" }, id); });
