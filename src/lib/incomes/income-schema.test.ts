import { describe, expect, it } from "vitest";

import { createIncomeSchema, incomeFormSchema } from "./income-schema";

const validBase = {
  employeeId: "00000000-0000-4000-8000-000000000001",
  customerId: null,
  serviceId: "service-1",
  products: [],
  paymentMode: "cash" as const,
  payments: [{ method: "cash" as const, amount: 16000 }],
  grantFullServiceCommission: false,
};

describe("incomeFormSchema", () => {
  it("accepts a service without products and an optional customer", () => {
    expect(incomeFormSchema.safeParse(validBase).success).toBe(true);
  });

  it("accepts products without a service", () => {
    const result = incomeFormSchema.safeParse({
      ...validBase,
      serviceId: null,
      products: [{ productId: "product-1", quantity: 2, grantFullCommission: false }],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty entry", () => {
    const result = incomeFormSchema.safeParse({
      ...validBase,
      serviceId: null,
      products: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a product quantity below one", () => {
    const result = incomeFormSchema.safeParse({
      ...validBase,
      serviceId: null,
      products: [{ productId: "product-1", quantity: 0, grantFullCommission: false }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing payment method", () => {
    const result = incomeFormSchema.safeParse({
      ...validBase,
      paymentMode: null,
    });

    expect(result.success).toBe(false);
  });
});

const publicInput = {
  requestId: "00000000-0000-4000-8000-000000000010",
  employeeId: "00000000-0000-4000-8000-000000000001",
  customerId: null,
  serviceId: "00000000-0000-4000-8000-000000000020",
  products: [],
  payments: [{ method: "cash" as const, amount: 16000 }],
  grantFullServiceCommission: false,
};

describe("createIncomeSchema", () => {
  it("accepts one or two distinct positive payment allocations", () => {
    expect(createIncomeSchema.parse(publicInput)).toEqual(publicInput);
    expect(createIncomeSchema.safeParse({
      ...publicInput,
      payments: [
        { method: "cash", amount: 8000 },
        { method: "transfer", amount: 8000 },
      ],
    }).success).toBe(true);
  });

  it("rejects duplicate payment methods", () => {
    expect(createIncomeSchema.safeParse({
      ...publicInput,
      payments: [
        { method: "cash", amount: 8000 },
        { method: "cash", amount: 8000 },
      ],
    }).success).toBe(false);
  });

  it("requires a strict full-commission flag for every product line", () => {
    const productId = "00000000-0000-4000-8000-000000000099";

    expect(createIncomeSchema.safeParse({
      ...publicInput,
      products: [{ productId, quantity: 2 }],
    }).success).toBe(false);
    expect(createIncomeSchema.safeParse({
      ...publicInput,
      products: [{ productId, quantity: 2, grantFullCommission: "true" }],
    }).success).toBe(false);
  });

  it("rejects duplicate products and browser-supplied product commission authority", () => {
    const productId = "00000000-0000-4000-8000-000000000099";
    expect(createIncomeSchema.safeParse({
      ...publicInput,
      products: [
        { productId, quantity: 1, grantFullCommission: false },
        { productId, quantity: 2, grantFullCommission: true },
      ],
    }).success).toBe(false);
    expect(createIncomeSchema.safeParse({
      ...publicInput,
      products: [{ productId, quantity: 2, grantFullCommission: true, rate: 100 }],
    }).success).toBe(false);
    expect(createIncomeSchema.safeParse({
      ...publicInput,
      products: [{ productId, quantity: 2, grantFullCommission: true, amount: 30000 }],
    }).success).toBe(false);
    expect(createIncomeSchema.safeParse({
      ...publicInput,
      products: [{ productId, quantity: 2, grantFullCommission: true, authorizedBy: publicInput.employeeId }],
    }).success).toBe(false);
  });

  it.each([
    { total: 16000 },
    { registeredBy: publicInput.employeeId },
    { serviceCommissionRate: 45 },
    { createdAt: "2026-08-13T10:00:00-03:00" },
  ])("rejects browser authority fields: %o", (authority) => {
    expect(createIncomeSchema.safeParse({ ...publicInput, ...authority }).success)
      .toBe(false);
  });
});
