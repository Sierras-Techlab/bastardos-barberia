import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, requireManager, listServices, createService } = vi.hoisted(() => ({
  requireUser: vi.fn(), requireManager: vi.fn(), listServices: vi.fn(), createService: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({ requireUser, requireManager }));
vi.mock("@/lib/services/service", () => ({ listServices, createService }));

import { GET, POST } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000001" };

describe("/api/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user: actor });
    requireManager.mockResolvedValue({ user: actor });
  });

  it("authorizes reads and manager creation", async () => {
    listServices.mockResolvedValue({ services: [] });
    createService.mockResolvedValue({ id: "service-id" });
    expect((await GET()).status).toBe(200);
    const response = await POST(new Request("http://localhost/api/services", {
      method: "POST", body: JSON.stringify({ name: "Barba", price: 13000 }),
    }));
    expect(listServices).toHaveBeenCalledWith(actor);
    expect(createService).toHaveBeenCalledWith(actor, { name: "Barba", price: 13000 });
    expect(response.status).toBe(201);
  });

  it("rejects malformed input", async () => {
    const response = await POST(new Request("http://localhost/api/services", {
      method: "POST", body: JSON.stringify({ name: "", price: 0 }),
    }));
    expect(response.status).toBe(400);
    expect(createService).not.toHaveBeenCalled();
  });
});
