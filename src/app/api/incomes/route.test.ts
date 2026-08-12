import { beforeEach, expect, it, vi } from "vitest";
const { requireUser, listIncomes, createIncome } = vi.hoisted(() => ({ requireUser: vi.fn(), listIncomes: vi.fn(), createIncome: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireUser })); vi.mock("@/lib/incomes/service", () => ({ listIncomes, createIncome }));
import { GET, POST } from "./route";
const actor = { id: "00000000-0000-4000-8000-000000000001" };
beforeEach(() => { vi.clearAllMocks(); requireUser.mockResolvedValue({ user: actor }); });
it("parses list query and public create body", async () => {
  listIncomes.mockResolvedValue({ items: [] }); createIncome.mockResolvedValue({ id: "id" });
  await GET(new Request("http://localhost/api/incomes?page=2&pageSize=10&paymentMethod=cash"));
  expect(listIncomes).toHaveBeenCalledWith(actor, { page: 2, pageSize: 10, paymentMethod: "cash" });
  const input = { requestId: "40000000-0000-4000-8000-000000000001", customerId: null, serviceId: "30000000-0000-4000-8000-000000000001", products: [], paymentMethod: "cash" };
  expect((await POST(new Request("http://localhost/api/incomes", { method: "POST", body: JSON.stringify(input) }))).status).toBe(201);
  expect(createIncome).toHaveBeenCalledWith(actor, input);
});
