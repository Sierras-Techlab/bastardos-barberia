import { describe, expect, it } from "vitest";

import { calculateIncomeTotal, formatArs } from "./income-calculations";

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
});

it("formats integer Argentine pesos", () => {
  expect(formatArs(16000)).toContain("16.000");
});
