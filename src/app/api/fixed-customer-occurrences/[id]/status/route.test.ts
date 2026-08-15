import { beforeEach, expect, it, vi } from "vitest";
const { requireUser, resolveFixedOccurrence } = vi.hoisted(() => ({ requireUser: vi.fn(), resolveFixedOccurrence: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireUser }));
vi.mock("@/lib/fixed-customers/service", () => ({ resolveFixedOccurrence }));
import { PATCH } from "./route";
const actor = { id: "00000000-0000-4000-8000-000000000003" };
const id = "30000000-0000-4000-8000-000000000001";
beforeEach(() => { vi.clearAllMocks(); requireUser.mockResolvedValue({ user: actor }); resolveFixedOccurrence.mockResolvedValue({ id, status: "attended" }); });

it("accepts only a pending-to-final status transition", async () => {
  const response = await PATCH(new Request(`http://localhost/api/fixed-customer-occurrences/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "attended", expectedStatus: "pending" }) }), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect(resolveFixedOccurrence).toHaveBeenCalledWith(actor, id, { status: "attended", expectedStatus: "pending" });
});
