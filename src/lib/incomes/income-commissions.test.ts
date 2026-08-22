import { expect, it } from "vitest";

import {
  calculateCommissionPreview,
  calculatePaymentBalance,
  contributesToActiveMetrics,
} from "@/lib/incomes/income-commissions";

it("calculates every selected product line independently", () => {
  expect(calculateCommissionPreview({
    responsibleRole: "employee",
    serviceBase: 19000,
    serviceRate: 45,
    productRate: 10,
    grantFullServiceCommission: false,
    products: [
      { productId: "pomade", price: 15000, quantity: 2, grantFullCommission: true },
      { productId: "shampoo", price: 10000, quantity: 1, grantFullCommission: false },
    ],
  })).toEqual({
    service: {
      subtotal: 19000,
      catalogSubtotal: 19000,
      chargedSubtotal: 19000,
      adjustmentAmount: 0,
      rate: 45,
      amount: 8550,
      fullCommission: false,
      authorizedBy: null,
    },
    products: [
      {
        subtotal: 30000,
        catalogSubtotal: 30000,
        chargedSubtotal: 30000,
        adjustmentAmount: 0,
        rate: 100,
        amount: 30000,
        fullCommission: true,
        authorizedBy: null,
      },
      {
        subtotal: 10000,
        catalogSubtotal: 10000,
        chargedSubtotal: 10000,
        adjustmentAmount: 0,
        rate: 10,
        amount: 1000,
        fullCommission: false,
        authorizedBy: null,
      },
    ],
    total: 39550,
    barbershopNet: 19450,
  });
});

it("reconciles a full service with multiple independent product exceptions", () => {
  expect(calculateCommissionPreview({
    responsibleRole: "employee",
    serviceBase: 19000,
    serviceRate: 45,
    productRate: 10,
    grantFullServiceCommission: true,
    products: [
      { productId: "pomade", price: 15000, quantity: 2, grantFullCommission: true },
      { productId: "shampoo", price: 10000, quantity: 1, grantFullCommission: false },
    ],
  })).toEqual({
    service: {
      subtotal: 19000,
      catalogSubtotal: 19000,
      chargedSubtotal: 19000,
      adjustmentAmount: 0,
      rate: 100,
      amount: 19000,
      fullCommission: true,
      authorizedBy: null,
    },
    products: [
      {
        subtotal: 30000,
        catalogSubtotal: 30000,
        chargedSubtotal: 30000,
        adjustmentAmount: 0,
        rate: 100,
        amount: 30000,
        fullCommission: true,
        authorizedBy: null,
      },
      {
        subtotal: 10000,
        catalogSubtotal: 10000,
        chargedSubtotal: 10000,
        adjustmentAmount: 0,
        rate: 10,
        amount: 1000,
        fullCommission: false,
        authorizedBy: null,
      },
    ],
    total: 50000,
    barbershopNet: 9000,
  });
});

it("applies 100 percent only to the service and rounds whole pesos", () => {
  expect(calculateCommissionPreview({
    responsibleRole: "employee",
    serviceBase: 19001,
    serviceRate: 45,
    productRate: 10,
    grantFullServiceCommission: true,
    products: [{ productId: "pomade", price: 10005, quantity: 1, grantFullCommission: false }],
  })).toMatchObject({ service: { amount: 19001 }, products: [{ amount: 1001 }], total: 20002 });
});

it("keeps product-only and zero-rate sales safe", () => {
  expect(calculateCommissionPreview({ responsibleRole: "employee", serviceBase: 0, serviceRate: 0, productRate: 0, grantFullServiceCommission: true, products: [{ productId: "gel", price: 12000, quantity: 1, grantFullCommission: false }] })).toMatchObject({ service: null, products: [{ amount: 0 }], total: 0, barbershopNet: 12000 });
});

it("uses owner configured commission rates without applying the 100 percent exception", () => {
  expect(calculateCommissionPreview({
    responsibleRole: "owner",
    serviceBase: 20000,
    serviceRate: 50,
    productRate: 10,
    grantFullServiceCommission: true,
    products: [{ productId: "pomade", price: 15000, quantity: 2, grantFullCommission: true }],
  })).toMatchObject({
    service: { subtotal: 20000, rate: 50, amount: 10000, fullCommission: false, authorizedBy: null },
    products: [
      { subtotal: 30000, rate: 10, amount: 3000, fullCommission: false, authorizedBy: null },
    ],
    total: 13000,
    barbershopNet: 37000,
  });
});

it("calculates charged-subtotal commission when the manager overrides the catalog price", () => {
  expect(calculateCommissionPreview({
    responsibleRole: "employee",
    serviceBase: 20000,
    serviceRate: 50,
    productRate: 10,
    grantFullServiceCommission: false,
    products: [],
    serviceChargedBase: 10000,
  })).toEqual({
    service: {
      subtotal: 10000,
      catalogSubtotal: 20000,
      chargedSubtotal: 10000,
      adjustmentAmount: -10000,
      rate: 50,
      amount: 5000,
      fullCommission: false,
      authorizedBy: null,
    },
    products: [],
    total: 5000,
    barbershopNet: 5000,
  });
});

it("computes charged product line snapshots including adjustment and earning", () => {
  expect(calculateCommissionPreview({
    responsibleRole: "employee",
    serviceBase: 0,
    serviceRate: 0,
    productRate: 20,
    grantFullServiceCommission: false,
    products: [
      { productId: "pomade", price: 12000, quantity: 2, grantFullCommission: false, chargedUnitPrice: 6000 },
    ],
  })).toEqual({
    service: null,
    products: [
      {
        subtotal: 12000,
        catalogSubtotal: 24000,
        chargedSubtotal: 12000,
        adjustmentAmount: -12000,
        rate: 20,
        amount: 2400,
        fullCommission: false,
        authorizedBy: null,
      },
    ],
    total: 2400,
    barbershopNet: 9600,
  });
});

it("treats a zero charged line as commission-free without raising exceptions", () => {
  expect(calculateCommissionPreview({
    responsibleRole: "employee",
    serviceBase: 0,
    serviceRate: 50,
    productRate: 20,
    grantFullServiceCommission: false,
    products: [
      { productId: "freebie", price: 12000, quantity: 1, grantFullCommission: false, chargedUnitPrice: 0 },
    ],
  })).toMatchObject({
    products: [{ chargedSubtotal: 0, rate: 0, amount: 0, fullCommission: false }],
    total: 0,
    barbershopNet: 0,
  });
});

it("reports exact, missing and excess payment allocation", () => {
  expect(calculatePaymentBalance(19000, [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 10000 }, { paymentMethodId: "60000000-0000-4000-8000-000000000002", amount: 9000 }])).toEqual({ allocated: 19000, remaining: 0, excess: 0 });
  expect(calculatePaymentBalance(19000, [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 10000 }])).toEqual({ allocated: 10000, remaining: 9000, excess: 0 });
  expect(calculatePaymentBalance(19000, [{ paymentMethodId: "60000000-0000-4000-8000-000000000001", amount: 20000 }])).toEqual({ allocated: 20000, remaining: 0, excess: 1000 });
});

it("excludes voided sales from active economics", () => {
  expect(contributesToActiveMetrics("active")).toBe(true);
  expect(contributesToActiveMetrics("voided")).toBe(false);
});
