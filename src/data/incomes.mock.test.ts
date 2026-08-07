import { expect, it } from "vitest";

import { getIncomeKind } from "@/lib/incomes/income-list";
import type { IncomeListData } from "@/types/income";
import mock from "./incomes.mock.json";

it("covers the income-list scenarios", () => {
  const data = mock as IncomeListData;

  expect(data.currentUser.role).toBe("owner");
  expect(data.employees).toHaveLength(2);
  expect(data.incomes.length).toBeGreaterThanOrEqual(24);
  expect(new Set(data.incomes.map(getIncomeKind))).toEqual(
    new Set(["service", "products", "combined"]),
  );
  expect(new Set(data.incomes.map((item) => item.paymentMethod))).toEqual(
    new Set(["cash", "transfer"]),
  );
  expect(data.incomes.some((item) => item.customer === null)).toBe(true);
  expect(data.incomes.some((item) => item.status === "voided")).toBe(true);
  expect(
    data.incomes.every((item) => item.createdAt.startsWith("2026-08")),
  ).toBe(true);

  for (const income of data.incomes) {
    const expectedTotal =
      (income.service?.price ?? 0) +
      income.products.reduce(
        (total, product) => total + product.unitPrice * product.quantity,
        0,
      );

    expect(income.total).toBe(expectedTotal);
  }
});
