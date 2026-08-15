import { describe, expect, it, vi } from "vitest";

import type { SafeUser } from "@/lib/auth/types";
import {
  createPaymentMethod,
  deletePaymentMethod,
  getPaymentMethod,
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
    remove: vi.fn().mockResolvedValue(method.id),
  },
});

describe("payment method domain", () => {
  it("returns an inactive method to an authenticated history consumer", async () => {
    const deps = dependencies();
    const inactiveMethod = { ...method, isActive: false };
    deps.methods.findById.mockResolvedValue(inactiveMethod);

    await expect(getPaymentMethod(employee, method.id, deps)).resolves.toEqual(
      inactiveMethod,
    );

    expect(deps.methods.findById).toHaveBeenCalledWith(method.id);
  });

  it("returns a safe not-found error when the requested method is absent", async () => {
    const deps = dependencies();
    deps.methods.findById.mockResolvedValue(null);

    await expect(getPaymentMethod(manager, method.id, deps)).rejects.toMatchObject({
      code: "PAYMENT_METHOD_NOT_FOUND",
      status: 404,
    });
  });

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
    await expect(deletePaymentMethod(employee, method.id, deps))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    expect(deps.methods.create).not.toHaveBeenCalled();
    expect(deps.methods.update).not.toHaveBeenCalled();
    expect(deps.methods.remove).not.toHaveBeenCalled();
  });

  it("propagates the authenticated manager to every mutation", async () => {
    const deps = dependencies();

    await createPaymentMethod(manager, { name: method.name }, deps);
    await updatePaymentMethod(manager, method.id, { isActive: false }, deps);
    await expect(deletePaymentMethod(manager, method.id, deps)).resolves.toEqual({
      id: method.id,
    });

    expect(deps.methods.create).toHaveBeenCalledWith(manager.id, { name: method.name });
    expect(deps.methods.update).toHaveBeenCalledWith(manager.id, method.id, {
      isActive: false,
    });
    expect(deps.methods.remove).toHaveBeenCalledWith(manager.id, method.id);
  });

  it("returns a safe not-found error when deletion finds no method", async () => {
    const deps = dependencies();
    deps.methods.remove.mockResolvedValue(null);

    await expect(
      deletePaymentMethod(manager, method.id, deps),
    ).rejects.toMatchObject({
      code: "PAYMENT_METHOD_NOT_FOUND",
      status: 404,
    });

    expect(deps.methods.remove).toHaveBeenCalledWith(manager.id, method.id);
  });
});
