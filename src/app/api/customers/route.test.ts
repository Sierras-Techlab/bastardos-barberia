import { beforeEach, expect, it, vi } from "vitest";
const { requireUser, listCustomers, createCustomer } = vi.hoisted(() => ({ requireUser: vi.fn(), listCustomers: vi.fn(), createCustomer: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireUser }));
vi.mock("@/lib/customers/service", () => ({ listCustomers, createCustomer }));
import { GET, POST } from "./route";
const actor = { id: "00000000-0000-4000-8000-000000000001" };
beforeEach(() => { vi.clearAllMocks(); requireUser.mockResolvedValue({ user: actor }); });
it("allows authenticated listing and creation", async () => {
  listCustomers.mockResolvedValue({ customers: [] }); createCustomer.mockResolvedValue({ id: "customer-id" });
  expect((await GET()).status).toBe(200);
  const response = await POST(new Request("http://localhost/api/customers", { method: "POST", body: JSON.stringify({ firstName: "Ana", lastName: "Pérez", phone: "3515550101", email: "" }) }));
  expect(createCustomer).toHaveBeenCalledWith(actor, { firstName: "Ana", lastName: "Pérez", phone: "3515550101", email: null });
  expect(response.status).toBe(201);
});
