import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireUser,
  requireManager,
  getPaymentMethod,
  updatePaymentMethod,
  deactivatePaymentMethod,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireManager: vi.fn(),
  getPaymentMethod: vi.fn(),
  updatePaymentMethod: vi.fn(),
  deactivatePaymentMethod: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({ requireUser, requireManager }));
vi.mock("@/lib/payment-methods/service", () => ({
  getPaymentMethod,
  updatePaymentMethod,
  deactivatePaymentMethod,
}));

import { AppError, unauthenticatedError } from "@/lib/auth/errors";

import { DELETE, GET, PATCH } from "./route";

const actor = { id: "00000000-0000-4000-8000-000000000001" };
const id = "10000000-0000-4000-8000-000000000001";
const method = { id, name: "Efectivo", isActive: true };
const context = { params: Promise.resolve({ id }) };

describe("/api/payment-methods/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ user: actor });
    requireManager.mockResolvedValue({ user: actor });
  });

  it("awaits params and gets an active or inactive method for an authenticated user", async () => {
    getPaymentMethod.mockResolvedValue({ ...method, isActive: false });

    const response = await GET(
      new Request(`http://localhost/api/payment-methods/${id}`),
      context,
    );

    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(requireManager).not.toHaveBeenCalled();
    expect(getPaymentMethod).toHaveBeenCalledWith(actor, id);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { ...method, isActive: false },
    });
  });

  it("authorizes reads before resolving and validating route params", async () => {
    requireUser.mockRejectedValue(unauthenticatedError());

    const response = await GET(
      new Request("http://localhost/api/payment-methods/not-a-uuid"),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    expect(getPaymentMethod).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  it("returns the safe 404 when the payment method does not exist", async () => {
    getPaymentMethod.mockRejectedValue(
      new AppError(
        "PAYMENT_METHOD_NOT_FOUND",
        "No encontramos el medio de pago.",
        404,
      ),
    );

    const response = await GET(
      new Request(`http://localhost/api/payment-methods/${id}`),
      context,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "PAYMENT_METHOD_NOT_FOUND",
        message: "No encontramos el medio de pago.",
      },
    });
  });

  it("requires a manager to rename or reactivate a method", async () => {
    updatePaymentMethod
      .mockResolvedValueOnce({ ...method, name: "Transferencia" })
      .mockResolvedValueOnce({ ...method, isActive: true });

    const renamed = await PATCH(
      new Request(`http://localhost/api/payment-methods/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Transferencia" }),
      }),
      context,
    );
    const reactivated = await PATCH(
      new Request(`http://localhost/api/payment-methods/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      }),
      context,
    );

    expect(requireManager).toHaveBeenCalledTimes(2);
    expect(requireUser).not.toHaveBeenCalled();
    expect(updatePaymentMethod).toHaveBeenNthCalledWith(1, actor, id, {
      name: "Transferencia",
    });
    expect(updatePaymentMethod).toHaveBeenNthCalledWith(2, actor, id, {
      isActive: true,
    });
    expect(renamed.status).toBe(200);
    expect(reactivated.status).toBe(200);
  });

  it("requires manager authorization before validating mutation params or body", async () => {
    requireManager.mockRejectedValue(unauthenticatedError());

    const patch = await PATCH(
      new Request("http://localhost/api/payment-methods/not-a-uuid", {
        method: "PATCH",
        body: "not-json",
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    const deletion = await DELETE(
      new Request("http://localhost/api/payment-methods/not-a-uuid", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    expect(updatePaymentMethod).not.toHaveBeenCalled();
    expect(deactivatePaymentMethod).not.toHaveBeenCalled();
    expect(patch.status).toBe(401);
    expect(deletion.status).toBe(401);
  });

  it("rejects malformed IDs and direct deactivation patches", async () => {
    const invalidId = await GET(
      new Request("http://localhost/api/payment-methods/not-a-uuid"),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    const invalidUpdate = await PATCH(
      new Request(`http://localhost/api/payment-methods/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      }),
      context,
    );

    expect(getPaymentMethod).not.toHaveBeenCalled();
    expect(updatePaymentMethod).not.toHaveBeenCalled();
    expect(invalidId.status).toBe(400);
    expect(invalidUpdate.status).toBe(400);
  });

  it("deactivates through the dedicated service and propagates conflicts", async () => {
    deactivatePaymentMethod.mockRejectedValue(
      new AppError(
        "LAST_ACTIVE_PAYMENT_METHOD",
        "Debe permanecer al menos un medio de pago activo.",
        409,
      ),
    );

    const response = await DELETE(
      new Request(`http://localhost/api/payment-methods/${id}`, {
        method: "DELETE",
      }),
      context,
    );

    expect(requireManager).toHaveBeenCalledTimes(1);
    expect(requireUser).not.toHaveBeenCalled();
    expect(deactivatePaymentMethod).toHaveBeenCalledWith(actor, id);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "LAST_ACTIVE_PAYMENT_METHOD",
        message: "Debe permanecer al menos un medio de pago activo.",
      },
    });
  });
});
