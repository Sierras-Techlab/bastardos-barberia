import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireManager, updateService, deleteService } = vi.hoisted(() => ({
  requireManager: vi.fn(), updateService: vi.fn(), deleteService: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({ requireManager }));
vi.mock("@/lib/services/service", () => ({ updateService, deleteService }));

import { DELETE, PATCH } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000001" };
const id = "10000000-0000-4000-8000-000000000001";

describe("/api/services/:id", () => {
  beforeEach(() => { vi.clearAllMocks(); requireManager.mockResolvedValue({ user: actor }); });

  it("awaits params for manager update and deletion", async () => {
    updateService.mockResolvedValue({ id });
    deleteService.mockResolvedValue({ id });
    const context = { params: Promise.resolve({ id }) };
    expect((await PATCH(new Request(`http://localhost/api/services/${id}`, {
      method: "PATCH", body: JSON.stringify({ price: 14000 }),
    }), context)).status).toBe(200);
    expect((await DELETE(new Request(`http://localhost/api/services/${id}`), context)).status).toBe(200);
    expect(updateService).toHaveBeenCalledWith(actor, id, { price: 14000 });
    expect(deleteService).toHaveBeenCalledWith(actor, id);
  });
});
