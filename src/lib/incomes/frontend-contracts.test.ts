import { expect, it } from "vitest";

import { createIncomeInputSchema } from "@/lib/incomes/frontend-contracts";

const valid = {
  requestId: "00000000-0000-4000-8000-000000000001",
  employeeId: "00000000-0000-4000-8000-000000000002",
  customerId: null,
  serviceId: "00000000-0000-4000-8000-000000000003",
  products: [],
  payments: [{ method: "cash", amount: 19000 }],
  grantFullServiceCommission: false,
};

it("accepts the canonical browser payload", () => {
  expect(createIncomeInputSchema.parse(valid)).toEqual(valid);
});

it("rejects authoritative and malformed browser fields", () => {
  expect(() => createIncomeInputSchema.parse({ ...valid, total: 19000 })).toThrow();
  expect(() => createIncomeInputSchema.parse({ ...valid, payments: [{ method: "cash", amount: 0 }] })).toThrow();
  expect(() => createIncomeInputSchema.parse({ ...valid, serviceCommissionRate: 45 })).toThrow();
  expect(() => createIncomeInputSchema.parse({
    ...valid,
    payments: [
      { method: "cash", amount: 9000 },
      { method: "cash", amount: 10000 },
    ],
  })).toThrow();
  expect(() => createIncomeInputSchema.parse({
    ...valid,
    products: [{ productId: "00000000-0000-4000-8000-000000000010", quantity: 2, grantFullCommission: true, rate: 100 }],
  })).toThrow();
});
