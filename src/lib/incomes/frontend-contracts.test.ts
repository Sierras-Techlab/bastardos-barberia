import { expect, expectTypeOf, it } from "vitest";

import { createIncomeInputSchema } from "@/lib/incomes/frontend-contracts";
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
