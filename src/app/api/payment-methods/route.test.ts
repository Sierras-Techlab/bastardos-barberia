import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireUser,
  requireManager,
  listPaymentMethods,
  createPaymentMethod,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  listPaymentMethods: vi.fn(),
  createPaymentMethod: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireUser, requireManager }));
vi.mock("@/lib/payment-methods/service", () => ({
  listPaymentMethods,
  createPaymentMethod,
}));

import { unauthenticatedError } from "@/lib/auth/errors";

import { GET, POST } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000001" };
const method = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Efectivo",
  isActive: true,
};

describe("/api/payment-methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user: actor });
    requireManager.mockResolvedValue({ user: actor });
  });

  it("lists active and inactive payment methods for an authenticated user", async () => {
    listPaymentMethods.mockResolvedValue({
      paymentMethods: [method, { ...method, id: "20000000-0000-4000-8000-000000000001", isActive: false }],
    });

    const response = await GET();

    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(requireManager).not.toHaveBeenCalled();
    expect(listPaymentMethods).toHaveBeenCalledWith(actor);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        paymentMethods: [
          method,
          { ...method, id: "20000000-0000-4000-8000-000000000001", isActive: false },
        ],
      },
    });
  });

  it("authorizes a manager before parsing payment-method creation input", async () => {
    requireManager.mockRejectedValue(unauthenticatedError());

    const response = await POST(
      new Request("http://localhost/api/payment-methods", {
        method: "POST",
        body: "not-json",
      }),
    );

    expect(createPaymentMethod).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  it("creates a strictly valid payment method as a manager", async () => {
    createPaymentMethod.mockResolvedValue(method);

    const response = await POST(
      new Request("http://localhost/api/payment-methods", {
        method: "POST",
        body: JSON.stringify({ name: "  Efectivo  " }),
      }),
    );

    expect(requireManager).toHaveBeenCalledTimes(1);
    expect(requireUser).not.toHaveBeenCalled();
    expect(createPaymentMethod).toHaveBeenCalledWith(actor, { name: "Efectivo" });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ data: method });
  });

  it("rejects unknown creation fields without reaching the service", async () => {
    const response = await POST(
      new Request("http://localhost/api/payment-methods", {
        method: "POST",
        body: JSON.stringify({ name: method.name, isActive: true }),
      }),
    );

    expect(createPaymentMethod).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
  });
});
