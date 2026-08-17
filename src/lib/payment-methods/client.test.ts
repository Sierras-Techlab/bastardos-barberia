import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PaymentMethodApiError,
  paymentMethodClient,
} from "@/lib/payment-methods/client";

const method = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Efectivo",
  isActive: true,
};

describe("payment method API client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("remains browser-safe while using payment-method API routes", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ data: { paymentMethods: [method] } }))
      .mockResolvedValueOnce(Response.json({ data: method }))
      .mockResolvedValueOnce(Response.json({ data: method }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ data: method }))
      .mockResolvedValueOnce(Response.json({ data: { ...method, isActive: false } }))
      .mockResolvedValueOnce(Response.json({ data: { id: method.id } }));

    await expect(paymentMethodClient.list()).resolves.toEqual([method]);
    await expect(paymentMethodClient.get(method.id)).resolves.toEqual(method);
    await paymentMethodClient.create({ name: method.name });
    await paymentMethodClient.update(method.id, { name: "Transferencia" });
    await paymentMethodClient.deactivate(method.id);
    await paymentMethodClient.remove(method.id);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/payment-methods", undefined);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/payment-methods/${method.id}`,
      undefined,
    );
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: method.name }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      `/api/payment-methods/${method.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Transferencia" }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      `/api/payment-methods/${method.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      `/api/payment-methods/${method.id}`,
      { method: "DELETE" },
    );
  });

  it("preserves structured server errors", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          error: {
            code: "LAST_ACTIVE_PAYMENT_METHOD",
            message: "Debe quedar al menos un medio de pago activo.",
          },
        },
        { status: 409 },
      ),
    );

    await expect(paymentMethodClient.deactivate(method.id)).rejects.toEqual(
      expect.objectContaining({
        name: "PaymentMethodApiError",
        status: 409,
        code: "LAST_ACTIVE_PAYMENT_METHOD",
      }),
    );
    expect(PaymentMethodApiError.prototype).toBeInstanceOf(Error);
  });
});
