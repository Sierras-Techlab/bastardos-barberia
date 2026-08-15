import { beforeEach, expect, it, vi } from "vitest";

const { requireUser, listCustomerVisits } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  listCustomerVisits: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({ requireUser }));
vi.mock("@/lib/customers/service", () => ({ listCustomerVisits }));

import { GET } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000003" };
const customerId = "10000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ user: actor });
  listCustomerVisits.mockResolvedValue({
    items: [{
      id: "20000000-0000-4000-8000-000000000001",
      occurredAt: "2026-08-13T14:00:00.000Z",
      businessDate: "2026-08-13",
      totalSpent: 49000,
      items: [
        { type: "service", name: "Corte", quantity: 1, unitPrice: 19000, subtotal: 19000 },
        { type: "product", name: "Cera mate", quantity: 2, unitPrice: 15000, subtotal: 30000 },
      ],
    }],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  });
});

it("lists sanitized visits for every authenticated role", async () => {
  const response = await GET(
    new Request(`http://localhost/api/customers/${customerId}/visits?page=1&pageSize=20`),
    { params: Promise.resolve({ id: customerId }) },
  );
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    data: { items: [expect.objectContaining({ totalSpent: 49000 })] },
  });
  expect(listCustomerVisits).toHaveBeenCalledWith(actor, customerId, { page: 1, pageSize: 20 });
});

it("rejects invalid customer IDs", async () => {
  const response = await GET(
    new Request("http://localhost/api/customers/bad/visits"),
    { params: Promise.resolve({ id: "bad" }) },
  );
  expect(response.status).toBe(400);
  expect(listCustomerVisits).not.toHaveBeenCalled();
});
