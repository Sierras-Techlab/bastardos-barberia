import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireManager, confirmCash } = vi.hoisted(() => ({
  requireManager: vi.fn(),
  confirmCash: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/cash/service", () => ({ confirmCash }));

import { POST } from "./route";

const manager = { id: "00000000-0000-4000-8000-000000000001", role: { id: 1, name: "owner" } };
const registerId = "00000000-0000-4000-8000-0000000000aa";

beforeEach(() => {
  vi.clearAllMocks();
  requireManager.mockResolvedValue({ user: manager });
  confirmCash.mockResolvedValue({ id: registerId });
});

describe("POST /api/cash/[id]/confirm", () => {
  it("awaits the dynamic id and forwards counted cash", async () => {
    const response = await POST(
      new Request(`http://localhost/api/cash/${registerId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedCash: 16500 }),
      }),
      { params: Promise.resolve({ id: registerId }) },
    );
    expect(response.status).toBe(200);
    expect(confirmCash).toHaveBeenCalledWith(manager, registerId, { countedCash: 16500 });
  });

  it("rejects an invalid register id", async () => {
    const response = await POST(
      new Request(`http://localhost/api/cash/not-a-uuid/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedCash: 0 }),
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    expect(response.status).toBe(400);
  });
});