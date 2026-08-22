import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createIncomeInputSchema,
  employeeIncomeResponseSchema,
  managerIncomeResponseSchema,
} from "@/lib/incomes/frontend-contracts";
import type { IncomeCommissionSnapshot } from "@/types/income-commissions";
import type { Employee, IncomeListItem, IncomeListMetrics } from "@/types/income";
import type { IncomePayment } from "@/types/payment-method";

const valid = {
  requestId: "00000000-0000-4000-8000-000000000001",
  employeeId: "00000000-0000-4000-8000-000000000002",
  customerId: null,
  serviceId: "00000000-0000-4000-8000-000000000003",
  products: [],
  payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 19000 }],
  grantFullServiceCommission: false,
};

it("accepts the canonical browser payload", () => {
  expect(createIncomeInputSchema.parse(valid)).toEqual(valid);
});

it("rejects authoritative and malformed browser fields", () => {
  expect(() => createIncomeInputSchema.parse({ ...valid, total: 19000 })).toThrow();
  expect(() => createIncomeInputSchema.parse({ ...valid, payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 0 }] })).toThrow();
  expect(() => createIncomeInputSchema.parse({ ...valid, serviceCommissionRate: 45 })).toThrow();
  expect(() => createIncomeInputSchema.parse({
    ...valid,
    payments: [
      { paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 9000 },
      { paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 10000 },
    ],
  })).toThrow();
  expect(() => createIncomeInputSchema.parse({
    ...valid,
    products: [{ productId: "00000000-0000-4000-8000-000000000010", quantity: 2, grantFullCommission: true, rate: 100 }],
  })).toThrow();
});

it("keeps the persisted response type aligned with the strict parser", () => {
  expectTypeOf<IncomeListItem["payments"]>().toEqualTypeOf<IncomePayment[]>();
  expectTypeOf<IncomeListItem["registeredBy"]>().toEqualTypeOf<Employee>();
  expectTypeOf<IncomeListItem["commission"]>().toEqualTypeOf<IncomeCommissionSnapshot>();
  expectTypeOf<IncomeListMetrics["grossTotal"]>().toEqualTypeOf<number>();
  expectTypeOf<IncomeListMetrics["commissionTotal"]>().toEqualTypeOf<number>();
  expectTypeOf<IncomeListMetrics["barbershopNet"]>().toEqualTypeOf<number>();
  expectTypeOf<IncomeListMetrics["paymentTotals"]>().toEqualTypeOf<Array<{ paymentMethodId: string; name: string; amount: number }>>();
});

const employeeConcept = (overrides: Record<string, unknown> = {}) => ({
  id: "10000000-0000-4000-8000-000000000001",
  type: "service",
  name: "Corte",
  quantity: 1,
  earning: 9000,
  ...overrides,
});

const employeeBase = {
  id: "20000000-0000-4000-8000-000000000001",
  createdAt: "2026-08-22T12:00:00.000Z",
  businessDate: "2026-08-22",
  customer: { id: "30000000-0000-4000-8000-000000000001", firstName: "Juan", lastName: "Pérez" },
  concepts: [employeeConcept()],
  employeeCommission: 9000,
  status: "active" as const,
};

describe("employeeIncomeResponseSchema", () => {
  it("accepts sanitized employee projections", () => {
    expect(employeeIncomeResponseSchema.safeParse(employeeBase).success).toBe(true);
  });

  it.each([
    { price: 1000 },
    { unitPrice: 1000 },
    { total: 19000 },
    { payments: [{ paymentMethodId: "x", methodName: "Efectivo", amount: 19000 }] },
    { barbershopNet: 1000 },
    { discount: 1000 },
    { surcharge: 1000 },
    { registeredBy: { id: "u", firstName: "Ana", lastName: "García" } },
  ])("rejects sensitive key %o in the employee projection", (sensitive) => {
    expect(employeeIncomeResponseSchema.safeParse({ ...employeeBase, ...sensitive }).success).toBe(false);
  });

  it("rejects concepts that expose price, subtotal or payment fields", () => {
    expect(employeeIncomeResponseSchema.safeParse({
      ...employeeBase,
      concepts: [{ ...employeeBase.concepts[0], price: 1000 }],
    }).success).toBe(false);
    expect(employeeIncomeResponseSchema.safeParse({
      ...employeeBase,
      concepts: [{ ...employeeBase.concepts[0], subtotal: 1000 }],
    }).success).toBe(false);
  });
});

describe("managerIncomeResponseSchema", () => {
  const managerItem = {
    id: "20000000-0000-4000-8000-000000000001",
    createdAt: "2026-08-22T12:00:00.000Z",
    businessDate: "2026-08-22",
    customer: { id: "30000000-0000-4000-8000-000000000001", firstName: "Juan", lastName: "Pérez" },
    employee: { id: "40000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "García" },
    registeredBy: { id: "40000000-0000-4000-8000-000000000001", firstName: "Ana", lastName: "García" },
    service: {
      id: "50000000-0000-4000-8000-000000000001",
      name: "Corte",
      catalogUnitPrice: 20000,
      chargedUnitPrice: 20000,
      catalogSubtotal: 20000,
      chargedSubtotal: 20000,
      adjustmentAmount: 0,
      commission: {
        subtotal: 20000,
        catalogSubtotal: 20000,
        chargedSubtotal: 20000,
        adjustmentAmount: 0,
        rate: 45,
        amount: 9000,
        fullCommission: false,
        authorizedBy: null,
      },
    },
    products: [],
    payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", methodName: "Efectivo", amount: 20000 }],
    commission: { total: 9000, barbershopNet: 11000 },
    total: 20000,
    status: "active" as const,
  };

  it("accepts the manager shape with charged-price snapshots", () => {
    expect(managerIncomeResponseSchema.safeParse(managerItem).success).toBe(true);
  });
});
