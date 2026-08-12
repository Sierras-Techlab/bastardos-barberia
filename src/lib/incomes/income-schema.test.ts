import { describe, expect, it } from "vitest";

import { incomeFormSchema } from "./income-schema";

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
      products: [{ productId: "product-1", quantity: 2 }],
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
      products: [{ productId: "product-1", quantity: 0 }],
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
