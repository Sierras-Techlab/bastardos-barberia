import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireManager, openCash } = vi.hoisted(() => ({
  requireManager: vi.fn(),
  openCash: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/cash/service", () => ({ openCash }));

import { POST } from "./route";

const manager = { id: "00000000-0000-4000-8000-000000000001", role: { id: 1, name: "owner" } };

beforeEach(() => {
  vi.clearAllMocks();
  requireManager.mockResolvedValue({ user: manager });
  openCash.mockResolvedValue({ id: "cash-1" });
});

describe("POST /api/cash/open", () => {
  it("authorizes the manager before parsing the body", async () => {
    const callOrder: string[] = [];
    requireManager.mockImplementationOnce(async () => { callOrder.push("auth"); return { user: manager }; });
    openCash.mockImplementationOnce(async () => { callOrder.push("service"); return { id: "cash-1" }; });
    const response = await POST(new Request("http://localhost/api/cash/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingBalance: 10000 }),
    }));
    expect(response.status).toBe(201);
    expect(callOrder).toEqual(["auth", "service"]);
  });

  it("rejects a negative opening balance with a 400 response", async () => {
    const response = await POST(new Request("http://localhost/api/cash/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingBalance: -100 }),
    }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("forwards the validated opening balance to the service", async () => {
    await POST(new Request("http://localhost/api/cash/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingBalance: 0 }),
    }));
    expect(openCash).toHaveBeenCalledWith(manager, { openingBalance: 0 });
  });
});