import { describe, expect, it, vi } from "vitest";

import type { SafeUser } from "@/lib/auth/types";
import type { FixedCustomerPaymentsDependencies } from "@/lib/fixed-customer-payments/contracts";
import {
  employeeFixedCustomerMonthSchema,
  fixedCustomerMonthQuerySchema,
  managerFixedCustomerMonthSchema,
  payFixedCustomerMonthSchema,
} from "@/lib/fixed-customer-payments/schemas";
import { getFixedCustomerMonth, listFixedCustomerMonths, payFixedCustomerMonth } from "@/lib/fixed-customer-payments/service";
import type { FixedCustomerMonth, PayFixedCustomerMonthInput } from "@/types/fixed-customer-payment";

const owner: SafeUser = { id: "00000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "García", username: "ana.garcia", role: { id: 1, name: "owner" }, isActive: true, serviceCommissionRate: 0, productCommissionRate: 0, lastLoginAt: null, createdAt: "2026-08-07T00:00:00.000Z", updatedAt: "2026-08-07T00:00:00.000Z" };
const employee: SafeUser = { ...owner, id: "00000000-0000-4000-8000-000000000003", username: "fer.perez", role: { id: 3, name: "employee" } };
const otherEmployee: SafeUser = { ...employee, id: "00000000-0000-4000-8000-000000000004", username: "lu.perez", firstName: "Lu", lastName: "Pérez" };

const pendingManagerMonth: FixedCustomerMonth = {
  viewer: "manager",
  customer: { id: "10000000-0000-4000-8000-000000000001", firstName: "Juan", lastName: "Cruz" },
  responsibleProfessional: { id: employee.id, firstName: "Fer", lastName: "Pérez" },
  period: "2026-08",
  status: "pending",
  paidAt: null,
  incomeId: null,
  employeeEarning: 0,
  monthlyPrice: 15000,
};

const paidEmployeeMonth: FixedCustomerMonth = {
  viewer: "employee",
  customer: { id: "10000000-0000-4000-8000-000000000001", firstName: "Juan", lastName: "Cruz" },
  responsibleProfessional: { id: employee.id, firstName: "Fer", lastName: "Pérez" },
  period: "2026-08",
  status: "paid",
  paidAt: "2026-08-15T13:00:00.000Z",
  incomeId: "20000000-0000-4000-8000-000000000001",
  employeeEarning: 4500,
};

const deps = (): FixedCustomerPaymentsDependencies => ({
  payments: {
    list: vi.fn().mockResolvedValue([pendingManagerMonth, paidEmployeeMonth]),
    pay: vi.fn().mockResolvedValue(paidEmployeeMonth),
    get: vi.fn().mockResolvedValue(pendingManagerMonth),
  },
});

describe("fixed customer payment schemas", () => {
  it("accepts a strict YYYY-MM period in queries and payment submissions", () => {
    expect(fixedCustomerMonthQuerySchema.parse({ period: "2026-08" })).toEqual({ period: "2026-08" });
    expect(fixedCustomerMonthQuerySchema.safeParse({ period: "2026-8" }).success).toBe(false);
    expect(fixedCustomerMonthQuerySchema.safeParse({ period: "2026-13" }).success).toBe(false);
  });

  it("requires positive distinct integer amounts for manager payments and basis points summing to 10000 for employees", () => {
    const managerRequest: PayFixedCustomerMonthInput = {
      requestId: "00000000-0000-4000-8000-0000000000aa",
      customerId: "10000000-0000-4000-8000-000000000001",
      period: "2026-08",
      payments: [
        { paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 15000 },
      ],
    };
    expect(payFixedCustomerMonthSchema.safeParse({ mode: "manager", ...managerRequest }).success).toBe(true);
    expect(payFixedCustomerMonthSchema.safeParse({
      mode: "manager",
      ...managerRequest,
      payments: [
        { paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 15000 },
        { paymentMethodId: "00000000-0000-4000-8000-0000000000a1", amount: 0 },
      ],
    }).success).toBe(false);

    const employeeRequest: PayFixedCustomerMonthInput = {
      requestId: "00000000-0000-4000-8000-0000000000aa",
      customerId: "10000000-0000-4000-8000-000000000001",
      period: "2026-08",
      payments: [
        { paymentMethodId: "00000000-0000-4000-8000-0000000000a1", basisPoints: 10000 },
      ],
    };
    expect(payFixedCustomerMonthSchema.safeParse({ mode: "employee", ...employeeRequest }).success).toBe(true);
    expect(payFixedCustomerMonthSchema.safeParse({
      mode: "employee",
      ...employeeRequest,
      payments: [
        { paymentMethodId: "00000000-0000-4000-8000-0000000000a1", basisPoints: 9999 },
      ],
    }).success).toBe(false);
  });

  it("never exposes monthlyPrice to employee viewers", () => {
    expect(employeeFixedCustomerMonthSchema.safeParse({ ...paidEmployeeMonth, monthlyPrice: 15000 }).success).toBe(false);
    expect(employeeFixedCustomerMonthSchema.safeParse(paidEmployeeMonth).success).toBe(true);
  });

  it("requires monthlyPrice on manager viewer projections", () => {
    expect(managerFixedCustomerMonthSchema.safeParse({ ...pendingManagerMonth, monthlyPrice: 0 }).success).toBe(false);
    expect(managerFixedCustomerMonthSchema.safeParse(pendingManagerMonth).success).toBe(true);
  });
});

describe("fixed customer payment service", () => {
  it("lists pending and paid months for managers without employee scoping", async () => {
    const dependencies = deps();
    const result = await listFixedCustomerMonths(owner, { period: "2026-08" }, dependencies);
    expect(dependencies.payments.list).toHaveBeenCalledWith(owner.id, true, { period: "2026-08" });
    expect(result).toHaveLength(2);
  });

  it("rejects employees from filtering by another professional", async () => {
    const dependencies = deps();
    await expect(listFixedCustomerMonths(employee, { period: "2026-08", employeeId: otherEmployee.id }, dependencies))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(dependencies.payments.list).not.toHaveBeenCalled();
  });

  it("lets managers filter by any active professional", async () => {
    const dependencies = deps();
    await listFixedCustomerMonths(owner, { period: "2026-08", employeeId: otherEmployee.id }, dependencies);
    expect(dependencies.payments.list).toHaveBeenCalledWith(owner.id, true, { period: "2026-08", employeeId: otherEmployee.id });
  });

  it("delegates pay to the repository without inspecting the actor role", async () => {
    const dependencies = deps();
    const input: PayFixedCustomerMonthInput = {
      requestId: "00000000-0000-4000-8000-0000000000aa",
      customerId: "10000000-0000-4000-8000-000000000001",
      period: "2026-08",
      payments: [{ paymentMethodId: "00000000-0000-4000-8000-0000000000a1", basisPoints: 10000 }],
    };
    const result = await payFixedCustomerMonth(employee, input, dependencies);
    expect(dependencies.payments.pay).toHaveBeenCalledWith(employee.id, input);
    expect(result.viewer).toBe("employee");
  });

  it("returns a 404 when the requested month is missing", async () => {
    const dependencies = deps();
    vi.mocked(dependencies.payments.get).mockResolvedValueOnce(null);
    await expect(getFixedCustomerMonth(owner, pendingManagerMonth.customer.id, "2026-07", dependencies))
      .rejects.toMatchObject({ code: "FIXED_MONTH_NOT_FOUND", status: 404 });
  });
});