import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireManager, closeCash } = vi.hoisted(() => ({
  requireManager: vi.fn(),
  closeCash: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/cash/service", () => ({ closeCash }));

import { POST } from "./route";

const manager = { id: "00000000-0000-4000-8000-000000000001", role: { id: 1, name: "owner" } };

beforeEach(() => {
  vi.clearAllMocks();
  requireManager.mockResolvedValue({ user: manager });
  closeCash.mockResolvedValue({ id: "cash-1" });
});

describe("POST /api/cash/close", () => {
  it("forwards counted cash to the service after manager authorization", async () => {
    const response = await POST(new Request("http://localhost/api/cash/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countedCash: 17500 }),
    }));
    expect(response.status).toBe(200);
    expect(closeCash).toHaveBeenCalledWith(manager, { countedCash: 17500 });
  });

  it("rejects negative counted cash", async () => {
    const response = await POST(new Request("http://localhost/api/cash/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countedCash: -1 }),
    }));
    expect(response.status).toBe(400);
  });
});