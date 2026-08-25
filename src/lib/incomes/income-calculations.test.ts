import { describe, expect, it } from "vitest";

import {
  allocateByBasisPoints,
  calculateIncomeTotal,
  formatArs,
} from "./income-calculations";

const services = [{ id: "service-1", name: "Corte", price: 16000 }];
const products = [
  { id: "product-1", name: "Pomada", price: 10000, stock: 4 },
  { id: "product-2", name: "Shampoo", price: 12000, stock: 7 },
];

describe("calculateIncomeTotal", () => {
  it("calculates a service-only entry", () => {
    expect(
      calculateIncomeTotal(
        { serviceId: "service-1", products: [] },
        services,
        products,
      ),
    ).toBe(16000);
  });

  it("calculates a products-only entry using quantities", () => {
    expect(
      calculateIncomeTotal(
        {
          serviceId: null,
          products: [
            { productId: "product-1", quantity: 2 },
            { productId: "product-2", quantity: 1 },
          ],
        },
        services,
        products,
      ),
    ).toBe(32000);
  });

  it("adds the selected service and product quantities", () => {
    expect(
      calculateIncomeTotal(
        {
          serviceId: "service-1",
          products: [{ productId: "product-1", quantity: 2 }],
        },
        services,
        products,
      ),
    ).toBe(36000);
  });

  it("ignores unknown catalog ids instead of producing NaN", () => {
    expect(
      calculateIncomeTotal(
        {
          serviceId: "missing",
          products: [{ productId: "missing", quantity: 2 }],
        },
        services,
        products,
      ),
    ).toBe(0);
  });

  it("uses charged manager overrides for the payable total", () => {
    expect(
      calculateIncomeTotal(
        {
          serviceId: "service-1",
          servicePriceOverride: {
            chargedUnitPrice: 10000,
            reason: "Descuento habitual",
          },
          products: [{ productId: "product-1", quantity: 2 }],
          productPriceOverrides: [
            {
              productId: "product-1",
              override: { chargedUnitPrice: 0, reason: "Cortesía" },
            },
          ],
        },
        services,
        products,
      ),
    ).toBe(10000);
  });
});

describe("allocateByBasisPoints", () => {
  it("distributes the exact total when basis points sum to 10000", () => {
    expect(allocateByBasisPoints(19000, [5000, 5000])).toEqual([9500, 9500]);
  });

  it("assigns the integer remainder to the last allocation deterministically", () => {
    expect(allocateByBasisPoints(10001, [5000, 5000])).toEqual([5000, 5001]);
    expect(allocateByBasisPoints(100, [3334, 3333, 3333])).toEqual([33, 33, 34]);
  });

  it("returns zeros for a zero total", () => {
    expect(allocateByBasisPoints(0, [5000, 5000])).toEqual([0, 0]);
  });

  it("rejects basis points that do not sum to 10000", () => {
    expect(() => allocateByBasisPoints(1000, [3000, 3000])).toThrow();
    expect(() => allocateByBasisPoints(1000, [5000, 5000, 1000])).toThrow();
  });

  it("rejects empty basis points", () => {
    expect(() => allocateByBasisPoints(1000, [])).toThrow();
  });
});

it("formats integer Argentine pesos", () => {
  expect(formatArs(16000)).toContain("16.000");
});
