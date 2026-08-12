import { beforeEach, expect, it, vi } from "vitest";
const { requireUser, requireManager, updateCustomer, deleteCustomer } = vi.hoisted(() => ({ requireUser: vi.fn(), requireManager: vi.fn(), updateCustomer: vi.fn(), deleteCustomer: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireUser, requireManager }));
vi.mock("@/lib/customers/service", () => ({ updateCustomer, deleteCustomer }));
import { DELETE, PATCH } from "./route";
const actor = { id: "00000000-0000-4000-8000-000000000001" }; const id = "10000000-0000-4000-8000-000000000001";
beforeEach(() => { vi.clearAllMocks(); requireUser.mockResolvedValue({ user: actor }); requireManager.mockResolvedValue({ user: actor }); });
it("allows any user to edit but requires a manager to delete", async () => {
  updateCustomer.mockResolvedValue({ id }); deleteCustomer.mockResolvedValue({ id }); const context = { params: Promise.resolve({ id }) };
  expect((await PATCH(new Request(`http://localhost/api/customers/${id}`, { method: "PATCH", body: JSON.stringify({ firstName: "Anita" }) }), context)).status).toBe(200);
  expect((await DELETE(new Request(`http://localhost/api/customers/${id}`), context)).status).toBe(200);
  expect(requireUser).toHaveBeenCalledOnce(); expect(requireManager).toHaveBeenCalledOnce();
});
