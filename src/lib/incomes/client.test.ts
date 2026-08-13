import { beforeEach, expect, it, vi } from "vitest";
import { incomeClient } from "@/lib/incomes/client";
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });
it("creates, lists, gets and voids incomes without caching", async () => {
  fetchMock.mockImplementation(async () => Response.json({ data: {} }));
  const input = { requestId: "40000000-0000-4000-8000-000000000001", employeeId: "00000000-0000-4000-8000-000000000003", customerId: null, serviceId: "30000000-0000-4000-8000-000000000001", products: [], payments: [{ method: "cash" as const, amount: 13000 }], grantFullServiceCommission: false };
  await incomeClient.create(input); await incomeClient.list({ page: 1, pageSize: 10, dateFrom: "2026-08-01" }); await incomeClient.get("20000000-0000-4000-8000-000000000001"); await incomeClient.void("20000000-0000-4000-8000-000000000001");
  expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/incomes", expect.objectContaining({ method: "POST", cache: "no-store" }));
  expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/incomes?page=1&pageSize=10&dateFrom=2026-08-01", { cache: "no-store" });
  expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/incomes/20000000-0000-4000-8000-000000000001/void", { method: "POST", cache: "no-store" });
});
