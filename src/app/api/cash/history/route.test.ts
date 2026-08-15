import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireManager, listCashHistory } = vi.hoisted(() => ({
  requireManager: vi.fn(),
  listCashHistory: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/cash/service", () => ({ listCashHistory }));

import { GET } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000001" };

describe("GET /api/cash/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireManager.mockResolvedValue({ user: actor });
    listCashHistory.mockResolvedValue({ items: [] });
  });

  it("authorizes first and parses history filters with stable defaults", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/cash/history?dateFrom=2026-08-01&dateTo=2026-08-14",
      ),
    );

    expect(response.status).toBe(200);
    expect(requireManager.mock.invocationCallOrder[0]).toBeLessThan(
      listCashHistory.mock.invocationCallOrder[0],
    );
    expect(listCashHistory).toHaveBeenCalledWith(actor, {
      dateFrom: "2026-08-01",
      dateTo: "2026-08-14",
      page: 1,
      pageSize: 10,
    });
  });
});
