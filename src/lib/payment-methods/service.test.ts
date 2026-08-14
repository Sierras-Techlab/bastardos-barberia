import { describe, expect, it, vi } from "vitest";

import type { SafeUser } from "@/lib/auth/types";
import type { PaymentMethodUpdate } from "@/types/payment-method";
import {
  createPaymentMethod,
  deactivatePaymentMethod,
  listPaymentMethods,
  updatePaymentMethod,
} from "@/lib/payment-methods/service";

const manager: SafeUser = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Ana",
  lastName: "García",
  username: "ana.garcia",
  role: { id: 1, name: "owner" },
  isActive: true,
  serviceCommissionRate: 0,
  productCommissionRate: 0,
  lastLoginAt: null,
  createdAt: "2026-08-14T00:00:00.000Z",
  updatedAt: "2026-08-14T00:00:00.000Z",
};
const employee: SafeUser = {
  ...manager,
  role: { id: 3, name: "employee" },
};
const method = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Efectivo",
  isActive: true,
};

const dependencies = () => ({
  methods: {
    list: vi.fn().mockResolvedValue([method]),
    findById: vi.fn().mockResolvedValue(method),
    create: vi.fn().mockResolvedValue(method),
    update: vi.fn().mockResolvedValue(method),
    deactivate: vi.fn().mockResolvedValue(method),
  },
});

describe("payment method domain", () => {
  it("includes inactive methods for every authenticated history consumer", async () => {
    const managerDeps = dependencies();
    const employeeDeps = dependencies();

    await expect(listPaymentMethods(manager, managerDeps)).resolves.toEqual({
      paymentMethods: [method],
    });
    await expect(listPaymentMethods(employee, employeeDeps)).resolves.toEqual({
      paymentMethods: [method],
    });

    expect(managerDeps.methods.list).toHaveBeenCalledWith(true);
    expect(employeeDeps.methods.list).toHaveBeenCalledWith(true);
  });

  it("rejects employee mutations before persistence", async () => {
    const deps = dependencies();

    await expect(createPaymentMethod(employee, { name: method.name }, deps))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(updatePaymentMethod(employee, method.id, { name: "Transferencia" }, deps))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(deactivatePaymentMethod(employee, method.id, deps))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    expect(deps.methods.create).not.toHaveBeenCalled();
    expect(deps.methods.update).not.toHaveBeenCalled();
    expect(deps.methods.deactivate).not.toHaveBeenCalled();
  });

  it("propagates the authenticated manager to every mutation", async () => {
    const deps = dependencies();

    await createPaymentMethod(manager, { name: method.name }, deps);
    await updatePaymentMethod(manager, method.id, { isActive: true }, deps);
    await deactivatePaymentMethod(manager, method.id, deps);

    expect(deps.methods.create).toHaveBeenCalledWith(manager.id, { name: method.name });
    expect(deps.methods.update).toHaveBeenCalledWith(manager.id, method.id, {
      isActive: true,
    });
    expect(deps.methods.deactivate).toHaveBeenCalledWith(manager.id, method.id);
  });

  it("requires the dedicated lifecycle operation for a false active flag", async () => {
    const deps = dependencies();

    await expect(
      updatePaymentMethod(
        manager,
        method.id,
        { isActive: false } as unknown as PaymentMethodUpdate,
        deps,
      ),
    ).rejects.toMatchObject({
      code: "PAYMENT_METHOD_DEACTIVATION_REQUIRED",
      status: 400,
    });

    expect(deps.methods.update).not.toHaveBeenCalled();
  });
});
