import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceApiError, serviceClient } from "@/lib/services/client";

const service = { id: "10000000-0000-4000-8000-000000000001", name: "Barba", price: 13000, isActive: true };

describe("service API client", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });

  it("uses JSON create/update requests and the delete endpoint", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ data: service }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ data: { ...service, price: 14000 } }))
      .mockResolvedValueOnce(Response.json({ data: { id: service.id } }));

    await serviceClient.create({ name: "Barba", price: 13000 });
    await serviceClient.update(service.id, { price: 14000 });
    await serviceClient.remove(service.id);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/services", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, `/api/services/${service.id}`, expect.objectContaining({ method: "PATCH" }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, `/api/services/${service.id}`, { method: "DELETE" });
  });

  it("preserves structured server errors", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: { code: "SERVICE_NAME_EXISTS", message: "Duplicado" } }, { status: 409 }));
    await expect(serviceClient.create({ name: "Barba", price: 13000 }))
      .rejects.toEqual(expect.objectContaining({ name: "ServiceApiError", code: "SERVICE_NAME_EXISTS", status: 409 }));
    expect(ServiceApiError.prototype).toBeInstanceOf(Error);
  });
});
