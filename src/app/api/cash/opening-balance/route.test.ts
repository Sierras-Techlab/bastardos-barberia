import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireManager, setCashOpeningBalance } = vi.hoisted(() => ({
  requireManager: vi.fn(),
  setCashOpeningBalance: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/cash/service", () => ({ setCashOpeningBalance }));

import { POST } from "./route";

const manager = {
  id: "00000000-0000-4000-8000-000000000001",
  role: { id: 1, name: "owner" },
};

beforeEach(() => {
  vi.clearAllMocks();
  requireManager.mockResolvedValue({ user: manager });
  setCashOpeningBalance.mockResolvedValue({ id: "cash-1" });
});

describe("POST /api/cash/opening-balance", () => {
  it("authorizes and forwards a valid opening balance", async () => {
    const response = await POST(
      new Request("http://localhost/api/cash/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingBalance: 15000 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(setCashOpeningBalance).toHaveBeenCalledWith(manager, {
      openingBalance: 15000,
    });
  });

  it("rejects a negative opening balance", async () => {
    const response = await POST(
      new Request("http://localhost/api/cash/opening-balance", {
        method: "POST",
        body: JSON.stringify({ openingBalance: -1 }),
      }),
    );

    expect(response.status).toBe(400);
    expect(setCashOpeningBalance).not.toHaveBeenCalled();
  });
});
