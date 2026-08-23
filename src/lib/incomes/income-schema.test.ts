import { describe, expect, it } from "vitest";

import {
  createIncomeSchema,
  employeeCreateIncomeSchema,
  incomeFormSchema,
  managerCreateIncomeSchema,
  employeeIncomeFormSchema,
  priceOverrideSchema,
} from "./income-schema";

const validBase = {
  employeeId: "00000000-0000-4000-8000-000000000001",
  customerId: null,
  serviceId: "service-1",
  products: [],
  payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 16000 }],
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

  it("rejects a missing payment allocation", () => {
    const result = incomeFormSchema.safeParse({
      ...validBase,
      payments: [],
    });

    expect(result.success).toBe(false);
  });
});

describe("priceOverrideSchema", () => {
  it("requires a positive charged unit price and non-empty reason", () => {
    expect(
      priceOverrideSchema.safeParse({
        chargedUnitPrice: 10000,
        reason: "Promo cliente",
      }).success,
    ).toBe(true);
  });

  it("rejects a negative charged unit price but accepts zero with a reason", () => {
    expect(
      priceOverrideSchema.safeParse({
        chargedUnitPrice: -1,
        reason: "Cortesía",
      }).success,
    ).toBe(false);
    expect(
      priceOverrideSchema.safeParse({
        chargedUnitPrice: 0,
        reason: "Cortesía",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty or whitespace reason", () => {
    expect(
      priceOverrideSchema.safeParse({
        chargedUnitPrice: 5000,
        reason: "   ",
      }).success,
    ).toBe(false);
  });

  it("rejects extra browser fields", () => {
    expect(
      priceOverrideSchema.safeParse({
        chargedUnitPrice: 5000,
        reason: "Promo",
        overrideBy: "self",
      }).success,
    ).toBe(false);
  });
});

describe("managerCreateIncomeSchema", () => {
  it("accepts an optional priceOverride on the service and each product", () => {
    const result = managerCreateIncomeSchema.safeParse({
      ...publicInput,
      serviceId: "00000000-0000-4000-8000-000000000020",
      products: [{ productId: "00000000-0000-4000-8000-000000000021", quantity: 2, grantFullCommission: false }],
      servicePriceOverride: { chargedUnitPrice: 10000, reason: "Promo" },
      productPriceOverrides: {
        "00000000-0000-4000-8000-000000000021": { chargedUnitPrice: 5000, reason: "Descuento" },
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects priceOverride keys that reference unknown product ids", () => {
    const result = managerCreateIncomeSchema.safeParse({
      ...publicInput,
      products: [{ productId: "00000000-0000-4000-8000-000000000021", quantity: 1, grantFullCommission: false }],
      productPriceOverrides: {
        "00000000-0000-4000-8000-000000000099": { chargedUnitPrice: 5000, reason: "Ghost" },
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects basis points on manager payments", () => {
    const result = managerCreateIncomeSchema.safeParse({
      ...publicInput,
      payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", basisPoints: 5000 }],
    });

    expect(result.success).toBe(false);
  });
});

describe("employeeCreateIncomeSchema", () => {
  const validEmployee = {
    requestId: "00000000-0000-4000-8000-000000000030",
    employeeId: "00000000-0000-4000-8000-000000000001",
    customerId: null,
    serviceId: "00000000-0000-4000-8000-000000000020",
    products: [],
    payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", basisPoints: 10000 }],
    grantFullServiceCommission: false,
  };

  it("accepts integer basis-point allocations", () => {
    expect(employeeCreateIncomeSchema.safeParse(validEmployee).success).toBe(true);
  });

  it("rejects an amount field on employee payments", () => {
    expect(
      employeeCreateIncomeSchema.safeParse({
        ...validEmployee,
        payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 10000 }],
      }).success,
    ).toBe(false);
  });

  it("rejects priceOverride keys on the service or any product", () => {
    expect(
      employeeCreateIncomeSchema.safeParse({
        ...validEmployee,
        servicePriceOverride: { chargedUnitPrice: 5000, reason: "Promo" },
      }).success,
    ).toBe(false);
    expect(
      employeeCreateIncomeSchema.safeParse({
        ...validEmployee,
        productPriceOverrides: {
          "00000000-0000-4000-8000-000000000021": { chargedUnitPrice: 5000, reason: "Promo" },
        },
      }).success,
    ).toBe(false);
  });

  it("rejects basis points outside 0..10000", () => {
    expect(
      employeeCreateIncomeSchema.safeParse({
        ...validEmployee,
        payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", basisPoints: -1 }],
      }).success,
    ).toBe(false);
    expect(
      employeeCreateIncomeSchema.safeParse({
        ...validEmployee,
        payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", basisPoints: 10001 }],
      }).success,
    ).toBe(false);
  });
});

describe("employeeIncomeFormSchema", () => {
  it("accepts integer basis points inside the allowed range", () => {
    expect(employeeIncomeFormSchema.safeParse({
      employeeId: "00000000-0000-4000-8000-000000000099",
      customerId: null,
      serviceId: "00000000-0000-4000-8000-000000000001",
      products: [],
      payments: [
        {
          paymentMethodId: "60000000-0000-4000-8000-000000000001",
          basisPoints: 10000,
        },
      ],
      grantFullServiceCommission: false,
    }).success).toBe(true);
  });

  it("rejects when basis points do not sum to 10000", () => {
    expect(employeeIncomeFormSchema.safeParse({
      employeeId: "00000000-0000-4000-8000-000000000099",
      customerId: null,
      serviceId: "00000000-0000-4000-8000-000000000001",
      products: [],
      payments: [
        {
          paymentMethodId: "60000000-0000-4000-8000-000000000001",
          basisPoints: 6000,
        },
      ],
      grantFullServiceCommission: false,
    }).success).toBe(false);
  });

  it("rejects a negative or non-integer basis points entry", () => {
    const result = employeeIncomeFormSchema.safeParse({
      employeeId: "00000000-0000-4000-8000-000000000099",
      customerId: null,
      serviceId: "00000000-0000-4000-8000-000000000001",
      products: [],
      payments: [
        { paymentMethodId: "60000000-0000-4000-8000-000000000001", basisPoints: -100 },
        { paymentMethodId: "60000000-0000-4000-8000-000000000002", basisPoints: 10200 },
      ],
      grantFullServiceCommission: false,
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
  payments: [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 16000 }],
  grantFullServiceCommission: false,
};

describe("createIncomeSchema", () => {
  it("accepts one or more distinct positive payment allocations", () => {
    expect(createIncomeSchema.parse(publicInput)).toEqual(publicInput);
    expect(createIncomeSchema.safeParse({
      ...publicInput,
      payments: [
        { paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 20000 },
        { paymentMethodId: "60000000-0000-4000-8000-000000000002", amount: 19000 },
        { paymentMethodId: "60000000-0000-4000-8000-000000000003", amount: 10000 },
      ],
    }).success).toBe(true);
  });

  it("rejects duplicate payment methods", () => {
    expect(createIncomeSchema.safeParse({
      ...publicInput,
      payments: [
        { paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 8000 },
        { paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 8000 },
      ],
    }).success).toBe(false);
  });

  it.each([
    [{ paymentMethodId: "not-a-uuid", amount: 16000 }],
    [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 0 }],
  ])("rejects malformed payment allocations: %o", (payments) => {
    expect(createIncomeSchema.safeParse({ ...publicInput, payments }).success).toBe(false);
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
