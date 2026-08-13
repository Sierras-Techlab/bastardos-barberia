import { expect, it } from "vitest";

import { createIncomeV2InputSchema } from "@/lib/incomes/frontend-contracts";

const valid = {
  requestId: "00000000-0000-4000-8000-000000000001",
  employeeId: "00000000-0000-4000-8000-000000000002",
  customerId: null,
  serviceId: "00000000-0000-4000-8000-000000000003",
  products: [],
  payments: [{ method: "cash", amount: 19000 }],
  grantFullServiceCommission: false,
};

it("accepts the V2 browser payload", () => {
  expect(createIncomeV2InputSchema.parse(valid)).toEqual(valid);
});

it("rejects authoritative and malformed browser fields", () => {
  expect(() => createIncomeV2InputSchema.parse({ ...valid, total: 19000 })).toThrow();
  expect(() => createIncomeV2InputSchema.parse({ ...valid, payments: [{ method: "cash", amount: 0 }] })).toThrow();
  expect(() => createIncomeV2InputSchema.parse({ ...valid, serviceCommissionRate: 45 })).toThrow();
  expect(() => createIncomeV2InputSchema.parse({
    ...valid,
    payments: [
      { method: "cash", amount: 9000 },
      { method: "cash", amount: 10000 },
    ],
  })).toThrow();
});
