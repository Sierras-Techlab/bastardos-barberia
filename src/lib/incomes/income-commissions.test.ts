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
    service: { subtotal: 19000, rate: 45, amount: 8550, fullCommission: false, authorizedBy: null },
    products: [
      { subtotal: 30000, rate: 100, amount: 30000, fullCommission: true, authorizedBy: null },
      { subtotal: 10000, rate: 10, amount: 1000, fullCommission: false, authorizedBy: null },
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
    service: { subtotal: 19000, rate: 100, amount: 19000, fullCommission: true, authorizedBy: null },
    products: [
      { subtotal: 30000, rate: 100, amount: 30000, fullCommission: true, authorizedBy: null },
      { subtotal: 10000, rate: 10, amount: 1000, fullCommission: false, authorizedBy: null },
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

it("keeps owner previews commission-free even when an override is requested", () => {
  expect(calculateCommissionPreview({
    responsibleRole: "owner",
    serviceBase: 19000,
    serviceRate: 45,
    productRate: 10,
    grantFullServiceCommission: true,
    products: [{ productId: "pomade", price: 15000, quantity: 2, grantFullCommission: true }],
  })).toMatchObject({
    service: { rate: 0, amount: 0, fullCommission: false },
    products: [{ rate: 0, amount: 0, fullCommission: false }],
    total: 0,
    barbershopNet: 49000,
  });
});

it("reports exact, missing and excess payment allocation", () => {
  expect(calculatePaymentBalance(19000, [{ method: "cash", amount: 10000 }, { method: "transfer", amount: 9000 }])).toEqual({ allocated: 19000, remaining: 0, excess: 0 });
  expect(calculatePaymentBalance(19000, [{ method: "cash", amount: 10000 }])).toEqual({ allocated: 10000, remaining: 9000, excess: 0 });
  expect(calculatePaymentBalance(19000, [{ method: "cash", amount: 20000 }])).toEqual({ allocated: 20000, remaining: 0, excess: 1000 });
});

it("excludes voided sales from active economics", () => {
  expect(contributesToActiveMetrics("active")).toBe(true);
  expect(contributesToActiveMetrics("voided")).toBe(false);
});
