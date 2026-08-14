import { expect, it } from "vitest";

import {
  calculateCommissionPreview,
  calculatePaymentBalance,
  contributesToActiveMetrics,
} from "@/lib/incomes/income-commissions";

it("calculates separate service and product commissions", () => {
  expect(calculateCommissionPreview({
    responsibleRole: "employee",
    serviceBase: 19000,
    productBase: 30000,
    serviceRate: 45,
    productRate: 10,
    grantFullServiceCommission: false,
  })).toEqual({
    serviceBase: 19000,
    productBase: 30000,
    serviceRate: 45,
    productRate: 10,
    serviceAmount: 8550,
    productAmount: 3000,
    total: 11550,
    barbershopNet: 37450,
    fullServiceCommission: false,
  });
});

it("applies 100 percent only to the service and rounds whole pesos", () => {
  expect(calculateCommissionPreview({
    responsibleRole: "employee",
    serviceBase: 19001,
    productBase: 10005,
    serviceRate: 45,
    productRate: 10,
    grantFullServiceCommission: true,
  })).toMatchObject({ serviceAmount: 19001, productAmount: 1001, total: 20002 });
});

it("keeps product-only and zero-rate sales safe", () => {
  expect(calculateCommissionPreview({ responsibleRole: "employee", serviceBase: 0, productBase: 12000, serviceRate: 0, productRate: 0, grantFullServiceCommission: true })).toMatchObject({ serviceAmount: 0, productAmount: 0, total: 0, barbershopNet: 12000, fullServiceCommission: false });
});

it("keeps owner previews commission-free even when an override is requested", () => {
  expect(calculateCommissionPreview({
    responsibleRole: "owner",
    serviceBase: 19000,
    productBase: 30000,
    serviceRate: 45,
    productRate: 10,
    grantFullServiceCommission: true,
  })).toMatchObject({
    serviceRate: 0,
    productRate: 0,
    serviceAmount: 0,
    productAmount: 0,
    total: 0,
    barbershopNet: 49000,
    fullServiceCommission: false,
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
